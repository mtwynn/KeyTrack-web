import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

// User-created KeyTrack folders, stored under Users/{spotifyUserId}/folders.
// A crate's folder is recorded in its crateMeta.folderId; crates with no
// (or a dangling) folderId live at the top-level "root". Single level for now.

const foldersCol = (userId) =>
  collection(getFirestore(), "Users", userId, "folders");

export async function fetchFolders(userId) {
  const snap = await getDocs(foldersCol(userId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function addFolder(userId, name) {
  return addDoc(foldersCol(userId), { name, createdAt: Date.now() });
}

export async function renameFolder(userId, id, name) {
  return updateDoc(doc(getFirestore(), "Users", userId, "folders", id), {
    name,
  });
}

export async function deleteFolder(userId, id) {
  return deleteDoc(doc(getFirestore(), "Users", userId, "folders", id));
}
