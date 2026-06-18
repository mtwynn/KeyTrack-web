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

// Shared (cross-device) cache of computed Spotify chord loops, keyed by Spotify
// track id. Like scAnalysis but for Spotify: a track's chords are computed once
// — from /audio-analysis chroma client-side — and reused everywhere, so we never
// re-hit Spotify for them. `chords: null` is cached too (a track with no clear
// loop, or one audio-analysis can't serve) so we don't keep retrying it.
const SP_CHORD_VERSION = 1;

export async function getSpotifyChordsBulk(ids) {
  const out = {};
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return out;
  try {
    const col = collection(getFirestore(), "spotifyChords");
    const chunks = [];
    for (let i = 0; i < uniq.length; i += 30) chunks.push(uniq.slice(i, i + 30));
    const snaps = await Promise.all(
      chunks.map((c) => getDocs(query(col, where(documentId(), "in", c))))
    );
    snaps.forEach((snap) =>
      snap.forEach((d) => {
        const x = d.data();
        if (x && x.version === SP_CHORD_VERSION) out[d.id] = x;
      })
    );
  } catch (e) {
    // offline / rules / not-initialized → just skip the cache
  }
  return out;
}

export async function saveSpotifyChords(id, chords, source) {
  try {
    await setDoc(doc(getFirestore(), "spotifyChords", id), {
      chords: chords && chords.length ? chords : null,
      source: source || "chroma",
      version: SP_CHORD_VERSION,
      computedAt: Date.now(),
    });
  } catch (e) {
    console.error("saveSpotifyChords failed", e);
  }
}
