import React from "react";

import Playlist from "./Playlist";
import { camelotToKeyMode } from "../../utils/harmonic";
import { useScAnalysisQueue } from "../SoundCloud/useScAnalysisQueue";

// Parse a SoundCloud date string into the Spotify album.release_date shape so a
// SoundCloud track reuses the exact same release-date formatting as Spotify
// rows. Mirrors unifiedTrack's scReleaseDate regex: "YYYY-MM..." → "YYYY-MM-01",
// else a bare year. Returns { date, precision } or null.
function scReleaseDate(track) {
  const raw =
    track.display_date || track.release_date || track.created_at || null;
  if (!raw) return null;
  const m = /(\d{4})[-/](\d{1,2})/.exec(String(raw));
  if (m) {
    const mon = String(parseInt(m[2], 10)).padStart(2, "0");
    return { date: `${m[1]}-${mon}-01`, precision: "month" };
  }
  const y = /(\d{4})/.exec(String(raw));
  return y ? { date: y[1], precision: "year" } : null;
}

// A thin adapter that renders the combined (Spotify + SoundCloud) track view
// through the REAL Playlist component, so it is pixel-identical to the Spotify
// view. SoundCloud tracks are shaped like Spotify playlist items (carrying a
// __source tag + __scRaw so Playlist/Row can guard the few combined-only
// extras), and their keys are synthesized from our own analysis as it fills in.
let CombinedPlaylist = (props) => {
  const {
    open,
    onClose,
    title,
    spotifyItems,
    spotifyFeatures,
    scTracks,
    scFetch,
    token,
    userId,
    updatePlayer,
    onPlaySoundcloud,
    onAddToSet,
    onOpenSet,
    setCount,
  } = props;

  const { analysis, enqueueAll } = useScAnalysisQueue(scFetch);

  // Auto-analyze the SoundCloud tracks on open so their key/BPM fill in live.
  React.useEffect(() => {
    if (open && scTracks && scTracks.length) enqueueAll(scTracks);
  }, [open, scTracks, enqueueAll]);

  // Spotify items pass through (tagged); SoundCloud tracks are reshaped into the
  // Spotify playlist-item shape Playlist/Row consume.
  const items = React.useMemo(() => {
    const sp = (spotifyItems || []).map((it) => ({ ...it, __source: "spotify" }));
    const sc = (scTracks || []).map((t) => {
      const rel = scReleaseDate(t);
      return {
        added_at: null,
        __source: "soundcloud",
        __scRaw: t,
        track: {
          id: t.urn || String(t.id),
          name: t.title,
          artists: [{ name: (t.user && t.user.username) || "" }],
          album: {
            images: t.artwork_url ? [{ url: t.artwork_url }] : [],
            release_date: rel ? rel.date : undefined,
            release_date_precision: rel ? rel.precision : undefined,
          },
          uri: null,
          duration_ms: t.duration || null,
          external_urls: {},
        },
      };
    });
    return [...sp, ...sc];
  }, [spotifyItems, scTracks]);

  // Spotify audio-features pass through; SoundCloud keys are synthesized from
  // our analysis (Camelot → Spotify-style key/mode) keyed by the same synthetic
  // track id used above, so getKey resolves them. Rows without analysis yet are
  // omitted and render as "N/A" until their result arrives.
  const playlistKeys = React.useMemo(() => {
    const scKeys = (scTracks || [])
      .map((t) => {
        const urn = t.urn || String(t.id);
        const a = analysis[urn];
        if (!a || !a.camelot) return null;
        const km = camelotToKeyMode(a.camelot);
        if (!km) return null;
        return { id: urn, key: km.key, mode: km.mode, tempo: a.bpm, energy: null };
      })
      .filter(Boolean);
    return [...(spotifyFeatures || []), ...scKeys];
  }, [spotifyFeatures, scTracks, analysis]);

  return (
    <Playlist
      open={open}
      handlePlaylistClose={onClose}
      playlistName={title}
      playlistId="__combined__"
      playlistOwnerId={null}
      playlist={items}
      playlistKeys={playlistKeys}
      token={token}
      userId={userId}
      updatePlayer={updatePlayer}
      onPlaySoundcloud={onPlaySoundcloud}
      onAddToSet={onAddToSet}
      onOpenSet={onOpenSet}
      setCount={setCount}
    />
  );
};

export default CombinedPlaylist;
