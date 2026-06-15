import axios from "axios";

// Shared SoundCloud crate-list fetching for the unified PLLibrary grid.

// Build a fetcher for the SoundCloud backend proxy. SoundCloud uses the unusual
// `Authorization: OAuth <token>` header (not Bearer). On a 401 (expired access
// token) it refreshes once via onRefreshToken and retries — mirroring the
// Spotify session handling. Returns an async (path) => responseData.
export function buildScFetch({ token, backend, onRefreshToken }) {
  return async function scFetch(path, retried = false) {
    try {
      const res = await axios.get(backend + path, {
        headers: { Authorization: "OAuth " + token },
      });
      return res.data;
    } catch (e) {
      if (e.response && e.response.status === 401 && !retried && onRefreshToken) {
        const fresh = await onRefreshToken();
        if (fresh) {
          const res = await axios.get(backend + path, {
            headers: { Authorization: "OAuth " + fresh },
          });
          return res.data;
        }
      }
      throw e;
    }
  };
}

// Swap SoundCloud's small "-large" artwork variant for a bigger one.
const bigArtwork = (url) => (url ? url.replace("-large", "-t500x500") : null);

// Fetch the user's SoundCloud crates: Liked Tracks + Reposts as virtual crates
// (artwork from the first track) plus their playlists/sets. Returns a plain
// array of crate descriptors:
//   { id, kind: 'likes'|'reposts'|'playlist', name, owner, count, artwork, permalink }
export async function fetchSoundcloudCrates(scFetch) {
  const [playlists, likes, reposts] = await Promise.all([
    scFetch("/soundcloud/me/playlists").catch(() => ({ collection: [] })),
    scFetch("/soundcloud/me/likes/tracks").catch(() => ({ collection: [] })),
    scFetch("/soundcloud/me/reposts").catch(() => ({ collection: [] })),
  ]);

  const list = (d) => (d && d.collection ? d.collection : Array.isArray(d) ? d : []);
  const likeTracks = list(likes);
  const repostTracks = list(reposts);

  const result = [];
  // Liked + reposted tracks as virtual crates (artwork from first track).
  if (likeTracks.length) {
    result.push({
      id: "__sc_likes__",
      kind: "likes",
      name: "Liked Tracks",
      owner: "Your likes",
      count: likeTracks.length,
      artwork: bigArtwork(likeTracks[0] && likeTracks[0].artwork_url),
    });
  }
  if (repostTracks.length) {
    result.push({
      id: "__sc_reposts__",
      kind: "reposts",
      name: "Reposts",
      owner: "Your reposts",
      count: repostTracks.length,
      artwork: bigArtwork(repostTracks[0] && repostTracks[0].artwork_url),
    });
  }
  // The user's playlists / sets.
  list(playlists).forEach((p) => {
    result.push({
      id: p.urn || p.id,
      kind: "playlist",
      name: p.title,
      owner: p.user && p.user.username ? "by " + p.user.username : "",
      count: p.track_count,
      artwork:
        bigArtwork(p.artwork_url) ||
        bigArtwork(p.tracks && p.tracks[0] && p.tracks[0].artwork_url),
      permalink: p.permalink_url,
    });
  });

  return result;
}
