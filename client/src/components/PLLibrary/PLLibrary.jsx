import React, { Fragment } from "react";
import _ from "underscore";

import {
  AppBar,
  Avatar,
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  Input,
  InputAdornment,
  Toolbar,
  Paper,
  makeStyles,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";

import { MenuOpen, Search, MusicNote } from "@material-ui/icons";

import Spotify from "spotify-web-api-js";

import Playlist from "./Playlist";
import { useEffect } from "react";

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "sticky",
    backgroundColor: "#191414",
    borderRadius: "8px 8px 0 0",
  },
  search: {
    flex: 1,
    color: "white",
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(3),
    borderWidth: "10px",
    [theme.breakpoints.down('sm')]: {
      marginRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
    },
  },
  root: {
    display: "inline-block",
    borderRadius: "0 0 4px 4px",
  },
  loadingDialog: {
    backgroundColor: "transparent",
  },
  loadingDialogPaper: {
    backgroundColor: "transparent",
    boxShadow: "none",
    overflow: "hidden",
  },
  colorPrimary: {
    color: "#1ED760",
  },
  playlistCard: {
    marginBottom: theme.spacing(2),
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4],
      backgroundColor: "#f0fff4",
    },
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(1),
    },
  },
  cardContent: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(2),
    "&:last-child": {
      paddingBottom: theme.spacing(2),
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.5),
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
  albumArt: {
    width: 80,
    height: 80,
    marginRight: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      width: 60,
      height: 60,
      marginRight: 0,
      marginBottom: theme.spacing(1),
    },
  },
  playlistInfo: {
    flex: 1,
    minWidth: 0,
    [theme.breakpoints.down('sm')]: {
      width: "100%",
    },
  },
  playlistHeader: {
    display: "flex",
    alignItems: "baseline",
    marginBottom: theme.spacing(0.5),
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
    },
  },
  playlistTitle: {
    fontWeight: 600,
    fontSize: "1.1rem",
    [theme.breakpoints.down('sm')]: {
      fontSize: "1rem",
    },
  },
  playlistDescription: {
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
    marginBottom: theme.spacing(1),
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    [theme.breakpoints.down('sm')]: {
      fontSize: "0.75rem",
      WebkitLineClamp: 1,
    },
  },
  playlistMeta: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
    },
  },
  ownerText: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    fontWeight: 400,
    [theme.breakpoints.down('sm')]: {
      fontSize: "0.7rem",
    },
  },
  trackChip: {
    backgroundColor: "#1ED760",
    color: "#fff",
    fontWeight: 600,
    height: 24,
    [theme.breakpoints.down('sm')]: {
      height: 20,
      fontSize: "0.75rem",
    },
  },
  openButton: {
    marginLeft: theme.spacing(2),
    color: "#1ED760",
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      alignSelf: "center",
    },
  },
}));

let PLLibrary = (props) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  const [loadingPlaylist, setLoadingPlaylist] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState(null);
  const [loadingAll, setLoadingAll] = React.useState(false);
  const [allProgress, setAllProgress] = React.useState({ done: 0, total: 0 });
  const [showPlaylist, setShowPlaylist] = React.useState(false);
  const [currPlaylist, setCurrPlaylist] = React.useState(null);
  const [playlistKeys, setPlaylistKeys] = React.useState(null);
  const [playlistName, setPlaylistName] = React.useState("");
  const [playlistId, setPlaylistId] = React.useState("");
  const [playlistOwnerId, setPlaylistOwnerId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [searchItems, setSearchItems] = React.useState(props.pllibrary);
  const [crateSort, setCrateSort] = React.useState("name");
  const [cratePage, setCratePage] = React.useState(0);
  const [cratesPerPage, setCratesPerPage] = React.useState(24);

  // Sort + paginate the crate list so we only render a page at a time.
  const sortedCrates = React.useMemo(() => {
    const arr = [...(searchItems || [])];
    arr.sort((a, b) => {
      if (crateSort === "tracks") {
        return (b.tracks?.total || 0) - (a.tracks?.total || 0);
      }
      if (crateSort === "owner") {
        return (a.owner?.display_name || "").localeCompare(
          b.owner?.display_name || ""
        );
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    return arr;
  }, [searchItems, crateSort]);

  const pagedCrates = sortedCrates.slice(
    cratePage * cratesPerPage,
    cratePage * cratesPerPage + cratesPerPage
  );

  React.useEffect(() => {
    setCratePage(0);
  }, [searchItems, crateSort, cratesPerPage]);

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  // Add tracks to current playlist state without refetching
  const addTracksToPlaylistState = (tracks, audioFeatures = []) => {
    if (!currPlaylist) return;
    
    // Convert tracks to playlist item format if needed
    const newItems = tracks.map(track => {
      // If track is already in playlist format, use it; otherwise wrap it
      if (track.track) {
        return track;
      }
      return {
        added_at: new Date().toISOString(),
        track: track
      };
    });
    
    setCurrPlaylist([...currPlaylist, ...newItems]);
    
    // Add audio features to playlistKeys if provided
    if (audioFeatures.length > 0 && playlistKeys) {
      setPlaylistKeys([...playlistKeys, ...audioFeatures]);
      console.log(`Added ${newItems.length} track(s) with metadata to playlist state`);
    } else {
      console.log(`Added ${newItems.length} track(s) to playlist state (no metadata)`);
    }
  };

  useEffect(() => {
    if (search === "") {
      _.debounce(setSearchItems(props.pllibrary), 500);
    } else {
      _.debounce(
        setSearchItems(() => {
          let filteredItems = props.pllibrary;

          if (search !== "") {
            filteredItems = filteredItems.filter((item) => {
              const {
                name: title,
                description,
                owner: { display_name: owner },
              } = item;

              console.log(description);

              return (
                title.toLowerCase().includes(search) ||
                description.toLowerCase().includes(search) ||
                owner.toLowerCase().includes(search)
              );
            });
          }

          return filteredItems;
        }, 500)
      );
    }
  }, [search]);

  let handleChange = _.debounce((event) => {
    event.persist();
    setSearch(String(event.target.value).toLowerCase());
  }, 500);

  let handlePlaylistOpen = (playlist) => {
    let numRequests = Math.ceil(playlist.tracks.total / 100);
    let playlistPromises = [];
    let audioFeaturesPromises = [];

    setLoadingPlaylist(true);
    setLoadingId(playlist.id);

    setPlaylistName(playlist.name);
    setPlaylistId(playlist.id);
    setPlaylistOwnerId(playlist.owner.id);

    for (var i = 0; i < numRequests; ++i) {
      playlistPromises.push(
        spotifyWebApi.getPlaylistTracks(playlist.id, { offset: i * 100 })
      );
    }

    Promise.all(playlistPromises)
      .then((results) => {
        let tempArr = [];

        results.forEach((result) => {
          tempArr = tempArr.concat(result.items);

          let playlistItems = result.items;
          let playlistItemIds = [];

          for (var j = 0; j < playlistItems.length; ++j) {
            let id = playlistItems[j].track.id;
            playlistItemIds.push(id);
          }

          audioFeaturesPromises.push(
            spotifyWebApi.getAudioFeaturesForTracks(playlistItemIds)
          );
        });

        // Returned so the chain waits for audio features before resolving.
        return Promise.all(audioFeaturesPromises).then((results) => {
          let keysArr = [];

          results.forEach((result) => {
            keysArr = keysArr.concat(result.audio_features);
          });

          setCurrPlaylist(tempArr);
          setPlaylistKeys(keysArr);
          setShowPlaylist(true);
        });
      })
      .catch((error) => {
        console.error("Failed to load playlist", error);
      })
      // Always clear the loading state, even if a request failed, so the
      // spinner never gets stuck.
      .finally(() => {
        setLoadingPlaylist(false);
        setLoadingId(null);
      });
  };

  let handlePlaylistClose = () => {
    setShowPlaylist(false);
  };

  // --- Cross-playlist search: load every crate's tracks into one virtual
  // playlist, then reuse the normal Playlist view to search/filter across them.
  const fetchAllTracks = async (playlistId) => {
    let items = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await spotifyWebApi.getPlaylistTracks(playlistId, {
        offset,
        limit: 100,
      });
      items = items.concat(res.items || []);
      if (!res.next) break;
      offset += 100;
    }
    return items.filter((it) => it.track && it.track.id);
  };

  const fetchFeatures = async (ids) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await spotifyWebApi.getAudioFeaturesForTracks(
        ids.slice(i, i + 100)
      );
      out.push(...(res.audio_features || []));
    }
    return out;
  };

  // Concurrency-capped map to avoid bursting the Spotify rate limit.
  const mapWithLimit = async (items, limit, fn) => {
    const results = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        results[idx] = await fn(items[idx], idx);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, worker)
    );
    return results;
  };

  const handleSearchAllCrates = async () => {
    const playlists = props.pllibrary || [];
    if (playlists.length === 0) return;

    setAllProgress({ done: 0, total: playlists.length });
    setLoadingAll(true);
    try {
      const perPlaylist = await mapWithLimit(playlists, 4, async (pl) => {
        const tracks = await fetchAllTracks(pl.id);
        const features = await fetchFeatures(tracks.map((t) => t.track.id));
        setAllProgress((p) => ({ ...p, done: p.done + 1 }));
        return { tracks, features };
      });

      // Aggregate + dedupe by track id.
      const seen = new Set();
      const allTracks = [];
      const featById = new Map();
      perPlaylist.forEach(({ tracks, features }) => {
        tracks.forEach((item) => {
          if (!seen.has(item.track.id)) {
            seen.add(item.track.id);
            allTracks.push(item);
          }
        });
        features.forEach((f) => {
          if (f) featById.set(f.id, f);
        });
      });

      setPlaylistName(`All Crates · ${allTracks.length} tracks`);
      setPlaylistId("__all_crates__");
      setPlaylistOwnerId(null); // hides owner-only Recommendations
      setCurrPlaylist(allTracks);
      setPlaylistKeys(Array.from(featById.values()));
      setShowPlaylist(true);
    } catch (error) {
      console.error("Failed to load all crates", error);
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <>
      <Dialog
        open={loadingPlaylist}
        PaperProps={{
          style: {
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            borderRadius: 12,
          },
        }}
      >
        <CircularProgress
          classes={{ colorPrimary: classes.colorPrimary }}
          size={64}
          variant="indeterminate"
          disableShrink
        />
        <Typography variant="body1" style={{ fontWeight: 600 }}>
          Loading crate…
        </Typography>
      </Dialog>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <Input
            classes={{
              root: classes.search,
              focused: classes.inputFocused,
            }}
            type={"text"}
            onChange={handleChange}
            placeholder="Search Playlists"
            endAdornment={
              <InputAdornment position="end">
                <Search />
              </InputAdornment>
            }
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<Search />}
            onClick={handleSearchAllCrates}
            disabled={!props.pllibrary || props.pllibrary.length === 0}
            style={{
              color: "#fff",
              borderColor: "rgba(255,255,255,0.5)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isMobile ? "All crates" : "Search all crates"}
          </Button>
        </Toolbar>
      </AppBar>

      <Dialog
        open={loadingAll}
        PaperProps={{
          style: {
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            borderRadius: 12,
          },
        }}
      >
        <CircularProgress
          classes={{ colorPrimary: classes.colorPrimary }}
          size={64}
          variant={allProgress.total ? "determinate" : "indeterminate"}
          value={
            allProgress.total
              ? (allProgress.done / allProgress.total) * 100
              : 0
          }
        />
        <Typography variant="body1" style={{ fontWeight: 600 }}>
          Loading all crates… {allProgress.done}/{allProgress.total}
        </Typography>
      </Dialog>

      <Box
        sx={{ padding: isMobile ? 1 : 2 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <FormControl size="small" style={{ minWidth: 160 }}>
          <InputLabel>Sort crates by</InputLabel>
          <Select
            value={crateSort}
            label="Sort crates by"
            onChange={(e) => setCrateSort(e.target.value)}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="tracks">Track count</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="textSecondary">
          {sortedCrates.length} crate{sortedCrates.length === 1 ? "" : "s"}
        </Typography>
      </Box>

      <Box sx={{ padding: isMobile ? 1 : 2 }}>
        {pagedCrates.map((playlist) => (
          <Card
            key={playlist.id}
            className={classes.playlistCard}
            onClick={() => handlePlaylistOpen(playlist)}
          >
            <CardContent className={classes.cardContent}>
              {/* Album Art */}
              <Avatar
                variant="square"
                src={playlist.images[0] ? playlist.images[0].url : undefined}
                className={classes.albumArt}
              >
                <MusicNote />
              </Avatar>

              {/* Playlist Info */}
              <Box className={classes.playlistInfo}>
                {/* Title and Owner - Always on same line */}
                <Box className={classes.playlistHeader}>
                  <Typography className={classes.playlistTitle}>
                    {playlist.name}
                  </Typography>
                  <Typography className={classes.ownerText}>
                    by {playlist.owner.display_name}
                  </Typography>
                </Box>

                {/* Description */}
                {playlist.description && (
                  <Typography className={classes.playlistDescription}>
                    {playlist.description}
                  </Typography>
                )}

                {/* Meta Info: Track Count */}
                <Box className={classes.playlistMeta}>
                  <Chip
                    label={`${playlist.tracks.total} tracks`}
                    size="small"
                    className={classes.trackChip}
                    icon={<MusicNote style={{ color: "#fff" }} />}
                  />
                </Box>
              </Box>

              {/* Open Button / per-card loading spinner */}
              {loadingId === playlist.id ? (
                <CircularProgress
                  classes={{ colorPrimary: classes.colorPrimary }}
                  size={24}
                  className={classes.openButton}
                />
              ) : (
                !isMobile && (
                  <IconButton
                    className={classes.openButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaylistOpen(playlist);
                    }}
                  >
                    <MenuOpen />
                  </IconButton>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      {sortedCrates.length > 12 && (
        <TablePagination
          component="div"
          count={sortedCrates.length}
          page={cratePage}
          onChangePage={(e, p) => setCratePage(p)}
          rowsPerPage={cratesPerPage}
          onChangeRowsPerPage={(e) => {
            setCratesPerPage(parseInt(e.target.value, 10));
            setCratePage(0);
          }}
          rowsPerPageOptions={[12, 24, 48]}
          labelRowsPerPage="Crates per page"
        />
      )}

      {showPlaylist ? (
        <Playlist
          open={showPlaylist}
          handlePlaylistOpen={handlePlaylistOpen}
          handlePlaylistClose={handlePlaylistClose}
          playlistName={playlistName}
          playlistId={playlistId}
          playlistOwnerId={playlistOwnerId}
          playlist={currPlaylist}
          playlistKeys={playlistKeys}
          token={props.token}
          userId={props.userId}
          updatePlayer={props.updatePlayer}
          addTracksToPlaylistState={addTracksToPlaylistState}
          onAddToSet={props.onAddToSet}
          onOpenSet={props.onOpenSet}
          setCount={props.setCount}
        />
      ) : null}
    </>
  );
};
// Memoized so toggling unrelated app-level state (e.g. opening the Set drawer)
// doesn't re-render the whole library + playlist table. App passes stable props
// (bound methods + state that doesn't change on those toggles).
export default React.memo(PLLibrary);
