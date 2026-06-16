import axios from "axios";

// Shared SoundCloud crate-list fetching for the unified PLLibrary grid.

// Build a fetcher for the SoundCloud backend proxy. SoundCloud uses the unusual
// `Authorization: OAuth <token>` header (not Bearer). On a 401 (expired access
// token) it refreshes once via onRefreshToken and retries — mirroring the
// Spotify session handling. Returns an async (path) => responseData.
export function buildScFetch({ token, backend, onRefreshToken }) {
  return async function scFetch(path, retried = false) {
    try {
      const res = await axios.get(backend + path, {
        headers: { Authorization: "OAuth " + token },
      });
      return res.data;
    } catch (e) {
      if (e.response && e.response.status === 401 && !retried && onRefreshToken) {
        const fresh = await onRefreshToken();
        if (fresh) {
          const res = await axios.get(backend + path, {
            headers: { Authorization: "OAuth " + fresh },
          });
          return res.data;
        }
      }
      throw e;
    }
  };
}

// Swap SoundCloud's small "-large" artwork variant for a bigger one.
const bigArtwork = (url) => (url ? url.replace("-large", "-t500x500") : null);

// Tracks longer than this are almost certainly DJ sets/mixes (shared with
// SoundCloudCrate). One tunable constant.
export const LIKELY_SET_MS = 6 * 60 * 1000;
export const isLikelySet = (ms) => ms && ms > LIKELY_SET_MS;

// How many of these tracks are NOT likely sets.
const countNonSets = (tracks) =>
  (tracks || []).filter((t) => t && !isLikelySet(t.duration)).length;

const trackList = (d) =>
  (d && d.collection ? d.collection : Array.isArray(d) ? d : [])
    .map((t) => (t && t.track ? t.track : t))
    .filter(Boolean);

// Follow linked-partitioning `next_href` pages to collect a whole collection
// (the backend caps each page at 50). Guarded so a runaway can't loop forever.
async function fetchAllPages(scFetch, path) {
  const first = await scFetch(path);
  let items =
    first && first.collection
      ? first.collection.slice()
      : Array.isArray(first)
      ? first.slice()
      : [];
  let next = first && first.next_href;
  for (let guard = 0; next && guard < 40; guard++) {
    const page = await scFetch(
      "/soundcloud/next?href=" + encodeURIComponent(next)
    );
    if (page && page.collection) items = items.concat(page.collection);
    next = page && page.next_href;
  }
  return items;
}

// Load a crate's FULL track list (all pages), normalizing { track: {...} }
// wrappers (likes/reposts return those) into plain track objects.
export async function fetchScTracks(scFetch, path) {
  const items = await fetchAllPages(scFetch, path);
  return items.map((t) => (t && t.track ? t.track : t)).filter(Boolean);
}

// Resolve the playable SoundCloud URL for a track, handling private tracks'
// secret (secret_uri, or the permalink + secret_token) or the widget 403s.
// Used both for the Widget iframe `src` and for imperative widget.load() calls.
export function scTrackUrl(track) {
  let url = track.permalink_url || track.uri;
  if (track.sharing === "private") {
    if (track.secret_uri) {
      url = track.secret_uri;
    } else if (track.secret_token) {
      const base = track.permalink_url || track.uri;
      url =
        base +
        (base.indexOf("?") >= 0 ? "&" : "?") +
        "secret_token=" +
        track.secret_token;
    }
  }
  return url;
}

// SoundCloud's sanctioned HTML5 Widget URL — ToS-compliant playback with no
// OAuth. `visual: true` renders the big waveform player (used in the bottom bar
// for play/pause/scrub/seek); the small list player is the default.
export function scWidgetSrc(track, { visual = false } = {}) {
  return (
    "https://w.soundcloud.com/player/?url=" +
    encodeURIComponent(scTrackUrl(track)) +
    "&color=%23ff5500&auto_play=true&show_comments=false&visual=" +
    (visual ? "true" : "false")
  );
}

// Lazily load SoundCloud's Widget API (window.SC.Widget) once. Lets us drive a
// persistent iframe with widget.load()/setVolume() instead of re-mounting it
// per track. Resolves immediately if already present; memoized so concurrent
// callers share one <script>.
let scWidgetApiPromise = null;
export function loadScWidgetApi() {
  if (typeof window !== "undefined" && window.SC && window.SC.Widget) {
    return Promise.resolve();
  }
  if (scWidgetApiPromise) return scWidgetApiPromise;
  scWidgetApiPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return scWidgetApiPromise;
}

// Fetch the user's SoundCloud crates: Liked Tracks + Reposts as virtual crates
// (artwork from the first track) plus their playlists/sets. Returns a plain
// array of crate descriptors:
//   { id, kind: 'likes'|'reposts'|'playlist', name, owner, count, artwork, permalink }
export async function fetchSoundcloudCrates(scFetch) {
  const [playlists, likes, reposts] = await Promise.all([
    // Follow pagination so ALL playlists load, not just the first 50.
    fetchAllPages(scFetch, "/soundcloud/me/playlists").catch(() => []),
    scFetch("/soundcloud/me/likes/tracks").catch(() => ({ collection: [] })),
    scFetch("/soundcloud/me/reposts").catch(() => ({ collection: [] })),
  ]);

  const list = (d) => (d && d.collection ? d.collection : Array.isArray(d) ? d : []);
  const likeTracks = list(likes);
  const repostTracks = list(reposts);

  const result = [];
  // Liked + reposted tracks as virtual crates (artwork from first track). We
  // already have their tracks, so nonSetCount is free.
  if (likeTracks.length) {
    result.push({
      id: "__sc_likes__",
      kind: "likes",
      name: "Liked Tracks",
      owner: "Your likes",
      count: likeTracks.length,
      // We only fetch the first page for the tile; there may be more (the full
      // list loads when the crate is opened).
      more: !!(likes && likes.next_href),
      nonSetCount: countNonSets(likeTracks),
      artwork: bigArtwork(likeTracks[0] && likeTracks[0].artwork_url),
    });
  }
  if (repostTracks.length) {
    result.push({
      id: "__sc_reposts__",
      kind: "reposts",
      name: "Reposts",
      owner: "Your reposts",
      count: repostTracks.length,
      more: !!(reposts && reposts.next_href),
      nonSetCount: countNonSets(repostTracks),
      artwork: bigArtwork(repostTracks[0] && repostTracks[0].artwork_url),
    });
  }
  // The user's playlists / sets. The list response sometimes embeds the full
  // track array (then nonSetCount is free); otherwise it's null = "unknown"
  // until fetchScSetCounts fills it in.
  playlists.forEach((p) => {
    const embedded = Array.isArray(p.tracks) ? p.tracks : [];
    const complete =
      embedded.length > 0 &&
      embedded.length === p.track_count &&
      embedded.every((t) => typeof t.duration === "number");
    result.push({
      id: p.urn || p.id,
      kind: "playlist",
      name: p.title,
      owner: p.user && p.user.username ? "by " + p.user.username : "",
      count: p.track_count,
      nonSetCount: complete ? countNonSets(embedded) : null,
      artwork:
        bigArtwork(p.artwork_url) ||
        bigArtwork(p.tracks && p.tracks[0] && p.tracks[0].artwork_url),
      permalink: p.permalink_url,
    });
  });

  return result;
}

// For crates whose nonSetCount couldn't be derived from the list response
// (playlists without fully-embedded tracks), fetch their tracks and count the
// non-set ones. Cached in localStorage keyed by id+count so repeat loads are
// free. Concurrency-limited to be gentle. Returns { [crateId]: nonSetCount }.
export async function fetchScSetCounts(scFetch, crates) {
  const out = {};
  const cacheKey = (c) => "sc_nonset_" + c.id + "_" + c.count;
  const toFetch = [];
  (crates || []).forEach((c) => {
    if (c.kind !== "playlist" || c.nonSetCount != null) return;
    const cached = window.localStorage.getItem(cacheKey(c));
    if (cached != null) out[c.id] = Number(cached);
    else toFetch.push(c);
  });

  let cursor = 0;
  const worker = async () => {
    while (cursor < toFetch.length) {
      const c = toFetch[cursor++];
      try {
        const data = await scFetch(
          "/soundcloud/playlists/" + encodeURIComponent(c.id) + "/tracks"
        );
        const n = countNonSets(trackList(data));
        out[c.id] = n;
        window.localStorage.setItem(cacheKey(c), String(n));
      } catch (e) {
        // Leave unknown on failure — the crate just stays visible.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, toFetch.length) }, worker));
  return out;
}
