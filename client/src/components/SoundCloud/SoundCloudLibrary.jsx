import React from "react";
import axios from "axios";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
  makeStyles,
} from "@material-ui/core";
import { Cloud, MusicNote, Favorite, Repeat } from "@material-ui/icons";

import SoundCloudCrate from "./SoundCloudCrate";

// SoundCloud's brand orange — used for the source badge so SoundCloud crates
// are always visually distinct from Spotify's green (strict source separation).
const SC_ORANGE = "#ff5500";

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

let SoundCloudLibrary = (props) => {
  const classes = useStyles();
  const [crates, setCrates] = React.useState(null);
  const [error, setError] = React.useState(null);
  // Crate-detail view: the opened crate (rendered by SoundCloudCrate).
  const [opened, setOpened] = React.useState(null);

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

  // Crate detail: delegate to the reusable SoundCloudCrate component.
  if (opened) {
    return (
      <SoundCloudCrate
        crate={opened}
        token={props.token}
        backend={props.backend}
        onRefreshToken={props.onRefreshToken}
        onBack={() => setOpened(null)}
      />
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
            <Card className={classes.tile} onClick={() => setOpened(c)}>
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
