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

import { idbGet } from "./crateStore";
import { throttleSlot } from "./spotifyLimiter";

export const LIKED_SONGS_ID = "__liked__";
export const LIKED_SONGS_NAME = "Liked Songs";

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

function tileFromItem(item, playlistId, playlistName) {
  const t = item.track;
  const imgs = pickImages(t.album.images);
  if (!imgs) return null;
  return {
    // Unique per (playlist, track) so React keys stay stable when the same
    // track appears in several playlists.
    id: `${playlistId}:${t.id}`,
    trackId: t.id,
    trackName: t.name || "",
    albumId: t.album.id,
    albumName: t.album.name || "",
    artistNames: (t.artists || []).map((a) => a.name),
    artistIds: (t.artists || []).map((a) => a.id),
    releaseDate: t.album.release_date || "",
    releaseYear: (t.album.release_date || "").slice(0, 4),
    playlistId,
    playlistName,
    uri: t.uri,
    ...imgs,
  };
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

async function fetchPlaylistItems(spotifyWebApi, spotifyRetry, playlistId) {
  const items = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const off = offset;
    await throttleSlot();
    const res = await spotifyRetry(() =>
      spotifyWebApi.getPlaylistTracks(playlistId, { limit: 100, offset: off })
    );
    items.push(...(res.items || []));
    if (!res.next) break;
    offset += 100;
  }
  return items;
}

async function fetchLikedSongs(spotifyWebApi, spotifyRetry) {
  const items = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const off = offset;
    await throttleSlot();
    const res = await spotifyRetry(() =>
      spotifyWebApi.getMySavedTracks({ limit: 50, offset: off })
    );
    items.push(...(res.items || []));
    if (!res.next) break;
    offset += 50;
  }
  return items;
}

/**
 * Build the full index.
 *
 * @param {object}   opts.spotifyWebApi  spotify-web-api-js instance
 * @param {function} opts.spotifyRetry   PLLibrary's 429-aware retry wrapper
 * @param {Array}    opts.playlists      raw playlist objects (App's `pllibrary`)
 * @param {function} opts.onProgress     ({ done, total, name }) per crate
 * @param {object}   opts.cancelRef      { current: bool } to abort mid-run
 * @returns {{ albums: Array, tiles: Array, covers: Map }}
 */
export async function buildArtworkIndex({
  spotifyWebApi,
  spotifyRetry,
  playlists,
  includeLiked = true,
  onProgress,
  cancelRef,
}) {
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
  let done = 0;

  for (const src of sources) {
    if (cancelRef && cancelRef.current) break;
    if (onProgress) onProgress({ done, total: sources.length, name: src.name });

    let items = null;
    try {
      if (src.id === LIKED_SONGS_ID) {
        // Liked Songs has no snapshot_id, so it can't be safely cache-keyed by
        // version — always read it fresh.
        items = await fetchLikedSongs(spotifyWebApi, spotifyRetry);
      } else {
        items = await cachedItems(src.id, src.snapshot_id);
        if (!items) {
          items = await fetchPlaylistItems(
            spotifyWebApi,
            spotifyRetry,
            src.id
          );
        }
      }
    } catch (e) {
      // A single unreadable crate (deleted, region-locked, permissions) must
      // not abort the whole index.
      console.warn("Artwork: skipped crate", src.name, e && e.message);
      items = null;
    }

    const crateTiles = [];
    (items || []).forEach((item) => {
      if (!usableTrack(item)) return;
      const tile = tileFromItem(item, src.id, src.name);
      if (!tile) return;
      crateTiles.push(tile);
      tiles.push(tile);

      // Analysis unit: one entry per unique album cover.
      if (!covers.has(tile.albumId)) {
        covers.set(tile.albumId, {
          albumId: tile.albumId,
          albumName: tile.albumName,
          artistNames: tile.artistNames,
          artistIds: tile.artistIds,
          url640: tile.url640,
          url300: tile.url300,
          trackCount: 1,
        });
      } else {
        covers.get(tile.albumId).trackCount += 1;
      }
    });

    albums.push({
      id: src.id,
      name: src.name,
      tiles: crateTiles,
      // Cover mosaic uses the first four DISTINCT covers, so a playlist full of
      // one album doesn't render four identical thumbnails.
      mosaic: [...new Set(crateTiles.map((t) => t.url300))].slice(0, 4),
      trackCount: crateTiles.length,
      uniqueCovers: new Set(crateTiles.map((t) => t.albumId)).size,
    });

    done += 1;
    if (onProgress) onProgress({ done, total: sources.length, name: src.name });
  }

  // Empty crates would render as dead tiles in the Albums grid.
  return { albums: albums.filter((a) => a.trackCount > 0), tiles, covers };
}

// Unique artist ids across the index, for the genre enrichment pass.
export function uniqueArtistIds(tiles) {
  const s = new Set();
  tiles.forEach((t) => (t.artistIds || []).forEach((id) => id && s.add(id)));
  return [...s];
}
