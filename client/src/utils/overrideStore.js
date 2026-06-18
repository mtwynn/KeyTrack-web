import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";

// User overrides — kept in their OWN Firestore collection (not on the analysis
// docs, which get overwritten on re-analysis), keyed by track id, so a manual
// key/chord correction is PERMANENT and cross-device. Works for both sources:
// Spotify track ids are clean; SoundCloud urns ("soundcloud:tracks:123") get
// their ":"/"/" swapped for "_" (and don't collide with Spotify ids).
//   { keyOverride: <camelot|null>, chordsOverride: <["Em","A",…]|null> }
const docId = (id) => String(id).replace(/[:/]/g, "_");

export async function getOverridesBulk(ids) {
  const out = {};
  const back = {};
  const dids = [];
  [...new Set((ids || []).filter(Boolean))].forEach((id) => {
    const d = docId(id);
    if (!back[d]) {
      back[d] = id;
      dids.push(d);
    }
  });
  if (!dids.length) return out;
  try {
    const col = collection(getFirestore(), "overrides");
    const chunks = [];
    for (let i = 0; i < dids.length; i += 30) chunks.push(dids.slice(i, i + 30));
    const snaps = await Promise.all(
      chunks.map((c) => getDocs(query(col, where(documentId(), "in", c))))
    );
    snaps.forEach((snap) =>
      snap.forEach((d) => {
        out[back[d.id] || d.id] = d.data();
      })
    );
  } catch (e) {
    // offline / rules → just no overrides
  }
  return out;
}

// Merge a patch (e.g. { keyOverride } or { chordsOverride }); pass null in a
// field to clear it.
export async function saveOverride(id, patch) {
  try {
    await setDoc(
      doc(getFirestore(), "overrides", docId(id)),
      { ...patch, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (e) {
    console.error("saveOverride failed", e);
  }
}
