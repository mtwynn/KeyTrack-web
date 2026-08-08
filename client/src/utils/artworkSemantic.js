// Tier 2 semantic layer: Gemini vision tags + embeddings for meaning-based
// search. Talks only to our own backend — the Gemini key never reaches the
// browser.
//
// Keyed by albumId so each unique cover is analyzed exactly once, ever. Results
// persist in IndexedDB, so the spend is one-time and a reload costs nothing.
//
// Embeddings are stored unit-normalized and int8-quantized: 768 dims -> 768
// bytes per cover (~1.1MB for 1,500 covers) instead of 3KB as float32. Because
// the vectors are normalized, cosine similarity is just a dot product.

import { ARTWORK_STORE, idbGetAll, idbSetMany } from "./crateStore";

export const SEMANTIC_VERSION = 1;

// The backend paces every Gemini call against its RPM quota, so the client's
// job is simply not to pile on. Concurrency 1 keeps one request in flight;
// batch size comes from /artwork/status so it always matches what the server
// can pace through inside Heroku's 30s request limit.
const DEFAULT_VISION_BATCH = 4;
const EMBED_BATCH = 64;

export const semKey = (albumId) => `sem:${albumId}`;

export async function fetchSemanticStatus(backendBase) {
  try {
    const res = await fetch(`${backendBase}/artwork/status`);
    if (!res.ok) return { semanticAvailable: false };
    return await res.json();
  } catch (e) {
    return { semanticAvailable: false };
  }
}

export async function loadSemanticCache() {
  const all = await idbGetAll(ARTWORK_STORE);
  const out = new Map();
  all.forEach((val, key) => {
    if (typeof key === "string" && key.startsWith("sem:") && val) {
      out.set(key.slice(4), val);
    }
  });
  return out;
}

// --- embedding helpers ----------------------------------------------------

export function quantizeEmbedding(values) {
  let norm = 0;
  for (let i = 0; i < values.length; i++) norm += values[i] * values[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Int8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.max(-127, Math.min(127, Math.round((values[i] / norm) * 127)));
  }
  return out;
}

// Both vectors are unit-normalized then scaled by 127, so a self-dot-product
// comes to 127^2 — that, not 127^2 * length, is the normalizing constant.
export function cosineInt8(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (127 * 127);
}

/**
 * Analyze covers that have no semantic record yet.
 *
 * @param {Map}      covers      albumId -> { url640, url300 }
 * @param {Map}      cache       existing semantic records (mutated in place)
 * @param {string}   backendBase
 * @param {function} onProgress  ({ done, total, rateLimited })
 * @param {object}   cancelRef   { current: bool }
 * @param {number}   limit       max covers this run (protects a daily quota)
 */
export async function runSemanticAnalysis({
  covers,
  cache,
  backendBase,
  onProgress,
  cancelRef,
  limit = Infinity,
  batchSize = DEFAULT_VISION_BATCH,
}) {
  const pending = [...covers.values()]
    .filter((c) => {
      const hit = cache.get(c.albumId);
      // Don't retry permanent failures forever, but do re-run when the prompt
      // or schema version changes.
      if (!hit) return true;
      if (hit.v !== SEMANTIC_VERSION) return true;
      return false;
    })
    .slice(0, limit === Infinity ? undefined : limit);

  const total = pending.length;
  const result = { analyzed: 0, failed: 0, rateLimited: false, total, done: 0 };
  if (!total) return result;

  const size = Math.max(1, batchSize);
  const batches = [];
  for (let i = 0; i < pending.length; i += size) {
    batches.push(pending.slice(i, i + size));
  }

  let done = 0;
  const writeBuffer = [];
  const newlyDescribed = [];

  // Sequential batches. The previous version ran three in parallel with six
  // images each — 18 concurrent calls against a 15/min free-tier quota, which
  // rate-limited almost immediately.
  for (const batch of batches) {
    if (cancelRef && cancelRef.current) break;

    let res;
    try {
      res = await fetch(`${backendBase}/artwork/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: batch.map((c) => ({
            albumId: c.albumId,
            // 300px is enough for Gemini to read the scene and costs far fewer
            // input tokens than 640.
            url: c.url300 || c.url640,
          })),
        }),
      });
    } catch (e) {
      result.failed += batch.length;
      done += batch.length;
      continue;
    }

    if (res.status === 503) {
      result.rateLimited = true; // not configured — stop trying
      break;
    }

    let body;
    try {
      body = await res.json();
    } catch (e) {
      result.failed += batch.length;
      done += batch.length;
      continue;
    }

    (body.results || []).forEach((r) => {
      if (!r || !r.albumId) return;
      if (r.ok) {
        const rec = {
          v: SEMANTIC_VERSION,
          description: r.description || "",
          subjects: r.subjects || [],
          topics: r.topics || [],
          style: r.style || [],
          mood: r.mood || [],
          medium: r.medium || "",
          hasFace: !!r.hasFace,
          hasText: !!r.hasText,
        };
        cache.set(r.albumId, rec);
        writeBuffer.push([semKey(r.albumId), rec]);
        if (rec.description) {
          newlyDescribed.push({ albumId: r.albumId, text: semanticText(rec) });
        }
        result.analyzed += 1;
      } else if (r.status !== 429) {
        // A 429'd image was never analyzed, so it stays pending rather than
        // counting as a failure — the next pass picks it up.
        result.failed += 1;
      }
    });

    done += batch.length;
    result.done = Math.min(done, total);

    // Persist as we go so a refresh mid-run never loses completed work.
    if (writeBuffer.length >= 20) {
      await idbSetMany(writeBuffer.splice(0), ARTWORK_STORE);
    }

    if (body.rateLimited) {
      // Gemini tells us exactly how long to wait, so pause and resume instead
      // of aborting the whole run.
      const waitSec = body.retryAfterSec || 30;
      result.rateLimited = true;
      if (onProgress) {
        onProgress({ ...result, waitingSec: waitSec });
      }
      const until = Date.now() + waitSec * 1000;
      while (Date.now() < until) {
        if (cancelRef && cancelRef.current) break;
        await new Promise((r) => setTimeout(r, 500));
        if (onProgress) {
          onProgress({
            ...result,
            waitingSec: Math.max(0, Math.ceil((until - Date.now()) / 1000)),
          });
        }
      }
      result.rateLimited = false;
      // Re-queue the images this batch couldn't get through.
      const missed = batch.filter((c) => !cache.get(c.albumId));
      if (missed.length) {
        batches.push(missed);
        done -= missed.length;
      }
    }

    if (onProgress) onProgress({ ...result, waitingSec: 0 });
  }

  if (writeBuffer.length) await idbSetMany(writeBuffer, ARTWORK_STORE);

  // Embed descriptions so free-text search works over meaning, not keywords.
  if (newlyDescribed.length) {
    await embedRecords(newlyDescribed, cache, backendBase, cancelRef);
  }

  return result;
}

// The text we embed: description plus tags, so both prose queries and tag-like
// queries land near the right covers.
export function semanticText(rec) {
  return [
    rec.description,
    (rec.subjects || []).join(", "),
    (rec.topics || []).join(", "),
    (rec.style || []).join(", "),
    (rec.mood || []).join(", "),
    rec.medium,
  ]
    .filter(Boolean)
    .join(". ");
}

async function embedRecords(items, cache, backendBase, cancelRef) {
  for (let i = 0; i < items.length; i += EMBED_BATCH) {
    if (cancelRef && cancelRef.current) return;
    const batch = items.slice(i, i + EMBED_BATCH);
    try {
      const res = await fetch(`${backendBase}/artwork/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: batch.map((b) => b.text) }),
      });
      if (!res.ok) continue;
      const body = await res.json();
      const writes = [];
      (body.embeddings || []).forEach((vec, idx) => {
        const item = batch[idx];
        if (!item || !vec || !vec.length) return;
        const rec = cache.get(item.albumId);
        if (!rec) return;
        rec.embedding = quantizeEmbedding(vec);
        cache.set(item.albumId, rec);
        writes.push([semKey(item.albumId), rec]);
      });
      if (writes.length) await idbSetMany(writes, ARTWORK_STORE);
    } catch (e) {
      // Embedding is an enhancement — tags still work without it.
    }
  }
}

// Embed a search query so it can be compared against cover embeddings.
export async function embedQuery(text, backendBase) {
  try {
    const res = await fetch(`${backendBase}/artwork/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const vec = body.embeddings && body.embeddings[0];
    return vec && vec.length ? quantizeEmbedding(vec) : null;
  } catch (e) {
    return null;
  }
}
