// Tiny IndexedDB key/value store for the persistent crate cache (track lists +
// audio features). IndexedDB (not localStorage) because the values are large
// and structured — it handles MBs of objects via structured clone, no JSON.
// Every value is wrapped as { __v, data } where __v is a version token
// (Spotify snapshot_id / SoundCloud track-count) so a stale crate auto-refetches
// when it actually changed. All ops fail silently (offline / private mode).
//
// v2 adds the ARTWORK store for Artwork Explorer (per-album vibe analysis and
// embeddings). It lives in the same database so there's one connection and one
// upgrade path; the stores are otherwise independent.

const DB_NAME = "keytrack";
const DB_VERSION = 2;
export const CRATE_STORE = "crates";
export const ARTWORK_STORE = "artwork";
const STORES = [CRATE_STORE, ARTWORK_STORE];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        // Additive only — never delete `crates`, which holds the cached track
        // lists an upgrading user already has.
        STORES.forEach((name) => {
          if (!req.result.objectStoreNames.contains(name)) {
            req.result.createObjectStore(name);
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      // Another tab holds the old version open; it will resolve once that tab
      // closes rather than hanging forever on a rejected promise.
      req.onblocked = () => reject(new Error("indexeddb_blocked"));
    } catch (e) {
      reject(e);
    }
  });
  // A failed open must not be cached, or every later call reuses the rejection.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export async function idbGet(key, store = CRATE_STORE) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, "readonly");
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function idbSet(key, val, store = CRATE_STORE) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch (e) {
    // ignore (quota / private mode) — falls back to the in-memory cache
  }
}

// Bulk read of a whole store as a Map. Artwork Explorer needs every cached
// analysis at once to filter/sort, and one cursor pass is far cheaper than
// thousands of individual gets.
export async function idbGetAll(store = ARTWORK_STORE) {
  const out = new Map();
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        out.set(cursor.key, cursor.value);
        cursor.continue();
      };
      req.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch (e) {
    // ignore — caller treats an empty map as "nothing analyzed yet"
  }
  return out;
}

// Write many entries in ONE transaction. Analysis persists incrementally in
// batches; a transaction per record would be an order of magnitude slower.
export async function idbSetMany(entries, store = ARTWORK_STORE) {
  if (!entries.length) return;
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      entries.forEach(([key, val]) => os.put(val, key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch (e) {
    // ignore (quota / private mode)
  }
}
