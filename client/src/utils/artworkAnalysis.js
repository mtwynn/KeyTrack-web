// Runs Tier 1 vibe analysis across every unique cover and persists results.
//
// Decoding happens via createImageBitmap + OffscreenCanvas so the pixel work
// stays off the layout path. Results are keyed by albumId (not track) because
// identical covers only need analyzing once — the single biggest cost saving in
// the feature.
//
// Everything is incremental and resumable: already-analyzed covers are skipped,
// and each batch is flushed to IndexedDB, so closing the tab mid-run never
// loses completed work.

import { analyzePixels, ANALYSIS_SIZE, VIBE_ANALYSIS_VERSION } from "./artworkVibe";
import { ARTWORK_STORE, idbGetAll, idbSetMany } from "./crateStore";

const CONCURRENCY = 6;
const FLUSH_EVERY = 40;

export const vibeKey = (albumId) => `vibe:${albumId}`;

// Load every cached analysis in one cursor pass.
export async function loadVibeCache() {
  const all = await idbGetAll(ARTWORK_STORE);
  const out = new Map();
  all.forEach((val, key) => {
    if (typeof key === "string" && key.startsWith("vibe:") && val) {
      out.set(key.slice(5), val);
    }
  });
  return out;
}

async function analyzeOne(url) {
  // 300px is ample for 64x64 statistics and downloads ~4x faster than 640.
  const res = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: ANALYSIS_SIZE,
    resizeHeight: ANALYSIS_SIZE,
    resizeQuality: "pixelated",
  });
  const canvas = new OffscreenCanvas(ANALYSIS_SIZE, ANALYSIS_SIZE);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
  bitmap.close();
  return analyzePixels(ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE));
}

export function supportsVibeAnalysis() {
  return (
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  );
}

/**
 * @param {Map}      covers    albumId -> { url300, url640 }
 * @param {Map}      cache     existing analyses (from loadVibeCache)
 * @param {function} onProgress ({ done, total })
 * @param {object}   cancelRef  { current: bool }
 * @returns {Map} albumId -> analysis (cache, mutated in place)
 */
export async function runVibeAnalysis({
  covers,
  cache,
  onProgress,
  cancelRef,
}) {
  const pending = [...covers.values()].filter((c) => {
    const hit = cache.get(c.albumId);
    // Re-analyze when the algorithm itself changed, so improvements roll out.
    return !hit || hit.v !== VIBE_ANALYSIS_VERSION;
  });

  const total = pending.length;
  if (!total) return cache;

  let done = 0;
  let cursor = 0;
  let buffer = [];

  const flush = async () => {
    if (!buffer.length) return;
    const batch = buffer;
    buffer = [];
    await idbSetMany(batch, ARTWORK_STORE);
  };

  const worker = async () => {
    while (cursor < pending.length) {
      if (cancelRef && cancelRef.current) return;
      const cover = pending[cursor++];
      try {
        const analysis = await analyzeOne(cover.url300 || cover.url640);
        cache.set(cover.albumId, analysis);
        buffer.push([vibeKey(cover.albumId), analysis]);
      } catch (e) {
        // A cover that won't decode (404, CORS hiccup, corrupt jpeg) shouldn't
        // stall the run — record a stub so we don't retry it every session.
        const stub = { failed: true, v: VIBE_ANALYSIS_VERSION, tags: [] };
        cache.set(cover.albumId, stub);
        buffer.push([vibeKey(cover.albumId), stub]);
      }
      done += 1;
      if (onProgress) onProgress({ done, total });
      if (buffer.length >= FLUSH_EVERY) await flush();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
  );
  await flush();
  return cache;
}
