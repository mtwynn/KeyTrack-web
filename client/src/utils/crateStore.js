// Tiny IndexedDB key/value store for the persistent crate cache (track lists +
// audio features). IndexedDB (not localStorage) because the values are large
// and structured — it handles MBs of objects via structured clone, no JSON.
// Every value is wrapped as { __v, data } where __v is a version token
// (Spotify snapshot_id / SoundCloud track-count) so a stale crate auto-refetches
// when it actually changed. All ops fail silently (offline / private mode).

const DB_NAME = "keytrack";
const STORE = "crates";
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

export async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function idbSet(key, val) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch (e) {
    // ignore (quota / private mode) — falls back to the in-memory cache
  }
}
