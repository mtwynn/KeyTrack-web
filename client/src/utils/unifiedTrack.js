import KeyMap from "./KeyMap";
import { formatReleaseDate } from "./release";

// A track normalized to one source-agnostic shape so the combined browser can
// render Spotify and SoundCloud tracks in a single table. Only the harmonic
// language (Camelot/BPM) is unified — source-specific fields (energy/released
// for Spotify, genre for SoundCloud) stay populated for one source and null for
// the other, which the superset columns render as blanks.
//
//   uid          unique React key across sources ('sp:<id>' / 'sc:<urn>')
//   source       'spotify' | 'soundcloud'
//   camelot      Camelot code (both sources) | null if unknown/not-yet-analyzed
//   energy       0..1 (Spotify) | null
//   genre        string (SoundCloud) | null
//   released     formatted date string (Spotify) | null
//   spotifyUri   for Web Playback (Spotify) | null
//   externalUrl  permalink to open on the source
//   raw          the original item/track (for playback + per-source actions)

// Spotify playlist item + its audio-features ({ key, mode, bpm, energy } from
// Playlist's getKey, or null) -> unified.
export function spotifyToUnified(item, feat) {
  const t = item.track;
  const km = feat && feat.key != null ? KeyMap[feat.key] : null;
  return {
    uid: "sp:" + t.id,
    source: "spotify",
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(", "),
    artwork: t.album && t.album.images[0] ? t.album.images[0].url : null,
    camelot: km ? km.camelot[feat.mode] : null,
    keyName: km ? km.key : null,
    mode: feat ? feat.mode : null,
    bpm: feat && feat.bpm != null ? Math.round(feat.bpm) : null,
    energy: feat && feat.energy != null ? feat.energy : null,
    genre: null,
    released: formatReleaseDate(t),
    durationMs: t.duration_ms || null,
    externalUrl: t.external_urls ? t.external_urls.spotify : null,
    spotifyUri: t.uri,
    raw: item,
  };
}

// SoundCloud track + our analysis ({ camelot, key, bpm } or null) -> unified.
// Analysis is lazy, so callers re-derive (or overlay) as results arrive.
export function soundcloudToUnified(track, analysis) {
  const a = analysis && analysis.camelot ? analysis : null;
  return {
    uid: "sc:" + (track.urn || track.id),
    source: "soundcloud",
    title: track.title,
    artist: track.user && track.user.username ? track.user.username : "",
    artwork: track.artwork_url || null,
    camelot: a ? a.camelot : null,
    keyName: a ? a.key : null,
    mode: null,
    bpm: a && a.bpm != null ? a.bpm : null,
    energy: null,
    genre: track.genre || null,
    released: null,
    durationMs: track.duration || null,
    externalUrl: track.permalink_url || null,
    spotifyUri: null,
    raw: track,
  };
}

// Sort rank for a Camelot code ("8B" -> 17) so a key column sorts around the
// wheel; unknown keys sort last. Shared by the combined browser.
export function camelotRank(c) {
  const m = /(\d+)([AB])/.exec(c || "");
  return m ? parseInt(m[1], 10) * 2 + (m[2] === "B" ? 1 : 0) : 9999;
}

export function fmtDuration(ms) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
