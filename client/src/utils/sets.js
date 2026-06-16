import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

// Saved sets live in Firestore under Users/{spotifyUserId}/sets. Each set
// stores a self-contained, minimal copy of its tracks (id/uri/name/artists/
// image + key) so loading a saved set never needs to re-fetch from Spotify.
//
// NOTE: the app authenticates with Spotify (not Firebase Auth), so these rely
// on Firestore's project rules. Tightening them (Firebase Auth + rules) is a
// separate hardening step.

// SetBuilder entry ({ item, key }) -> compact storable record. SoundCloud
// entries also persist their source + a MINIMAL raw track (the fields the Widget
// player + now-playing need), so a reloaded set can still play them and resolve
// their key from the analysis cache.
const serializeEntry = (entry) => {
  const t = entry.item.track;
  const rec = {
    id: t.id || null,
    uri: t.uri || null,
    name: t.name || "",
    artists: (t.artists || []).map((a) => ({ name: a.name })),
    image: (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null,
    key: entry.key || null,
  };
  if (entry.item.__source === "soundcloud") {
    rec.source = "soundcloud";
    const raw = entry.item.__scRaw || {};
    rec.sc = {
      urn: raw.urn || null,
      id: raw.id || null,
      title: raw.title || t.name || "",
      permalink_url: raw.permalink_url || null,
      uri: raw.uri || null,
      sharing: raw.sharing || null,
      secret_uri: raw.secret_uri || null,
      secret_token: raw.secret_token || null,
      artwork_url: raw.artwork_url || null,
      user: { username: (raw.user && raw.user.username) || "" },
      duration: raw.duration || null,
    };
  }
  return rec;
};

// Stored record -> SetBuilder entry, reconstructing the shape the UI expects.
const deserializeTrack = (s) => {
  const item = {
    track: {
      id: s.id,
      uri: s.uri,
      name: s.name,
      artists: s.artists || [],
      album: { images: s.image ? [{ url: s.image }] : [] },
    },
  };
  if (s.source === "soundcloud") {
    item.__source = "soundcloud";
    item.__scRaw = s.sc || {};
  }
  return { item, key: s.key || null };
};

export const deserializeTracks = (tracks) =>
  (tracks || []).map(deserializeTrack);

const setsCollection = (userId) =>
  collection(getFirestore(), "Users", userId, "sets");

export async function fetchSets(userId) {
  const snap = await getDocs(setsCollection(userId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveSet(userId, { name, bpmThreshold, set }) {
  return addDoc(setsCollection(userId), {
    name,
    bpmThreshold,
    createdAt: Date.now(),
    tracks: set.map(serializeEntry),
  });
}

export async function updateSet(userId, setId, { name, bpmThreshold, set }) {
  return updateDoc(doc(getFirestore(), "Users", userId, "sets", setId), {
    name,
    bpmThreshold,
    tracks: set.map(serializeEntry),
    updatedAt: Date.now(),
  });
}

export async function deleteSet(userId, setId) {
  return deleteDoc(doc(getFirestore(), "Users", userId, "sets", setId));
}
