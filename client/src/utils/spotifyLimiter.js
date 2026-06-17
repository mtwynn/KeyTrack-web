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
