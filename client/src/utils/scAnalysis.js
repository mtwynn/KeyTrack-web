import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Shared cache of our computed SoundCloud key/BPM, keyed by track URN and
// shared across all users (it's analysis of public tracks). A track is only
// ever analyzed once for the whole app — everyone reuses the result, and it
// never re-spends the play quota. Mirrors crateMeta.js (relies on the Firebase
// app initialized in Playlist.jsx; no Firebase Auth).
//
// Bump ENGINE_VERSION to invalidate every cached analysis if the engine
// changes (so old/worse results get recomputed).
const ENGINE_VERSION = 1;

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
