// A tiny circuit breaker for Spotify API calls. Spotify rate-limits per app
// (client id) and — as seen in practice — some 429s come back with NO
// Retry-After header, so blind retries just keep the limit alive. After
// OPEN_AFTER consecutive 429s we OPEN the breaker for COOLDOWN_MS: callers wait
// out the cooldown instead of hammering, then a single success closes it again.
// Module-level so it's shared across every Spotify request in the session.

const OPEN_AFTER = 3;
const COOLDOWN_MS = 60000;

let consecutive429 = 0;
let openUntil = 0; // epoch ms the breaker stays open until

// Ms remaining on an open breaker (0 = closed).
export function breakerWaitMs() {
  const now = Date.now();
  return openUntil > now ? openUntil - now : 0;
}

// Record a 429. Returns true if this tripped the breaker open.
export function note429() {
  consecutive429 += 1;
  if (consecutive429 >= OPEN_AFTER && openUntil <= Date.now()) {
    openUntil = Date.now() + COOLDOWN_MS;
    return true;
  }
  return false;
}

// Record a success — closes the breaker.
export function noteSuccess() {
  consecutive429 = 0;
  openUntil = 0;
}

// --- Proactive pacing ----------------------------------------------------
// A global "next slot" scheduler that spaces consecutive Spotify requests at
// least MIN_GAP_MS apart, so we mostly stay UNDER the rate limit instead of
// tripping it and relying on the breaker to recover. This caps the global rate
// regardless of how many crate workers run concurrently. await it before each
// request.
const MIN_GAP_MS = 150; // ~6-7 requests/sec

let nextSlot = 0;
export function throttleSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  const wait = slot - now;
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

// Standalone retry wrapper combining the pacer, the breaker and 429 backoff.
// PLLibrary has its own copy that also drives a "rate limited" banner in
// component state; this one is for callers outside React state (Artwork
// Explorer), so the shared breaker still protects every request either way.
export async function spotifyRetry(fn, attempts = 3) {
  const cd = breakerWaitMs();
  if (cd > 0) await new Promise((r) => setTimeout(r, cd));

  for (let i = 0; ; i++) {
    try {
      await throttleSlot();
      const res = await fn();
      noteSuccess();
      return res;
    } catch (e) {
      const status = (e && e.status) || (e && e.response && e.response.status);
      if (status === 429) {
        note429();
        if (i >= attempts) throw e;
        // Spotify often omits Retry-After, so fall back to exponential backoff.
        const retryAfter = Number(
          (e && e.headers && e.headers['retry-after']) ||
            (e && e.response && e.response.headers && e.response.headers['retry-after']) ||
            0
        );
        const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * 2 ** i);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}
