// Builds the Artwork Explorer index from data the app already has.
//
// The key insight: artwork costs ZERO extra Spotify calls. Playlist tracks are
// already cached in IndexedDB by PLLibrary (`sp:<playlistId>`, versioned by
// snapshot_id) and every track carries `track.album.images[]`. So we read the
// existing crate cache and only fall back to the network for crates that have
// never been opened.
//
// Two different groupings, deliberately:
//   TILES  — one per track, because that's how the gallery is browsed.
//   COVERS — one per unique album, because that's the unit of analysis. A
//            5,000-track library is typically ~1,500 unique covers, so
//            analyzing per-album instead of per-track cuts vision-API spend
//            (and worker time) by ~3x with no visible difference.

import { idbGet, idbSet } from "./crateStore";

export const LIKED_SONGS_ID = "__liked__";
export const LIKED_SONGS_NAME = "Liked Songs";

// Session-level memo of the assembled index, so reopening the view is instant.
// Keyed by every crate's snapshot_id, so any playlist edit rebuilds naturally.
let memo = null;

export function indexSignature(playlists, includeLiked) {
  return (
    (includeLiked ? "L|" : "") +
    (playlists || [])
      .map((p) => `${p.id}@${p.snapshot_id || ""}`)
      .join(",")
  );
}

export function clearArtworkIndexMemo() {
  memo = null;
}

// Spotify returns up to three square sizes: 640, 300, 64. 640 is the ceiling —
// there is no higher-resolution artwork available through the API.
//
// Width can come back null on some responses, which would collapse the sort and
// silently hand the grid (or worse, the lightbox) a 64px thumbnail. When widths
// are missing we fall back to Spotify's own CDN path prefix, which encodes the
// size, and finally to array order (Spotify lists largest first).
const SIZE_BY_PREFIX = [
  ["ab67616d0000b273", 640],
  ["ab67616d00001e02", 300],
  ["ab67616d00004851", 64],
];

export function imageWidth(img) {
  if (img && typeof img.width === "number" && img.width > 0) return img.width;
  const url = (img && img.url) || "";
  const hit = SIZE_BY_PREFIX.find(([prefix]) => url.includes(prefix));
  return hit ? hit[1] : 0;
}

export function pickImages(images) {
  if (!images || !images.length) return null;
  const known = images.filter((i) => i && i.url);
  if (!known.length) return null;

  const sorted = [...known].sort((a, b) => imageWidth(b) - imageWidth(a));
  const largest = sorted[0];
  // `find` walks widest -> narrowest, so this takes the LARGEST image that
  // still fits under the cap, never the smallest available.
  const atMost = (cap) =>
    (sorted.find((i) => imageWidth(i) <= cap) || largest).url;

  return {
    url640: largest.url,
    url300: atMost(400),
    url64: atMost(100),
  };
}

// Playlist items can be podcast episodes, removed tracks (`track: null`) or
// local files — none of which have usable album artwork.
function usableTrack(item) {
  const t = item && item.track;
  return !!(
    t &&
    t.id &&
    t.type !== "episode" &&
    !t.is_local &&
    t.album &&
    t.album.images &&
    t.album.images.length
  );
}

// A tile is one ALBUM COVER, not one track. Every track on an album shares the
// same artwork, so a per-track tile filled the gallery with duplicates — a
// 12-track EP appeared 12 times. Tracks are folded into the cover instead, and
// kept on the tile so search still matches on track names.
function coverFromTrack(t, scopeId) {
  const imgs = pickImages(t.album.images);
  if (!imgs) return null;
  return {
    // Scoped so the same album can key stably in a playlist view and in the
    // global view without colliding.
    id: `${scopeId}:${t.album.id}`,
    albumId: t.album.id,
    albumName: t.album.name || "",
    artistNames: (t.artists || []).map((a) => a.name),
    artistIds: (t.artists || []).map((a) => a.id),
    releaseDate: t.album.release_date || "",
    releaseYear: (t.album.release_date || "").slice(0, 4),
    // The artwork represents the album, so this opens the album rather than an
    // arbitrary one of its tracks.
    uri: t.album.uri || `spotify:album:${t.album.id}`,
    trackNames: [t.name || ""],
    trackCount: 1,
    playlistNames: [],
    ...imgs,
  };
}

// Fold a track into an existing cover: accumulate the track and widen the
// artist list (a compilation's tracks can each credit different artists).
function mergeTrackIntoCover(cover, t) {
  cover.trackCount += 1;
  if (cover.trackNames.length < 50) cover.trackNames.push(t.name || "");
  (t.artists || []).forEach((a) => {
    if (a && a.name && !cover.artistNames.includes(a.name)) {
      cover.artistNames.push(a.name);
    }
    if (a && a.id && !cover.artistIds.includes(a.id)) {
      cover.artistIds.push(a.id);
    }
  });
}

// Read one crate's tracks from the cache PLLibrary already populates. Returns
// null when nothing valid is cached, so the caller can decide whether to fetch.
async function cachedItems(playlistId, snapshotId) {
  const rec = await idbGet(`sp:${playlistId}`);
  if (!rec || !rec.data) return null;
  // Same freshness rule as PLLibrary: a snapshot_id mismatch means the playlist
  // was edited, so the cache is stale.
  if (snapshotId && rec.__v && rec.__v !== snapshotId) return null;
  return rec.data.items || null;
}

// Write a freshly-fetched crate back into the SAME cache PLLibrary reads, so a
// crate is only ever pulled over the network once. Without this, any crate you
// hadn't opened in the Library was re-fetched on every single visit.
//
// The shape must stay compatible with PLLibrary's `{ items, features }`, and we
// must not clobber audio features it may already have stored.
async function cacheItems(playlistId, snapshotId, items) {
  if (!snapshotId) return; // nothing safe to version by
  const existing = await idbGet(`sp:${playlistId}`);
  const features =
    existing && existing.data && existing.__v === snapshotId
      ? existing.data.features || []
      : [];
  await idbSet(`sp:${playlistId}`, {
    __v: snapshotId,
    data: { items, features },
  });
}

async function fetchPlaylistItems(spotifyWebApi, spotifyRetry, playlistId) {
  const items = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const off = offset;
    const res = await spotifyRetry(() =>
      spotifyWebApi.getPlaylistTracks(playlistId, { limit: 100, offset: off })
    );
    items.push(...(res.items || []));
    if (!res.next) break;
    offset += 100;
  }
  return items;
}

const LIKED_CACHE_KEY = "sp:__liked__";

// Liked Songs has no snapshot_id, so it used to be re-paginated in full on every
// open — with a few thousand saved tracks that's dozens of sequential requests
// and by far the slowest thing here.
//
// Instead, probe just the first page: `total` plus the newest `added_at` change
// whenever you save or unsave anything, which makes them a reliable version
// token. Unchanged means ONE request instead of N.
async function loadLikedSongs(spotifyWebApi, spotifyRetry) {
  const first = await spotifyRetry(() =>
    spotifyWebApi.getMySavedTracks({ limit: 50, offset: 0 })
  );
  const newest = (first.items && first.items[0] && first.items[0].added_at) || "";
  const version = `${first.total}:${newest}`;

  const cached = await idbGet(LIKED_CACHE_KEY);
  if (cached && cached.__v === version && cached.data && cached.data.items) {
    return cached.data.items;
  }

  const items = [...(first.items || [])];
  let offset = 50;
  while (offset < (first.total || 0)) {
    const off = offset;
    const res = await spotifyRetry(() =>
      spotifyWebApi.getMySavedTracks({ limit: 50, offset: off })
    );
    items.push(...(res.items || []));
    if (!res.items || !res.items.length) break;
    offset += 50;
  }

  await idbSet(LIKED_CACHE_KEY, { __v: version, data: { items, features: [] } });
  return items;
}

/**
 * Build the full index.
 *
 * @param {object}   opts.spotifyWebApi  spotify-web-api-js instance
 * @param {function} opts.spotifyRetry   PLLibrary's 429-aware retry wrapper
 * @param {Array}    opts.playlists      raw playlist objects (App's `pllibrary`)
 * @param {function} opts.onProgress     ({ phase, done, total, name })
 * @param {object}   opts.cancelRef      { current: bool } to abort mid-run
 * @param {boolean}  opts.force          rebuild even if the session memo hits
 * @returns {{ albums: Array, tiles: Array, covers: Map }}
 */
export async function buildArtworkIndex({
  spotifyWebApi,
  spotifyRetry,
  playlists,
  includeLiked = true,
  onProgress,
  cancelRef,
  force = false,
}) {
  const signature = indexSignature(playlists, includeLiked);
  // Closing Artwork Explorer unmounts it, so without this the entire index was
  // rebuilt every time you reopened it in the same session. The signature
  // covers every crate's snapshot_id, so an edited playlist still invalidates.
  if (!force && memo && memo.signature === signature) return memo.index;

  const sources = [
    ...(includeLiked
      ? [{ id: LIKED_SONGS_ID, name: LIKED_SONGS_NAME, snapshot_id: null }]
      : []),
    ...playlists.map((p) => ({
      id: p.id,
      name: p.name || "Untitled",
      snapshot_id: p.snapshot_id,
    })),
  ];

  const albums = [];
  const tiles = [];
  const covers = new Map();

  // Phase 1 — read every crate from IndexedDB IN PARALLEL. These were awaited
  // one at a time before, so 181 crates meant 181 sequential transactions even
  // when every one was a cache hit. They're independent reads; fire them all.
  if (onProgress) {
    onProgress({ phase: "cache", done: 0, total: sources.length, name: "" });
  }
  const loaded = await Promise.all(
    sources.map(async (src) => {
      if (src.id === LIKED_SONGS_ID) return { src, items: null, miss: true };
      try {
        return { src, items: await cachedItems(src.id, src.snapshot_id) };
      } catch (e) {
        return { src, items: null };
      }
    })
  );
  loaded.forEach((r) => {
    if (!r.items) r.miss = true;
  });

  // Phase 2 — only the misses touch the network. Everything is globally paced
  // by spotifyRetry/throttleSlot, so a little concurrency here just keeps the
  // pipe full rather than raising the request rate.
  const misses = loaded.filter((r) => r.miss);
  let fetched = 0;
  if (misses.length && onProgress) {
    onProgress({ phase: "fetch", done: 0, total: misses.length, name: "" });
  }

  const FETCH_CONCURRENCY = 4;
  let cursor = 0;
  const fetchWorker = async () => {
    while (cursor < misses.length) {
      if (cancelRef && cancelRef.current) return;
      const rec = misses[cursor++];
      try {
        if (rec.src.id === LIKED_SONGS_ID) {
          rec.items = await loadLikedSongs(spotifyWebApi, spotifyRetry);
        } else {
          rec.items = await fetchPlaylistItems(
            spotifyWebApi,
            spotifyRetry,
            rec.src.id
          );
          // Write back so this crate is a cache hit next time — and for the
          // Library too, since it's the same cache.
          await cacheItems(rec.src.id, rec.src.snapshot_id, rec.items);
        }
      } catch (e) {
        // A single unreadable crate (deleted, region-locked, permissions) must
        // not abort the whole index.
        console.warn("Artwork: skipped crate", rec.src.name, e && e.message);
        rec.items = null;
      }
      fetched += 1;
      if (onProgress) {
        onProgress({
          phase: "fetch",
          done: fetched,
          total: misses.length,
          name: rec.src.name,
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, misses.length) }, fetchWorker)
  );

  // Phase 3 — assemble, in the original crate order so the UI is stable.
  // Covers are deduped TWICE, at different scopes: within a playlist (so an EP
  // shows once in that crate) and globally (so an album saved to five
  // playlists shows once in All artwork).
  const globalTiles = new Map();

  loaded.forEach(({ src, items }) => {
    const crateCovers = new Map();

    (items || []).forEach((item) => {
      if (!usableTrack(item)) return;
      const t = item.track;

      const existing = crateCovers.get(t.album.id);
      if (existing) {
        mergeTrackIntoCover(existing, t);
      } else {
        const tile = coverFromTrack(t, src.id);
        if (!tile) return;
        tile.playlistNames = [src.name];
        crateCovers.set(t.album.id, tile);
      }

      const global = globalTiles.get(t.album.id);
      if (global) {
        mergeTrackIntoCover(global, t);
        if (!global.playlistNames.includes(src.name)) {
          global.playlistNames.push(src.name);
        }
      } else {
        const gt = coverFromTrack(t, "all");
        if (gt) {
          gt.playlistNames = [src.name];
          globalTiles.set(t.album.id, gt);
        }
      }

      // Analysis unit: one entry per unique album cover.
      if (!covers.has(t.album.id)) {
        const imgs = pickImages(t.album.images);
        covers.set(t.album.id, {
          albumId: t.album.id,
          albumName: t.album.name || "",
          artistNames: (t.artists || []).map((a) => a.name),
          artistIds: (t.artists || []).map((a) => a.id),
          url640: imgs.url640,
          url300: imgs.url300,
          trackCount: 1,
        });
      } else {
        covers.get(t.album.id).trackCount += 1;
      }
    });

    const crateTiles = [...crateCovers.values()];
    albums.push({
      id: src.id,
      name: src.name,
      tiles: crateTiles,
      mosaic: crateTiles.slice(0, 4).map((t) => t.url300),
      trackCount: crateTiles.reduce((n, t) => n + t.trackCount, 0),
      uniqueCovers: crateTiles.length,
    });
  });

  tiles.push(...globalTiles.values());

  // Empty crates would render as dead tiles in the Albums grid.
  const index = {
    albums: albums.filter((a) => a.trackCount > 0),
    tiles,
    covers,
  };
  memo = { signature, index };
  return index;
}

// Unique artist ids across the index, for the genre enrichment pass.
export function uniqueArtistIds(tiles) {
  const s = new Set();
  tiles.forEach((t) => (t.artistIds || []).forEach((id) => id && s.add(id)));
  return [...s];
}
