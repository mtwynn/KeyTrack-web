import React from "react";
import axios from "axios";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  makeStyles,
  withStyles,
} from "@material-ui/core";
import {
  Cloud,
  MusicNote,
  Favorite,
  Repeat,
  ArrowBack,
  OpenInNew,
  PlayArrow,
} from "@material-ui/icons";

// SoundCloud's brand orange — used for the source badge so SoundCloud crates
// are always visually distinct from Spotify's green (strict source separation).
const SC_ORANGE = "#ff5500";

// Tracks longer than this are almost certainly DJ sets/mixes — their key/BPM
// wander across the whole thing, so analyzing them is meaningless. We flag them
// as "Set" and exclude them from analysis. ~6 min is a heuristic; one constant
// so it's easy to tune.
const LIKELY_SET_MS = 6 * 60 * 1000;
const isLikelySet = (ms) => ms && ms > LIKELY_SET_MS;

const useStyles = makeStyles((theme) => ({
  tile: {
    cursor: "pointer",
    borderRadius: 12,
    overflow: "hidden",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    border: "1px solid rgba(128,128,128,0.18)",
    transition: "all 0.18s ease-in-out",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: theme.shadows[6],
    },
  },
  cover: {
    position: "relative",
    height: 130,
    backgroundColor: "#191414",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  scBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    display: "flex",
    alignItems: "center",
    gap: 4,
    backgroundColor: SC_ORANGE,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 12,
  },
  body: { flex: 1, padding: theme.spacing(1.5) },
  title: { fontWeight: 600, fontSize: "1.05rem" },
  owner: { fontSize: "0.8rem", color: theme.palette.text.secondary },
  trackChip: {
    backgroundColor: SC_ORANGE,
    color: "#fff",
    fontWeight: 600,
    height: 24,
    marginTop: theme.spacing(1),
  },
}));

// Swap SoundCloud's small "-large" artwork variant for a bigger one.
const bigArtwork = (url) =>
  url ? url.replace("-large", "-t500x500") : null;

const fmtDuration = (ms) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

// Orange table header to match the SoundCloud source color.
const ScHeadCell = withStyles({
  head: { backgroundColor: SC_ORANGE, color: "#fff", fontWeight: "bold" },
})(TableCell);

let SoundCloudLibrary = (props) => {
  const classes = useStyles();
  const [crates, setCrates] = React.useState(null);
  const [error, setError] = React.useState(null);
  // Crate-detail view: the opened crate + its tracks (null while loading).
  const [opened, setOpened] = React.useState(null);
  const [tracks, setTracks] = React.useState(null);
  // The track currently loaded into the embedded SoundCloud Widget player.
  const [playing, setPlaying] = React.useState(null);

  // Call the backend proxy with the SoundCloud token. On a 401 (expired access
  // token) refresh once and retry, mirroring the Spotify session handling.
  const scFetch = React.useCallback(
    async (path, retried = false) => {
      try {
        const res = await axios.get(props.backend + path, {
          headers: { Authorization: "OAuth " + props.token },
        });
        return res.data;
      } catch (e) {
        if (e.response && e.response.status === 401 && !retried && props.onRefreshToken) {
          const fresh = await props.onRefreshToken();
          if (fresh) {
            const res = await axios.get(props.backend + path, {
              headers: { Authorization: "OAuth " + fresh },
            });
            return res.data;
          }
        }
        throw e;
      }
    },
    [props]
  );

  // Open a crate → fetch its tracks. Likes/reposts have their own endpoints;
  // a playlist's tracks come from /playlists/:urn/tracks.
  const openCrate = async (crate) => {
    setOpened(crate);
    setTracks(null);
    const path =
      crate.kind === "likes"
        ? "/soundcloud/me/likes/tracks"
        : crate.kind === "reposts"
        ? "/soundcloud/me/reposts"
        : "/soundcloud/playlists/" + encodeURIComponent(crate.id) + "/tracks";
    try {
      const data = await scFetch(path);
      const list = data && data.collection ? data.collection : Array.isArray(data) ? data : [];
      // Likes/reposts come back as { track: {...} } wrappers on some endpoints.
      setTracks(list.map((t) => (t && t.track ? t.track : t)).filter(Boolean));
    } catch (e) {
      console.error("Failed to load SoundCloud crate", e);
      setTracks([]);
    }
  };

  const closeCrate = () => {
    setOpened(null);
    setTracks(null);
    setPlaying(null);
  };

  // SoundCloud's sanctioned HTML5 Widget (iframe) — ToS-compliant playback with
  // no OAuth. Public tracks resolve from the permalink; PRIVATE tracks need
  // their secret (secret_uri, or the permalink with a secret_token) or the
  // widget 403s.
  const widgetSrc = (track) => {
    let url = track.permalink_url || track.uri;
    if (track.sharing === "private") {
      if (track.secret_uri) {
        url = track.secret_uri;
      } else if (track.secret_token) {
        const base = track.permalink_url || track.uri;
        url = base + (base.indexOf("?") >= 0 ? "&" : "?") +
          "secret_token=" + track.secret_token;
      }
    }
    return (
      "https://w.soundcloud.com/player/?url=" +
      encodeURIComponent(url) +
      "&color=%23ff5500&auto_play=true&show_comments=false&visual=false"
    );
  };

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [playlists, likes, reposts] = await Promise.all([
          scFetch("/soundcloud/me/playlists").catch(() => ({ collection: [] })),
          scFetch("/soundcloud/me/likes/tracks").catch(() => ({ collection: [] })),
          scFetch("/soundcloud/me/reposts").catch(() => ({ collection: [] })),
        ]);
        if (cancelled) return;

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
              bigArtwork(
                p.tracks && p.tracks[0] && p.tracks[0].artwork_url
              ),
            permalink: p.permalink_url,
          });
        });

        setCrates(result);
      } catch (e) {
        console.error("Failed to load SoundCloud library", e);
        if (!cancelled) setError("Couldn't load your SoundCloud library.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [scFetch]);

  const kindIcon = (kind) => {
    if (kind === "likes") return <Favorite style={{ color: "#fff", fontSize: 40 }} />;
    if (kind === "reposts") return <Repeat style={{ color: "#fff", fontSize: 40 }} />;
    return <MusicNote style={{ color: "#fff", fontSize: 40, opacity: 0.85 }} />;
  };

  // Crate detail: the opened crate's track table.
  if (opened) {
    return (
      <Box style={{ padding: 16 }}>
        <Box
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
        >
          <IconButton size="small" onClick={closeCrate} title="Back to crates">
            <ArrowBack />
          </IconButton>
          <Cloud style={{ color: SC_ORANGE }} />
          <Typography variant="h6" style={{ fontWeight: 700 }} noWrap>
            {opened.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {opened.count} tracks
          </Typography>
        </Box>

        {playing && (
          <Box style={{ marginBottom: 12 }}>
            <iframe
              title="SoundCloud player"
              width="100%"
              height="120"
              scrolling="no"
              frameBorder="no"
              allow="autoplay"
              src={widgetSrc(playing)}
              style={{ borderRadius: 8 }}
            />
          </Box>
        )}

        {!tracks ? (
          <Box style={{ padding: 48, textAlign: "center" }}>
            <CircularProgress style={{ color: SC_ORANGE }} />
          </Box>
        ) : tracks.length === 0 ? (
          <Typography color="textSecondary" style={{ padding: 16 }}>
            No tracks in this crate.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <ScHeadCell></ScHeadCell>
                <ScHeadCell>Track</ScHeadCell>
                <ScHeadCell>Artist</ScHeadCell>
                <ScHeadCell>Key</ScHeadCell>
                <ScHeadCell>BPM</ScHeadCell>
                <ScHeadCell>Genre</ScHeadCell>
                <ScHeadCell>Length</ScHeadCell>
                <ScHeadCell></ScHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tracks.map((t) => {
                const tid = t.urn || t.id;
                const isPlaying = playing && (playing.urn || playing.id) === tid;
                return (
                <TableRow
                  key={tid}
                  hover
                  style={
                    isPlaying ? { backgroundColor: "rgba(255,85,0,0.08)" } : undefined
                  }
                >
                  <TableCell style={{ width: 48 }}>
                    <IconButton
                      size="small"
                      onClick={() => setPlaying(t)}
                      title="Play on SoundCloud"
                      style={{ padding: 2 }}
                    >
                      <Box style={{ position: "relative" }}>
                        <Avatar
                          variant="rounded"
                          src={t.artwork_url}
                          style={{ width: 36, height: 36 }}
                        >
                          <MusicNote />
                        </Avatar>
                        <Box
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.35)",
                            borderRadius: 4,
                          }}
                        >
                          <PlayArrow style={{ color: "#fff", fontSize: 20 }} />
                        </Box>
                      </Box>
                    </IconButton>
                  </TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{t.title}</TableCell>
                  <TableCell>{t.user && t.user.username}</TableCell>
                  {isLikelySet(t.duration) ? (
                    <TableCell colSpan={2}>
                      <Chip
                        size="small"
                        label="Set · not analyzed"
                        style={{
                          backgroundColor: SC_ORANGE,
                          color: "#fff",
                          height: 20,
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{t.key_signature || "—"}</TableCell>
                      <TableCell>{t.bpm || "—"}</TableCell>
                    </>
                  )}
                  <TableCell>{t.genre || "—"}</TableCell>
                  <TableCell style={{ whiteSpace: "nowrap" }}>
                    {fmtDuration(t.duration)}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      href={t.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open on SoundCloud"
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Typography
          variant="caption"
          color="textSecondary"
          style={{ display: "block", marginTop: 12 }}
        >
          Key &amp; BPM are artist-entered (usually blank) — KeyTrack analysis
          comes next. Tracks link out to SoundCloud (source &amp; attribution).
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ padding: 32, textAlign: "center" }}>
        <Typography color="textSecondary">{error}</Typography>
      </Box>
    );
  }

  if (!crates) {
    return (
      <Box style={{ padding: 64, textAlign: "center" }}>
        <CircularProgress style={{ color: SC_ORANGE }} />
        <Typography color="textSecondary" style={{ marginTop: 12 }}>
          Loading your SoundCloud library…
        </Typography>
      </Box>
    );
  }

  return (
    <Box style={{ padding: 16 }}>
      <Box style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Cloud style={{ color: SC_ORANGE }} />
        <Typography variant="h6" style={{ fontWeight: 700 }}>
          SoundCloud
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {crates.length} crate{crates.length === 1 ? "" : "s"}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {crates.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={c.id}>
            <Card className={classes.tile} onClick={() => openCrate(c)}>
              <Box
                className={classes.cover}
                style={
                  c.artwork ? { backgroundImage: `url(${c.artwork})` } : {}
                }
              >
                {!c.artwork && kindIcon(c.kind)}
                <span className={classes.scBadge}>
                  <Cloud style={{ fontSize: 13 }} /> SoundCloud
                </span>
              </Box>
              <CardContent className={classes.body}>
                <Typography className={classes.title} noWrap title={c.name}>
                  {c.name}
                </Typography>
                {c.owner && (
                  <Typography className={classes.owner} noWrap>
                    {c.owner}
                  </Typography>
                )}
                <Chip
                  size="small"
                  className={classes.trackChip}
                  icon={<MusicNote style={{ color: "#fff" }} />}
                  label={`${c.count} tracks`}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SoundCloudLibrary;
