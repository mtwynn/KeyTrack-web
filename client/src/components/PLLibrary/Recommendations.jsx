import React from "react";
import {
  makeStyles,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Collapse,
  CircularProgress,
  IconButton,
  Typography,
  Grid,
  Chip,
  Tooltip,
} from "@material-ui/core";
import {
  Refresh,
  Add,
  ExpandMore,
  ExpandLess,
  PlaylistAdd,
} from "@material-ui/icons";
import Spotify from "spotify-web-api-js";
import KeyMap from "../../utils/KeyMap";
import { camelotColor, compatibleCamelot } from "../../utils/harmonic";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    backgroundColor: "#f5f5f5",
    marginTop: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1),
    },
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2),
    cursor: "pointer",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  refreshButton: {
    color: "#1ED760",
  },
  card: {
    display: "flex",
    marginBottom: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(1),
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor: "#f0f0f0",
      transform: "scale(1.01)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    },
  },
  cardMedia: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  cardContent: {
    flex: 1,
    padding: theme.spacing(0, 2),
    minWidth: 0, // Important for text truncation to work in flex containers
    "&:last-child": {
      paddingBottom: 0,
    },
  },
  trackName: {
    fontWeight: 600,
    fontSize: "0.95rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2, // Allow up to 2 lines
    WebkitBoxOrient: "vertical",
    lineHeight: "1.3em",
    maxHeight: "2.6em", // 2 lines * 1.3em line height
  },
  artistName: {
    color: "#666",
    fontSize: "0.85rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    display: "flex",
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  chip: {
    height: 20,
    fontSize: "0.7rem",
  },
  addButton: {
    minWidth: 100,
    backgroundColor: "#1ED760",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#1DB954",
    },
    "&:disabled": {
      backgroundColor: "#ccc",
    },
  },
  addAllButton: {
    marginTop: theme.spacing(2),
    width: "100%",
    backgroundColor: "#1ED760",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#1DB954",
    },
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: "#666",
  },
}));

const Recommendations = (props) => {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);
  const [recommendations, setRecommendations] = React.useState([]);
  const [recommendationsMetadata, setRecommendationsMetadata] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState({});
  const [addingAll, setAddingAll] = React.useState(false);
  // Seed used to rank recommendations: { camelot, bpm }.
  const [seed, setSeed] = React.useState(null);

  // Seed for ranking. If the user has anchored a track, mix around that exact
  // key. Otherwise pick a RANDOM track from the crate as the seed — the goal of
  // recommendations is diversity, so each refresh explores a different corner of
  // the crate's harmonic space rather than always converging on its dominant key.
  const deriveSeed = () => {
    if (props.seedCamelot) {
      return { camelot: props.seedCamelot, bpm: props.seedBpm || null };
    }
    const tracks = (props.playlistKeys || []).filter(Boolean);
    if (tracks.length === 0) return { camelot: null, bpm: null };
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    return {
      camelot: KeyMap[pick.key].camelot[pick.mode],
      bpm: pick.tempo ? Math.round(pick.tempo) : null,
    };
  };

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  // Get 5 random tracks from playlist
  const getRandomPlaylistTracks = () => {
    if (!props.playlistTracks || props.playlistTracks.length === 0) {
      return [];
    }

    const tracks = props.playlistTracks.filter((item) => item.track?.id && item.track?.artists?.length > 0);
    const shuffled = [...tracks].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(5, tracks.length));
  };

  // Extract artist IDs from selected tracks
  const extractArtistIds = (selectedTracks) => {
    return selectedTracks.map((track) => track.track.artists[0].id);
  };

  // Build lookup sets for existing playlist tracks
  const buildPlaylistLookup = () => {
    const trackIds = new Set();
    const trackNames = new Set();

    props.playlistTracks.forEach((item) => {
      if (item.track?.id) {
        trackIds.add(item.track.id);
      }
      if (item.track?.name) {
        trackNames.add(item.track.name.toLowerCase().trim());
      }
    });

    return { trackIds, trackNames };
  };

  // Fetch recommendations using artist top tracks
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      // Step 1: Select 5 random tracks from playlist
      const randomTracks = getRandomPlaylistTracks();
      if (randomTracks.length === 0) {
        console.log("No tracks available in playlist");
        setRecommendations([]);
        setLoading(false);
        return;
      }

      console.log("Selected random tracks:", randomTracks.map(t => t.track.name));

      // Step 2: Extract artist IDs
      const artistIds = extractArtistIds(randomTracks);
      console.log("Artist IDs:", artistIds);

      // Step 3: Build playlist lookup sets
      const { trackIds: playlistTrackIds, trackNames: playlistTrackNames } = buildPlaylistLookup();
      console.log("Playlist has", playlistTrackIds.size, "tracks");

      // Step 4: Fetch top tracks for each artist (parallel API calls)
      const topTracksPromises = artistIds.map((artistId) =>
        spotifyWebApi.getArtistTopTracks(artistId, "US").catch((error) => {
          console.error(`Error fetching top tracks for artist ${artistId}:`, error);
          return { tracks: [] }; // Return empty array on error
        })
      );

      const topTracksResults = await Promise.all(topTracksPromises);
      console.log("Fetched top tracks for", topTracksResults.length, "artists");

      // Step 5: Collect ALL unique candidate tracks across artists (excluding
      // tracks already in the playlist), to give ranking a real pool.
      const seenIds = new Set(playlistTrackIds);
      const candidates = [];
      topTracksResults.forEach((result) => {
        (result.tracks || []).forEach((track) => {
          if (!track.id || seenIds.has(track.id)) return;
          if (playlistTrackNames.has(track.name.toLowerCase().trim())) return;
          seenIds.add(track.id);
          candidates.push(track);
        });
      });

      if (candidates.length === 0) {
        setRecommendations([]);
        setRecommendationsMetadata({});
        setLoading(false);
        return;
      }

      // Step 6: Audio features for all candidates (batched by 100).
      const metadataMap = {};
      for (let i = 0; i < candidates.length; i += 100) {
        const batchIds = candidates.slice(i, i + 100).map((t) => t.id);
        const res = await spotifyWebApi.getAudioFeaturesForTracks(batchIds);
        (res.audio_features || []).forEach((f) => {
          if (f) {
            metadataMap[f.id] = { key: f.key, mode: f.mode, tempo: f.tempo };
          }
        });
      }

      // Step 7: Rank by harmonic + BPM compatibility to the seed, take the top.
      const theSeed = deriveSeed();
      setSeed(theSeed);
      const ranked = candidates
        .map((track) => {
          const m = metadataMap[track.id];
          const code = m ? KeyMap[m.key].camelot[m.mode] : null;
          const bpm = m ? Math.round(m.tempo) : null;
          const compatible =
            theSeed.camelot && code
              ? compatibleCamelot(theSeed.camelot).has(code)
              : false;
          const bpmDelta =
            theSeed.bpm != null && bpm != null
              ? Math.abs(bpm - theSeed.bpm)
              : 9999;
          return { track, compatible, bpmDelta };
        })
        .sort((a, b) => {
          if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
          return a.bpmDelta - b.bpmDelta;
        })
        .slice(0, 12);

      setRecommendations(ranked.map((r) => r.track));
      setRecommendationsMetadata(metadataMap);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendations([]);
      setRecommendationsMetadata({});
    }
    setLoading(false);
  };

  // Add single track to playlist
  const addTrackToPlaylist = async (trackUri, trackId) => {
    setAdding({ ...adding, [trackId]: true });
    try {
      await spotifyWebApi.addTracksToPlaylist(props.playlistId, [trackUri]);
      console.log("Track added successfully");
      
      // Update parent playlist state without refetching
      const addedTrack = recommendations.find((track) => track.id === trackId);
      const audioFeature = getAudioFeatureForTrack(trackId);
      
      if (addedTrack && props.addTracksToPlaylistState) {
        const audioFeatures = audioFeature ? [audioFeature] : [];
        props.addTracksToPlaylistState([addedTrack], audioFeatures);
      }
      
      // Remove from recommendations after adding
      setRecommendations(recommendations.filter((track) => track.id !== trackId));
    } catch (error) {
      console.error("Error adding track:", error);
    }
    setAdding({ ...adding, [trackId]: false });
  };

  // Add all recommendations to playlist
  const addAllToPlaylist = async () => {
    setAddingAll(true);
    try {
      const uris = recommendations.map((track) => track.uri);
      await spotifyWebApi.addTracksToPlaylist(props.playlistId, uris);
      console.log("All tracks added successfully");
      
      // Update parent playlist state without refetching
      if (props.addTracksToPlaylistState) {
        // Get audio features for all recommendations
        const audioFeatures = recommendations
          .map((track) => getAudioFeatureForTrack(track.id))
          .filter((feature) => feature !== null);
        
        props.addTracksToPlaylistState(recommendations, audioFeatures);
      }
      
      setRecommendations([]);
    } catch (error) {
      console.error("Error adding all tracks:", error);
    }
    setAddingAll(false);
  };

  // Fetch on mount if opened
  React.useEffect(() => {
    if (open && recommendations.length === 0) {
      fetchRecommendations();
    }
  }, [open]);

  // Get track metadata for display
  const getTrackMetadata = (trackId) => {
    const trackData = recommendationsMetadata[trackId];
    if (!trackData) return null;

    return {
      key: KeyMap[trackData.key]?.key || "N/A",
      mode: trackData.mode === 1 ? "Major" : "Minor",
      bpm: Math.round(trackData.tempo),
      camelot: KeyMap[trackData.key]
        ? KeyMap[trackData.key].camelot[trackData.mode]
        : null,
    };
  };

  // Convert track to audio feature format for playlist state
  const getAudioFeatureForTrack = (trackId) => {
    const trackData = recommendationsMetadata[trackId];
    if (!trackData) return null;

    return {
      id: trackId,
      key: trackData.key,
      mode: trackData.mode,
      tempo: trackData.tempo,
      // Include other properties that might be needed
      duration_ms: 0, // We don't have this from our metadata
      time_signature: 4, // Default value
    };
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header} onClick={() => setOpen(!open)}>
        <Box className={classes.title}>
          <PlaylistAdd style={{ color: "#1ED760" }} />
          <Typography variant="h6">
            Recommended Tracks
            {recommendations.length > 0 && ` (${recommendations.length})`}
          </Typography>
        </Box>
        <Box>
          {open && (
            <IconButton
              className={classes.refreshButton}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                fetchRecommendations();
              }}
              disabled={loading}
            >
              <Refresh />
            </IconButton>
          )}
          <IconButton size="small">
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        {loading ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress style={{ color: "#1ED760" }} />
          </Box>
        ) : recommendations.length === 0 ? (
          <Box className={classes.emptyState}>
            <Typography>
              No recommendations available. Click refresh to try again.
            </Typography>
          </Box>
        ) : (
          <>
            {seed && seed.camelot && (
              <Typography
                variant="caption"
                color="textSecondary"
                style={{ display: "block", padding: "0 8px 8px" }}
              >
                Ranked for mixing with {seed.camelot}
                {seed.bpm ? ` · ~${seed.bpm} BPM` : ""}{" "}
                {props.seedCamelot
                  ? "(your anchored key)"
                  : "(random seed — refresh for new picks)"}
              </Typography>
            )}
            <Grid container spacing={1}>
              {recommendations.map((track) => {
                const metadata = getTrackMetadata(track.id);
                return (
                  <Grid item xs={12} key={track.id}>
                    <Card 
                      className={classes.card} 
                      elevation={1}
                      onClick={() => props.updatePlayer([track.uri], true)}
                    >
                      <CardMedia
                        className={classes.cardMedia}
                        image={
                          track.album?.images?.[0]?.url ||
                          "https://via.placeholder.com/60"
                        }
                        title={track.name}
                      />
                      <CardContent className={classes.cardContent}>
                        <Tooltip title={track.name} placement="top">
                          <Typography className={classes.trackName}>
                            {track.name}
                          </Typography>
                        </Tooltip>
                        <Tooltip title={track.artists.map((artist) => artist.name).join(", ")} placement="top">
                          <Typography className={classes.artistName}>
                            {track.artists.map((artist) => artist.name).join(", ")}
                          </Typography>
                        </Tooltip>
                        {metadata && (
                          <Box className={classes.metadata}>
                            <Chip
                              label={
                                metadata.camelot
                                  ? `${metadata.key} ${metadata.mode} · ${metadata.camelot}`
                                  : `${metadata.key} ${metadata.mode}`
                              }
                              size="small"
                              className={classes.chip}
                              style={
                                metadata.camelot
                                  ? {
                                      backgroundColor: camelotColor(
                                        metadata.camelot
                                      ).bg,
                                      color: camelotColor(metadata.camelot).text,
                                    }
                                  : {}
                              }
                            />
                            <Chip
                              label={`${metadata.bpm} BPM`}
                              size="small"
                              className={classes.chip}
                            />
                            {seed &&
                              seed.camelot &&
                              metadata.camelot &&
                              compatibleCamelot(seed.camelot).has(
                                metadata.camelot
                              ) && (
                                <Chip
                                  label="✓ mixes"
                                  size="small"
                                  className={classes.chip}
                                  style={{
                                    backgroundColor: "#1ED760",
                                    color: "#fff",
                                  }}
                                />
                              )}
                          </Box>
                        )}
                      </CardContent>
                      <Button
                        className={classes.addButton}
                        variant="contained"
                        size="small"
                        startIcon={<Add />}
                        onClick={(e) => {
                          e.stopPropagation();
                          addTrackToPlaylist(track.uri, track.id);
                        }}
                        disabled={adding[track.id]}
                      >
                        {adding[track.id] ? "Adding..." : "Add"}
                      </Button>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {recommendations.length > 0 && (
              <Button
                className={classes.addAllButton}
                variant="contained"
                startIcon={<PlaylistAdd />}
                onClick={addAllToPlaylist}
                disabled={addingAll}
              >
                {addingAll ? "Adding All..." : `Add All ${recommendations.length} Tracks`}
              </Button>
            )}
          </>
        )}
      </Collapse>
    </Box>
  );
};

export default Recommendations;
