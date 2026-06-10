import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

// Per-user metadata about crates (playlists), stored under
// Users/{spotifyUserId}/crateMeta/{playlistId} as { favorite, hidden, tags,
// genres }. This PR uses favorite + hidden; tags/genres come next and reuse the
// same docs (writes merge, so fields don't clobber each other).
//
// Same security caveat as saved sets: relies on Firestore project rules (the
// app uses Spotify OAuth, not Firebase Auth).

export async function fetchCrateMeta(userId) {
  const snap = await getDocs(
    collection(getFirestore(), "Users", userId, "crateMeta")
  );
  const map = {};
  snap.docs.forEach((d) => {
    map[d.id] = d.data();
  });
  return map; // { [playlistId]: { favorite, hidden, tags, genres } }
}

export async function setCrateMeta(userId, playlistId, partial) {
  await setDoc(
    doc(getFirestore(), "Users", userId, "crateMeta", playlistId),
    partial,
    { merge: true }
  );
}
