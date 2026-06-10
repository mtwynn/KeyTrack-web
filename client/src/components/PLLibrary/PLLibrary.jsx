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
  Checkbox,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  TablePagination,
  TextField,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";

import {
  MenuOpen,
  Search,
  MusicNote,
  Star,
  StarBorder,
  VisibilityOff,
  LocalOffer,
  CreateNewFolder,
  Folder,
  ExpandMore,
  ExpandLess,
  Edit,
  Delete,
} from "@material-ui/icons";

import Spotify from "spotify-web-api-js";

import Playlist from "./Playlist";
import { useEffect } from "react";
import { fetchCrateMeta, setCrateMeta } from "../../utils/crateMeta";
import {
  fetchFolders,
  addFolder,
  renameFolder,
  deleteFolder,
} from "../../utils/folders";

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

const GENRES = [
  "House",
  "Tech House",
  "Deep House",
  "Bass House",
  "Progressive House",
  "Techno",
  "Trance",
  "Dubstep",
  "Melodic Dubstep",
  "Drum & Bass",
  "Trap",
  "Future Bass",
  "Hardstyle",
  "Electro",
  "Hip-Hop",
  "Pop",
  "R&B",
  "Rock",
  "Indie",
  "Ambient",
  "Lo-Fi",
  "Other",
];

let PLLibrary = (props) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  const [loadingPlaylist, setLoadingPlaylist] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState(null);
  const [loadingAll, setLoadingAll] = React.useState(false);
  const [allProgress, setAllProgress] = React.useState({ done: 0, total: 0 });
  // Crates selected (by id) to scope "Search all crates" to a subset.
  const [selected, setSelected] = React.useState(() => new Set());

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
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
  // Per-user crate metadata { [playlistId]: { favorite, hidden, ... } }.
  const [crateMeta, setCrateMetaState] = React.useState({});

  useEffect(() => {
    if (!props.userId) return;
    fetchCrateMeta(props.userId)
      .then(setCrateMetaState)
      .catch((e) => console.error("Failed to load crate metadata", e));
  }, [props.userId]);

  const metaFor = (id) => crateMeta[id] || {};

  const updateMeta = (id, partial) => {
    setCrateMetaState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...partial },
    }));
    if (props.userId) {
      setCrateMeta(props.userId, id, partial).catch((e) =>
        console.error("Failed to save crate metadata", e)
      );
    }
  };

  const toggleFavorite = (e, playlist) => {
    e.stopPropagation();
    updateMeta(playlist.id, { favorite: !metaFor(playlist.id).favorite });
  };

  const toggleHidden = (e, playlist) => {
    e.stopPropagation();
    updateMeta(playlist.id, { hidden: !metaFor(playlist.id).hidden });
  };

  // Tag/genre editing popover + library filter.
  const [tagEdit, setTagEdit] = React.useState({ anchorEl: null, id: null });
  const [tagInput, setTagInput] = React.useState("");
  const [metaFilter, setMetaFilter] = React.useState([]);

  const openTagEdit = (e, playlist) => {
    e.stopPropagation();
    setTagInput("");
    setTagEdit({ anchorEl: e.currentTarget, id: playlist.id });
  };

  const addTag = (id, tag) => {
    const t = tag.trim();
    if (!t) return;
    const cur = metaFor(id).tags || [];
    if (!cur.includes(t)) updateMeta(id, { tags: [...cur, t] });
    setTagInput("");
  };

  const removeTag = (id, tag) =>
    updateMeta(id, { tags: (metaFor(id).tags || []).filter((t) => t !== tag) });

  // All tags + genres in use, for the library filter.
  const allTagsGenres = React.useMemo(() => {
    const s = new Set();
    Object.values(crateMeta).forEach((m) => {
      (m.tags || []).forEach((t) => s.add(t));
      (m.genres || []).forEach((g) => s.add(g));
    });
    return Array.from(s).sort();
  }, [crateMeta]);

  // Sort + paginate the crate list so we only render a page at a time. In the
  // normal view, hidden crates are excluded and favorites are pinned to the top;
  // the hidden view (from the menu) shows only hidden crates.
  const showHidden = props.showHidden;
  const sortedCrates = React.useMemo(() => {
    const arr = (searchItems || []).filter((pl) => {
      const m = crateMeta[pl.id] || {};
      const hidden = !!m.hidden;
      if (showHidden ? !hidden : hidden) return false;
      if (metaFilter.length > 0) {
        const vals = [...(m.tags || []), ...(m.genres || [])];
        if (!metaFilter.some((f) => vals.includes(f))) return false;
      }
      return true;
    });
    arr.sort((a, b) => {
      if (!showHidden) {
        const fa = crateMeta[a.id] && crateMeta[a.id].favorite ? 1 : 0;
        const fb = crateMeta[b.id] && crateMeta[b.id].favorite ? 1 : 0;
        if (fa !== fb) return fb - fa; // favorites first
      }
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
  }, [searchItems, crateSort, crateMeta, showHidden, metaFilter]);

  const pagedCrates = sortedCrates.slice(
    cratePage * cratesPerPage,
    cratePage * cratesPerPage + cratesPerPage
  );

  React.useEffect(() => {
    setCratePage(0);
  }, [searchItems, crateSort, cratesPerPage, metaFilter]);

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
    // If crates are selected, search just those; otherwise all non-hidden crates
    // (hidden crates are abstracted away and never feed the cross-search).
    const playlists = (props.pllibrary || []).filter((pl) => {
      if (selected.size > 0) return selected.has(pl.id);
      return !(crateMeta[pl.id] && crateMeta[pl.id].hidden);
    });
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

  // --- Folders ---
  const [folders, setFolders] = React.useState([]);
  const [folderView, setFolderView] = React.useState(false);
  const [expanded, setExpanded] = React.useState({});

  const refreshFolders = React.useCallback(async () => {
    if (!props.userId) return;
    try {
      setFolders(await fetchFolders(props.userId));
    } catch (e) {
      console.error("Failed to load folders", e);
    }
  }, [props.userId]);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  const handleNewFolder = async () => {
    const name = window.prompt("New folder name");
    if (!name || !name.trim() || !props.userId) return;
    await addFolder(props.userId, name.trim());
    setFolderView(true);
    refreshFolders();
  };
  const handleRenameFolder = async (folder) => {
    const name = window.prompt("Rename folder", folder.name);
    if (!name || !name.trim() || !props.userId) return;
    await renameFolder(props.userId, folder.id, name.trim());
    refreshFolders();
  };
  const handleDeleteFolder = async (folder) => {
    if (!props.userId) return;
    if (
      !window.confirm(
        `Delete folder "${folder.name}"? Its crates move to Unfiled.`
      )
    )
      return;
    await deleteFolder(props.userId, folder.id);
    refreshFolders();
  };
  const toggleExpand = (id) =>
    setExpanded((p) => ({ ...p, [id]: p[id] === false ? true : false }));
  const isExpanded = (id) => expanded[id] !== false; // default expanded

  // Group the filtered + sorted crates by folder (dangling/none -> root).
  const grouped = React.useMemo(() => {
    const folderIds = new Set(folders.map((f) => f.id));
    const groups = { __root__: [] };
    folders.forEach((f) => {
      groups[f.id] = [];
    });
    sortedCrates.forEach((pl) => {
      const fid = (crateMeta[pl.id] || {}).folderId;
      if (fid && folderIds.has(fid)) groups[fid].push(pl);
      else groups.__root__.push(pl);
    });
    return groups;
  }, [sortedCrates, folders, crateMeta]);

  const renderCrateCard = (playlist) => (
    <Card
      key={playlist.id}
      className={classes.playlistCard}
      onClick={() => handlePlaylistOpen(playlist)}
      style={{
        borderLeft: metaFor(playlist.id).favorite
          ? "4px solid #1ED760"
          : "4px solid transparent",
      }}
    >
      <CardContent className={classes.cardContent}>
        <Checkbox
          checked={selected.has(playlist.id)}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(playlist.id);
          }}
          title="Select for cross-search"
          style={{ padding: 4, marginRight: 4, alignSelf: "center" }}
        />
        <Avatar
          variant="square"
          src={playlist.images[0] ? playlist.images[0].url : undefined}
          className={classes.albumArt}
        >
          <MusicNote />
        </Avatar>

        <Box className={classes.playlistInfo}>
          <Box className={classes.playlistHeader}>
            <Typography className={classes.playlistTitle}>
              {playlist.name}
            </Typography>
            <Typography className={classes.ownerText}>
              by {playlist.owner.display_name}
            </Typography>
          </Box>

          {playlist.description && (
            <Typography className={classes.playlistDescription}>
              {playlist.description}
            </Typography>
          )}

          <Box className={classes.playlistMeta}>
            <Chip
              label={`${playlist.tracks.total} tracks`}
              size="small"
              className={classes.trackChip}
              icon={<MusicNote style={{ color: "#fff" }} />}
            />
            {(metaFor(playlist.id).genres || []).map((g) => (
              <Chip key={`g-${g}`} label={g} size="small" variant="outlined" />
            ))}
            {(metaFor(playlist.id).tags || []).map((t) => (
              <Chip key={`t-${t}`} label={`#${t}`} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>

        <Box style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <IconButton
            size="small"
            onClick={(e) => openTagEdit(e, playlist)}
            title="Tags, genres & folder"
            aria-label="organize crate"
          >
            <LocalOffer fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => toggleFavorite(e, playlist)}
            title={metaFor(playlist.id).favorite ? "Unfavorite" : "Favorite"}
            aria-label="favorite crate"
          >
            {metaFor(playlist.id).favorite ? (
              <Star style={{ color: "#1ED760" }} />
            ) : (
              <StarBorder />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => toggleHidden(e, playlist)}
            title={metaFor(playlist.id).hidden ? "Unhide" : "Hide"}
            aria-label="hide crate"
          >
            <VisibilityOff
              fontSize="small"
              style={{
                color: metaFor(playlist.id).hidden ? "#1ED760" : undefined,
              }}
            />
          </IconButton>
          {loadingId === playlist.id ? (
            <CircularProgress
              classes={{ colorPrimary: classes.colorPrimary }}
              size={24}
              style={{ margin: 8 }}
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
        </Box>
      </CardContent>
    </Card>
  );

  const renderFolderGroup = (key, name, crates, folder) => (
    <Box key={key} style={{ marginBottom: 8 }}>
      <Box
        onClick={() => toggleExpand(key)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          cursor: "pointer",
          borderBottom: "1px solid rgba(128,128,128,0.2)",
        }}
      >
        {isExpanded(key) ? <ExpandLess /> : <ExpandMore />}
        <Folder fontSize="small" style={{ color: "#1ED760" }} />
        <Typography variant="subtitle1" style={{ fontWeight: 700, flex: 1 }}>
          {name}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {crates.length}
        </Typography>
        {folder && (
          <>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleRenameFolder(folder);
              }}
              aria-label="rename folder"
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder);
              }}
              aria-label="delete folder"
            >
              <Delete fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>
      <Collapse in={isExpanded(key)} timeout="auto" unmountOnExit>
        <Box sx={{ padding: isMobile ? 1 : 2 }}>
          {crates.length === 0 ? (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ paddingLeft: 8 }}
            >
              No crates
            </Typography>
          ) : (
            crates.map(renderCrateCard)
          )}
        </Box>
      </Collapse>
    </Box>
  );

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
            {selected.size > 0
              ? `Search selected (${selected.size})`
              : isMobile
              ? "All crates"
              : "Search all crates"}
          </Button>
          {selected.size > 0 && (
            <Button
              size="small"
              onClick={clearSelection}
              style={{ color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Clear
            </Button>
          )}
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
        <Box style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FormControl size="small" style={{ minWidth: 150 }}>
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
          {allTagsGenres.length > 0 && (
            <FormControl size="small" style={{ minWidth: 170 }}>
              <InputLabel>Filter by tag/genre</InputLabel>
              <Select
                multiple
                value={metaFilter}
                label="Filter by tag/genre"
                onChange={(e) => setMetaFilter(e.target.value)}
                renderValue={(sel) => sel.join(", ")}
              >
                {allTagsGenres.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        <Box style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            size="small"
            variant={folderView ? "contained" : "outlined"}
            color={folderView ? "primary" : "default"}
            startIcon={<Folder />}
            onClick={() => setFolderView((v) => !v)}
            style={{ textTransform: "none" }}
          >
            Folders
          </Button>
          {folderView && (
            <Button
              size="small"
              startIcon={<CreateNewFolder />}
              onClick={handleNewFolder}
              style={{ textTransform: "none" }}
            >
              New folder
            </Button>
          )}
          <Typography variant="caption" color="textSecondary">
            {sortedCrates.length} crate{sortedCrates.length === 1 ? "" : "s"}
          </Typography>
        </Box>
      </Box>

      {showHidden && (
        <Box sx={{ padding: isMobile ? 1 : 2 }} style={{ paddingTop: 0 }}>
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
              Hidden crates
            </Typography>
            <Button size="small" onClick={props.onExitHidden}>
              ← Back to all crates
            </Button>
          </Box>
          <Typography variant="caption" color="textSecondary">
            Hidden from your library and searches. Un-hide to bring one back.
          </Typography>
        </Box>
      )}

      {sortedCrates.length === 0 && (
        <Box sx={{ padding: isMobile ? 1 : 2 }}>
          <Typography variant="body2" color="textSecondary">
            {showHidden ? "No hidden crates." : "No crates to show."}
          </Typography>
        </Box>
      )}

      {folderView ? (
        <Box sx={{ padding: isMobile ? 0 : 1 }}>
          {renderFolderGroup("__root__", "Unfiled", grouped.__root__, null)}
          {folders.map((f) =>
            renderFolderGroup(f.id, f.name, grouped[f.id] || [], f)
          )}
        </Box>
      ) : (
        <Box sx={{ padding: isMobile ? 1 : 2 }}>
          {pagedCrates.map(renderCrateCard)}
        </Box>
      )}

      {!folderView && sortedCrates.length > 12 && (
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

      <Popover
        open={Boolean(tagEdit.anchorEl)}
        anchorEl={tagEdit.anchorEl}
        onClose={() => setTagEdit({ anchorEl: null, id: null })}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {tagEdit.id && (
          <Box style={{ padding: 16, width: 280 }}>
            <Typography
              variant="subtitle2"
              style={{ fontWeight: 700, marginBottom: 10 }}
            >
              Organize crate
            </Typography>
            <FormControl size="small" fullWidth style={{ marginBottom: 14 }}>
              <InputLabel>Folder</InputLabel>
              <Select
                value={metaFor(tagEdit.id).folderId || ""}
                label="Folder"
                onChange={(e) =>
                  updateMeta(tagEdit.id, { folderId: e.target.value || null })
                }
              >
                <MenuItem value="">Unfiled (root)</MenuItem>
                {folders.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth style={{ marginBottom: 14 }}>
              <InputLabel>Genres</InputLabel>
              <Select
                multiple
                value={metaFor(tagEdit.id).genres || []}
                label="Genres"
                onChange={(e) =>
                  updateMeta(tagEdit.id, { genres: e.target.value })
                }
                renderValue={(sel) => sel.join(", ")}
              >
                {GENRES.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Add tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagEdit.id, tagInput);
                }
              }}
              helperText="Press Enter to add"
            />
            <Box
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 8,
              }}
            >
              {(metaFor(tagEdit.id).tags || []).map((t) => (
                <Chip
                  key={t}
                  size="small"
                  label={`#${t}`}
                  onDelete={() => removeTag(tagEdit.id, t)}
                />
              ))}
            </Box>
          </Box>
        )}
      </Popover>

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
