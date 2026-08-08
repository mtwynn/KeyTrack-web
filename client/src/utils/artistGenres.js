// Artist genre enrichment.
//
// Spotify has NO track- or album-level genre — genres live only on the artist
// object. `GET /v1/artists?ids=` takes 50 ids per call, so a library with ~800
// unique artists costs ~16 requests, paced by the existing global throttle.
//
// Genres barely change, so this is cached permanently (no version token) and
// only ever fetched for artists we haven't seen before.

import { ARTWORK_STORE, idbGetAll, idbSetMany } from "./crateStore";
import { throttleSlot } from "./spotifyLimiter";

const BATCH = 50;
export const genreKey = (artistId) => `artist:${artistId}`;

export async function loadArtistGenres() {
  const all = await idbGetAll(ARTWORK_STORE);
  const out = new Map();
  all.forEach((val, key) => {
    if (typeof key === "string" && key.startsWith("artist:") && val) {
      out.set(key.slice(7), val.genres || []);
    }
  });
  return out;
}

/**
 * @param {string[]} artistIds  every artist id in the index
 * @param {Map}      cache      artistId -> genres[] (mutated in place)
 */
export async function fetchArtistGenres({
  artistIds,
  cache,
  spotifyWebApi,
  spotifyRetry,
  onProgress,
  cancelRef,
}) {
  const missing = artistIds.filter((id) => id && !cache.has(id));
  if (!missing.length) return cache;

  const writes = [];
  for (let i = 0; i < missing.length; i += BATCH) {
    if (cancelRef && cancelRef.current) break;
    const ids = missing.slice(i, i + BATCH);
    try {
      await throttleSlot();
      const res = await spotifyRetry(() => spotifyWebApi.getArtists(ids));
      (res.artists || []).forEach((a) => {
        if (!a || !a.id) return;
        const genres = a.genres || [];
        cache.set(a.id, genres);
        writes.push([genreKey(a.id), { genres }]);
      });
    } catch (e) {
      // Genre data is an enhancement; a failed batch shouldn't break the view.
      console.warn("Artwork: artist genre batch failed", e && e.message);
    }
    if (onProgress) {
      onProgress({ done: Math.min(i + BATCH, missing.length), total: missing.length });
    }
  }

  if (writes.length) await idbSetMany(writes, ARTWORK_STORE);
  return cache;
}

// Spotify genres are flat, hyphen-free strings that are often very granular
// ("melodic house", "future garage"). Rolling them up to a coarse parent keeps
// the filter list usable while the raw genre stays searchable.
const PARENTS = [
  "house", "techno", "trance", "dubstep", "drum and bass", "garage",
  "hip hop", "rap", "trap", "r&b", "soul", "funk", "disco",
  "rock", "metal", "punk", "indie", "pop", "jazz", "blues",
  "classical", "ambient", "folk", "country", "reggae", "latin", "afro",
];

export function parentGenre(genre) {
  const g = (genre || "").toLowerCase();
  const hit = PARENTS.find((p) => g.includes(p));
  return hit || null;
}
