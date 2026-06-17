import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";

// Shared cache of our computed SoundCloud key/BPM, keyed by track URN and
// shared across all users (it's analysis of public tracks). A track is only
// ever analyzed once for the whole app — everyone reuses the result, and it
// never re-spends the play quota. Mirrors crateMeta.js (relies on the Firebase
// app initialized in Playlist.jsx; no Firebase Auth).
//
// Bump ENGINE_VERSION to invalidate every cached analysis if the engine
// changes (so old/worse results get recomputed).
//   v2: BPM detection moved from bpm-tools to madmom (band-constrained,
//       genre-aware) — far better tempo octave resolution, so re-analyze.
//   v3: added chord-loop detection (madmom) — recompute to backfill `chords`.
//   v4: some v3 docs were written (in a pre-deploy test window) before the
//       chord analysis-service was live, so they're "v3 but chord-less" and
//       cache-stuck — re-analyze through the now-live chord service.
const ENGINE_VERSION = 4;

// Firestore doc ids can't contain "/" — urns look like "soundcloud:tracks:123".
const keyId = (urn) => String(urn).replace(/[:/]/g, "_");

export async function getScAnalysis(urn) {
  try {
    const snap = await getDoc(doc(getFirestore(), "scAnalysis", keyId(urn)));
    const d = snap.exists() ? snap.data() : null;
    return d && d.engineVersion === ENGINE_VERSION ? d : null;
  } catch (e) {
    return null; // offline / rules / not-initialized → just skip the cache
  }
}

// Bulk-read cached analyses for many urns in PARALLEL, returning { [urn]: data }
// for the hits. Opening a crate of already-analyzed tracks previously did N
// SERIAL getDoc reads through the single-worker queue (~seconds); this does it
// in a handful of `documentId() in` queries (≤30 ids each) run concurrently.
export async function getScAnalysisBulk(urns) {
  const out = {};
  const ids = [];
  const idToUrn = {};
  (urns || []).forEach((u) => {
    const id = keyId(u);
    if (!idToUrn[id]) {
      idToUrn[id] = u;
      ids.push(id);
    }
  });
  if (!ids.length) return out;
  try {
    const col = collection(getFirestore(), "scAnalysis");
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const snaps = await Promise.all(
      chunks.map((c) => getDocs(query(col, where(documentId(), "in", c))))
    );
    snaps.forEach((snap) =>
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && d.engineVersion === ENGINE_VERSION) {
          out[idToUrn[docSnap.id] || docSnap.id] = d;
        }
      })
    );
  } catch (e) {
    // Any failure → return whatever hits we have; the queue analyzes the rest.
  }
  return out;
}

export async function saveScAnalysis(urn, data) {
  try {
    await setDoc(doc(getFirestore(), "scAnalysis", keyId(urn)), {
      ...data,
      urn,
      engineVersion: ENGINE_VERSION,
      analyzedAt: Date.now(),
    });
  } catch (e) {
    console.error("saveScAnalysis failed", e);
  }
}

// Persist a user's manual BPM correction onto the cached analysis doc (pass
// null to clear it). Merges so it never clobbers the rest of the analysis, and
// because it's on the shared doc the correction sticks for every view + session.
export async function saveScBpmOverride(urn, bpm) {
  try {
    await setDoc(
      doc(getFirestore(), "scAnalysis", keyId(urn)),
      { bpmOverride: bpm == null ? null : Math.round(bpm), urn },
      { merge: true }
    );
  } catch (e) {
    console.error("saveScBpmOverride failed", e);
  }
}
