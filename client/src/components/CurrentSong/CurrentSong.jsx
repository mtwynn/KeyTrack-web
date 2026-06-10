import React from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Typography,
} from "@material-ui/core";
import { Refresh, MusicNote } from "@material-ui/icons";
import Spotify from "spotify-web-api-js";

import KeyMap from "../../utils/KeyMap";
import { camelotColor } from "../../utils/harmonic";

// Compact "now playing" widget designed to live in the slide-out drawer on both
// desktop and mobile. Click Refresh to read the currently playing track and
// show its key / Camelot / BPM.
let CurrentSong = (props) => {
  const [name, setName] = React.useState("Nothing playing");
  const [musicalKey, setMusicalKey] = React.useState(null);
  const [camelot, setCamelot] = React.useState(null);
  const [bpm, setBpm] = React.useState("");
  const [mode, setMode] = React.useState(-1);
  const [image, setImage] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  const clearTrack = () => {
    setName("Nothing playing");
    setMusicalKey(null);
    setCamelot(null);
    setBpm("");
    setMode(-1);
    setImage(null);
  };

  const getNowPlaying = () => {
    setLoading(true);
    spotifyWebApi
      .getMyCurrentPlaybackState()
      .then((response) => {
        if (!response || !response.item) {
          setLoading(false);
          clearTrack();
          return;
        }

        setName(response.item.name);
        setImage(
          response.item.album.images[0]
            ? response.item.album.images[0].url
            : null
        );

        spotifyWebApi
          .getAudioAnalysisForTrack(response.item.id)
          .then((analysis) => {
            setLoading(false);
            setBpm(Math.round(analysis.track.tempo));
            setMusicalKey(KeyMap[analysis.track.key].key);
            setMode(analysis.track.mode);
            setCamelot(
              KeyMap[analysis.track.key].camelot[analysis.track.mode]
            );
          })
          // Audio analysis can fail (e.g. local/unavailable tracks); keep the
          // track name but skip the key/BPM rather than crashing.
          .catch(() => setLoading(false));
      })
      // Previously unhandled — a failed call rejects with a raw XHR and tripped
      // the dev error overlay. Fail gracefully instead.
      .catch(() => {
        setLoading(false);
        clearTrack();
      });
  };

  const color = camelot ? camelotColor(camelot) : null;
  const playing = name !== "Nothing playing";

  // Slim inline variant for the desktop top bar: tiny art + track + key/BPM
  // and a small refresh button.
  if (props.compact) {
    return (
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 300,
          paddingLeft: 8,
          borderLeft: "1px solid rgba(128,128,128,0.25)",
        }}
      >
        {playing && image ? (
          <Avatar variant="rounded" src={image} style={{ width: 28, height: 28 }} />
        ) : (
          <MusicNote
            fontSize="small"
            style={{ color: "rgba(128,128,128,0.7)" }}
          />
        )}
        <Box style={{ minWidth: 0, maxWidth: 170 }}>
          <Typography
            variant="caption"
            noWrap
            style={{ fontWeight: 600, lineHeight: 1.15, display: "block" }}
            title={playing ? name : "Nothing playing"}
          >
            {playing ? name : "Nothing playing"}
          </Typography>
          {playing && camelot && (
            <Typography
              variant="caption"
              color="textSecondary"
              noWrap
              style={{ lineHeight: 1.15, display: "block" }}
            >
              {camelot} · {bpm} BPM
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={getNowPlaying}
          disabled={!props.token || loading}
          title="Refresh now playing"
          aria-label="refresh now playing"
        >
          {loading ? <CircularProgress size={15} /> : <Refresh fontSize="small" />}
        </IconButton>
      </Box>
    );
  }

  return (
    <Box style={{ width: "100%" }}>
      <Typography variant="overline" color="textSecondary">
        Now Playing
      </Typography>

      <Box style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <Avatar variant="rounded" src={image} style={{ width: 46, height: 46 }} />
        <Typography
          variant="body2"
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Typography>
      </Box>

      {camelot && (
        <Box style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <Chip
            size="small"
            label={`${musicalKey} ${mode === 1 ? "Maj" : "Min"}`}
          />
          <Chip
            size="small"
            label={camelot}
            style={color ? { backgroundColor: color.bg, color: color.text } : {}}
          />
          <Chip size="small" label={`${bpm} BPM`} />
        </Box>
      )}

      <Button
        fullWidth
        variant="outlined"
        size="small"
        startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
        onClick={getNowPlaying}
        disabled={!props.token}
        style={{ marginTop: 12 }}
      >
        {loading ? "Checking…" : "Refresh now playing"}
      </Button>
    </Box>
  );
};

CurrentSong.propTypes = {
  token: PropTypes.string,
  compact: PropTypes.bool,
};

export default CurrentSong;
