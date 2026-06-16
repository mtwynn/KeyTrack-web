import KeyMap from "./KeyMap";
import { formatReleaseDate, releaseYear } from "./release";

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
    releaseYear: releaseYear(t),
    durationMs: t.duration_ms || null,
    externalUrl: t.external_urls ? t.external_urls.spotify : null,
    spotifyUri: t.uri,
    raw: item,
  };
}

// SoundCloud track + our analysis ({ camelot, key, bpm } or null) -> unified.
// Analysis is lazy, so callers re-derive (or overlay) as results arrive.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// SoundCloud release/upload date — display_date is what SoundCloud itself shows
// (the artist's release date if set, else the upload date), with created_at as
// a fallback. Formats like "2024-03-15T..." or "2024/03/15 12:00:00 +0000".
// Returns { released: "Mar 2024" | "2024" | null, releaseYear: number | null }.
function scReleaseDate(track) {
  const raw = track.display_date || track.release_date || track.created_at || null;
  if (!raw) return { released: null, releaseYear: null };
  const m = /(\d{4})[-/](\d{1,2})/.exec(String(raw));
  if (m) {
    const year = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    return {
      released: mon >= 1 && mon <= 12 ? `${MONTHS[mon - 1]} ${year}` : String(year),
      releaseYear: year,
    };
  }
  const y = /(\d{4})/.exec(String(raw));
  return y
    ? { released: y[1], releaseYear: parseInt(y[1], 10) }
    : { released: null, releaseYear: null };
}

export function soundcloudToUnified(track, analysis) {
  const a = analysis && analysis.camelot ? analysis : null;
  const rel = scReleaseDate(track);
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
    released: rel.released,
    releaseYear: rel.releaseYear,
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
