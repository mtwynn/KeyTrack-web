import React, { Fragment } from "react";
import _ from "underscore";

import {
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  Input,
  InputAdornment,
  Paper,
  makeStyles,
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Checkbox,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Select,
  Tab,
  Tabs,
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
  Favorite,
  SortByAlpha,
  FilterList,
  ArrowDropDown,
  Close,
  Cloud,
} from "@material-ui/icons";

import Spotify from "spotify-web-api-js";

import Playlist from "./Playlist";
import { MusicSpinner, FillBar } from "./LoaderArt";
import CombinedPlaylist from "./CombinedPlaylist";
import { SpotifyIcon, SoundcloudIcon } from "../BrandIcons";
import { useEffect } from "react";
import { fetchCrateMeta, setCrateMeta } from "../../utils/crateMeta";
import {
  fetchFolders,
  addFolder,
  renameFolder,
  deleteFolder,
} from "../../utils/folders";
import {
  buildScFetch,
  fetchSoundcloudCrates,
  fetchScSetCounts,
  fetchScTracks,
  isLikelySet,
} from "../../utils/soundcloudCrates";
import { idbGet, idbSet } from "../../utils/crateStore";

// SoundCloud brand orange (source badge + toggle), distinct from Spotify green.
const SC_ORANGE = "#ff5500";
const SPOTIFY_GREEN = "#1ED760";
// Persisted Library source toggles (Spotify / SoundCloud).
const SOURCES_KEY = "keytrack_lib_sources";

const useStyles = makeStyles((theme) => ({
  // Staggered entrance for crate tiles when the grid mounts (library open,
  // folder expand, new page). Reordering reuses elements so it doesn't replay.
  "@keyframes tileIn": {
    from: { opacity: 0, transform: "translateY(14px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  tileIn: {
    animation: "$tileIn 0.34s ease both",
  },
  // Crossfade the content when switching the Crates / Folders tab.
  "@keyframes contentFade": {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  contentFade: {
    animation: "$contentFade 0.28s ease both",
  },
  // Bump the "Open (N)" count when the selection size changes.
  "@keyframes countBump": {
    "0%": { transform: "scale(1)" },
    "35%": { transform: "scale(1.35)" },
    "100%": { transform: "scale(1)" },
  },
  countBump: {
    animation: "$countBump 0.3s ease",
  },
  // Floating, fully-rounded search pill (replaces the old dark search bar).
  searchPill: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 200,
    borderRadius: 28,
    padding: "4px 8px 4px 18px",
    border: "1px solid rgba(128,128,128,0.28)",
    backgroundColor: theme.palette.background.paper,
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
  playlistTitle: {
    fontWeight: 600,
    fontSize: "1.05rem",
    [theme.breakpoints.down('sm')]: {
      fontSize: "1rem",
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
    color: "#1ED760",
  },
  // --- Cover-art tile layout ---
  tileCard: {
    cursor: "pointer",
    borderRadius: 12,
    overflow: "hidden",
    transition: "all 0.18s ease-in-out",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: theme.shadows[6],
    },
  },
  tileCover: {
    position: "relative",
    height: 130,
    backgroundColor: "#191414",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    [theme.breakpoints.down("sm")]: {
      height: 110,
    },
  },
  tileCheckbox: {
    position: "absolute",
    top: 4,
    left: 4,
    padding: 4,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.35)",
    transition: "transform 0.12s ease, background-color 0.15s ease",
    "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
    "&:active": { transform: "scale(0.82)" },
  },
  tileFav: {
    position: "absolute",
    top: 6,
    right: 6,
    padding: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    transition: "transform 0.12s ease, background-color 0.15s ease",
    "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
    "&:active": { transform: "scale(0.82)" },
  },
  // Little pop applied to the star/checkbox icon the moment its state flips.
  "@keyframes iconPop": {
    "0%": { transform: "scale(1)" },
    "45%": { transform: "scale(1.35)" },
    "100%": { transform: "scale(1)" },
  },
  iconPop: {
    animation: "$iconPop 0.28s ease",
  },
  tileLoading: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  tileBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(1.5),
    "&:last-child": { paddingBottom: theme.spacing(1) },
  },
  tileDesc: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    margin: theme.spacing(0.5, 0),
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  // Pinned to the bottom of the body so the track-count chip sits at a
  // consistent height across every tile regardless of description length.
  tileMeta: {
    marginTop: "auto",
    paddingTop: theme.spacing(1),
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  tileActions: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: theme.spacing(0.5, 1),
    borderTop: "1px solid rgba(128,128,128,0.15)",
  },
}));

// Spotify returns playlist descriptions containing HTML entities and anchor
// tags (e.g. `<a href="spotify:genre:edm_dance">dance</a>`). Strip the tags and
// decode the entities so the UI shows clean, readable text. Using a textarea's
// value to decode is safe — it never executes markup.
const decodeEl =
  typeof document !== "undefined" ? document.createElement("textarea") : null;
function cleanDescription(desc) {
  if (!desc) return "";
  let text = desc.replace(/<[^>]*>/g, "");
  if (decodeEl) {
    decodeEl.innerHTML = text;
    text = decodeEl.value;
  }
  return text.trim();
}

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

// A crate normalized to a source-agnostic shape so the grid, search, sort,
// folders, selection and metadata can treat every crate the same — the
// foundation for mixing Spotify and SoundCloud crates in one library.
//   uid         React key AND crateMeta/folder key. For Spotify it stays the
//               raw playlist id so existing favorites/folders/tags keep working.
//   source      'spotify' | 'soundcloud'
//   raw         the original source object (handed to the source's open flow).
function normalizeSpotifyCrate(pl) {
  return {
    uid: pl.id,
    source: "spotify",
    name: pl.name || "",
    image: pl.images && pl.images[0] ? pl.images[0].url : null,
    trackCount: pl.tracks ? pl.tracks.total : 0,
    ownerName: pl.owner ? pl.owner.display_name : "",
    description: pl.description || "",
    raw: pl,
  };
}

// SoundCloud crate (from fetchSoundcloudCrates) -> the same neutral shape. The
// `sc:` prefix keeps SoundCloud uids from ever colliding with Spotify's 22-char
// base62 playlist ids, so crateMeta/folders stay cleanly partitioned.
function normalizeSoundcloudCrate(c) {
  return {
    uid: "sc:" + c.id,
    source: "soundcloud",
    name: c.name || "",
    image: c.artwork || null,
    trackCount: c.count || 0,
    // Non-set track count (null = not yet known). Used to hide all-set crates
    // when "Disable Sets" is on.
    nonSetCount: c.nonSetCount == null ? null : c.nonSetCount,
    // True when the tile count is a first-page floor (likes/reposts) — the full
    // list still loads when the crate is opened.
    more: !!c.more,
    ownerName: c.owner || "",
    description: "",
    raw: c,
  };
}

let PLLibrary = (props) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // --- SoundCloud source (unified into this same library) ---
  const scConnected = !!(props.soundcloud && props.soundcloud.connected);
  const scToken = props.soundcloud ? props.soundcloud.access_token : null;
  const [scCrates, setScCrates] = React.useState(null);
  // Playlists we've already tried to resolve a set-count for (dedupe / no loop).
  const setCountTriedRef = React.useRef(new Set());
  // Combined multi-source browser — opened from a SoundCloud-inclusive Open(N)
  // OR a single SoundCloud crate (which now routes through the same view).
  // Holds the raw per-source material ({ spotifyItems, spotifyFeatures,
  // scTracks, title }) that CombinedPlaylist adapts into the real Playlist view.
  const [combinedData, setCombinedData] = React.useState(null);

  // Library source toggles (Spotify / SoundCloud). At least one must stay on;
  // both default on; persisted. The SoundCloud toggle only matters once a
  // SoundCloud account is connected.
  const [sources, setSources] = React.useState(() => {
    try {
      const s = JSON.parse(window.localStorage.getItem(SOURCES_KEY));
      if (s && (s.spotify || s.soundcloud)) {
        return { spotify: !!s.spotify, soundcloud: !!s.soundcloud };
      }
    } catch (e) {}
    return { spotify: true, soundcloud: true };
  });
  const setSource = (key, on) =>
    setSources((prev) => {
      const next = { ...prev, [key]: on };
      if (!next.spotify && !next.soundcloud) return prev; // keep >=1 on
      window.localStorage.setItem(SOURCES_KEY, JSON.stringify(next));
      return next;
    });

  // Fetch the SoundCloud crate list once connected (independent of the toggle,
  // so flipping it on is instant). Rebuilds the fetcher when the token rotates.
  const scFetch = React.useMemo(
    () =>
      scConnected
        ? buildScFetch({
            token: scToken,
            backend: props.soundcloudBackend,
            onRefreshToken: props.onRefreshSoundcloud,
          })
        : null,
    [scConnected, scToken, props.soundcloudBackend, props.onRefreshSoundcloud]
  );
  React.useEffect(() => {
    if (!scFetch) {
      setScCrates(null);
      return;
    }
    let cancelled = false;
    fetchSoundcloudCrates(scFetch)
      .then((c) => !cancelled && setScCrates(c))
      .catch((e) => {
        console.error("Failed to load SoundCloud crates", e);
        if (!cancelled) setScCrates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scFetch]);

  // Only matters when "Disable Sets" is on: resolve the set-count of playlists
  // whose tracks weren't embedded, so all-set crates can be dropped from the
  // grid. Lazy (paid only when the toggle is used), cached, and the ref guards
  // against refetching the same crate.
  React.useEffect(() => {
    if (!scFetch || !props.hideSets || !scCrates) return;
    const todo = scCrates.filter(
      (c) =>
        c.kind === "playlist" &&
        c.nonSetCount == null &&
        !setCountTriedRef.current.has(c.id)
    );
    if (!todo.length) return;
    todo.forEach((c) => setCountTriedRef.current.add(c.id));
    let cancelled = false;
    fetchScSetCounts(scFetch, todo).then((counts) => {
      if (cancelled || !Object.keys(counts).length) return;
      setScCrates((prev) =>
        prev
          ? prev.map((c) =>
              counts[c.id] != null ? { ...c, nonSetCount: counts[c.id] } : c
            )
          : prev
      );
    });
    return () => {
      cancelled = true;
    };
  }, [scFetch, props.hideSets, scCrates]);

  // Normalized, source-agnostic crate list — the merge of the active sources.
  // Everything below (search, sort, folders, selection, rendering) uses this.
  const spotifyLib = React.useMemo(
    () => (props.pllibrary || []).map(normalizeSpotifyCrate),
    [props.pllibrary]
  );
  const scLib = React.useMemo(
    () => (scCrates || []).map(normalizeSoundcloudCrate),
    [scCrates]
  );
  const library = React.useMemo(() => {
    const out = [];
    if (sources.spotify) out.push(...spotifyLib);
    if (scConnected && sources.soundcloud) out.push(...scLib);
    return out;
  }, [spotifyLib, scLib, sources, scConnected]);

  // An active source whose crates haven't arrived yet (Spotify playlists not
  // loaded, or SoundCloud crates still fetching — which can be slow on a cold
  // backend). Used so the grid shows a spinner instead of "No crates to show".
  const scLoading = scConnected && sources.soundcloud && scCrates == null;
  const libraryLoading =
    (sources.spotify && props.pllibrary == null) || scLoading;

  const [loadingPlaylist, setLoadingPlaylist] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState(null);
  const [loadingAll, setLoadingAll] = React.useState(false);
  const [allProgress, setAllProgress] = React.useState({ done: 0, total: 0 });
  // Set when the user dismisses the "Search all crates" loader; in-flight and
  // queued fetches check this and bail so a big library doesn't trap them.
  const cancelAllRef = React.useRef(false);
  // Per-session in-memory cache of crate track/audio-feature fetches, keyed by
  // crate uid (`sp:<id>` / `sc:<id>`). Re-opening a crate already loaded this
  // session is then instant — no re-fetch of tracks + features. Lives on a ref
  // so it persists across re-renders but clears on refresh AND on logout (when
  // PLLibrary unmounts), so it never leaks one account's data to another.
  // Minor staleness if a crate is edited mid-session is acceptable.
  const crateCacheRef = React.useRef(new Map());
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
  const [searchItems, setSearchItems] = React.useState(library);
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

  const toggleFavorite = (e, crate) => {
    e.stopPropagation();
    updateMeta(crate.uid, { favorite: !metaFor(crate.uid).favorite });
  };

  const toggleHidden = (e, crate) => {
    e.stopPropagation();
    updateMeta(crate.uid, { hidden: !metaFor(crate.uid).hidden });
  };

  // Tag/genre editing popover + library filter.
  const [tagEdit, setTagEdit] = React.useState({ anchorEl: null, id: null });
  const [tagInput, setTagInput] = React.useState("");
  const [metaFilter, setMetaFilter] = React.useState([]);
  // Anchors for the Sort / Filter dropdown menus (Button + Menu controls).
  const [sortAnchor, setSortAnchor] = React.useState(null);
  const [filterAnchor, setFilterAnchor] = React.useState(null);
  const toggleMetaFilter = (v) =>
    setMetaFilter((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );

  const openTagEdit = (e, crate) => {
    e.stopPropagation();
    setTagInput("");
    setTagEdit({ anchorEl: e.currentTarget, id: crate.uid });
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
  const favoritesOnly = props.favoritesOnly;
  const sortedCrates = React.useMemo(() => {
    const arr = (searchItems || []).filter((c) => {
      const m = crateMeta[c.uid] || {};
      const hidden = !!m.hidden;
      if (showHidden ? !hidden : hidden) return false;
      // "Favorites" view: only crates the user has starred.
      if (favoritesOnly && !showHidden && !m.favorite) return false;
      // "Disable Sets": drop SoundCloud crates that are entirely sets (nothing
      // would be left to show). Unknown counts (null) stay visible.
      if (props.hideSets && c.source === "soundcloud" && c.nonSetCount === 0) {
        return false;
      }
      if (metaFilter.length > 0) {
        const vals = [...(m.tags || []), ...(m.genres || [])];
        if (!metaFilter.some((f) => vals.includes(f))) return false;
      }
      return true;
    });
    arr.sort((a, b) => {
      if (!showHidden) {
        const fa = crateMeta[a.uid] && crateMeta[a.uid].favorite ? 1 : 0;
        const fb = crateMeta[b.uid] && crateMeta[b.uid].favorite ? 1 : 0;
        if (fa !== fb) return fb - fa; // favorites first
      }
      if (crateSort === "tracks") {
        return (b.trackCount || 0) - (a.trackCount || 0);
      }
      if (crateSort === "owner") {
        return (a.ownerName || "").localeCompare(b.ownerName || "");
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    return arr;
  }, [
    searchItems,
    crateSort,
    crateMeta,
    showHidden,
    favoritesOnly,
    metaFilter,
    props.hideSets,
  ]);

  const pagedCrates = sortedCrates.slice(
    cratePage * cratesPerPage,
    cratePage * cratesPerPage + cratesPerPage
  );

  React.useEffect(() => {
    setCratePage(0);
  }, [searchItems, crateSort, cratesPerPage, metaFilter, favoritesOnly]);

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
    }
  };

  useEffect(() => {
    if (search === "") {
      setSearchItems(library);
      return;
    }
    setSearchItems(
      library.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.description || "").toLowerCase().includes(search) ||
          (c.ownerName || "").toLowerCase().includes(search)
      )
    );
  }, [search, library]);

  let handleChange = _.debounce((event) => {
    event.persist();
    setSearch(String(event.target.value).toLowerCase());
  }, 500);

  let handlePlaylistOpen = async (crate) => {
    setLoadingPlaylist(true);
    setLoadingId(crate.uid);

    setPlaylistName(crate.name);
    setPlaylistId(crate.uid);
    setPlaylistOwnerId(crate.raw.owner.id);

    try {
      // Cached by uid — instant on a re-open this session.
      const { items, features } = await getSpotifyCrate(
        crate.uid,
        crate.raw && crate.raw.snapshot_id
      );
      setCurrPlaylist(items);
      setPlaylistKeys(features);
      setShowPlaylist(true);
    } catch (error) {
      console.error("Failed to load playlist", error);
    } finally {
      // Always clear the loading state, even if a request failed, so the
      // spinner never gets stuck.
      setLoadingPlaylist(false);
      setLoadingId(null);
    }
  };

  let handlePlaylistClose = () => {
    setShowPlaylist(false);
  };

  // SoundCloud crates open through the SAME Playlist view as Spotify/mixed
  // crates — via CombinedPlaylist with no Spotify items, which gives the orange
  // header, the full filter toolbar, auto-analysis + the global indicator, and
  // bottom-bar playback for free. Tracks load through the cached getScCrate;
  // "Disable Sets" drops likely DJ sets, matching the old standalone view.
  const openScCrate = async (crate) => {
    setLoadingPlaylist(true);
    setLoadingId(crate.uid);
    try {
      let scTracks = await getScCrate(crate);
      if (props.hideSets) {
        scTracks = scTracks.filter((t) => !isLikelySet(t.duration));
      }
      setCombinedData({
        spotifyItems: [],
        spotifyFeatures: [],
        scTracks,
        title: `${crate.name} · ${scTracks.length} tracks`,
      });
    } catch (e) {
      console.error("Failed to open SoundCloud crate", e);
    } finally {
      setLoadingPlaylist(false);
      setLoadingId(null);
    }
  };

  // Retry a Spotify API call on 429 (rate limit), honoring the Retry-After
  // header. Opening many crates at once bursts past Spotify's limit; without
  // this a single 429 would fail the whole Open(N) batch.
  const spotifyRetry = async (fn, attempts = 8) => {
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        const status = (e && e.status) || (e && e.response && e.response.status);
        if (status === 429 && i < attempts) {
          // Spotify doesn't expose Retry-After to browser JS (CORS) — reading it
          // logs "Refused to get unsafe header" — so back off exponentially with
          // jitter instead. Jitter de-syncs the parallel workers so they don't
          // all re-burst at the same instant. 1.5s → 3 → 6 → 12 → 20s (capped).
          const base = Math.min(20000, 1500 * Math.pow(2, i));
          const waitMs = Math.round(base * (0.7 + Math.random() * 0.6));
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw e;
      }
    }
  };

  // --- Cross-playlist search: load every crate's tracks into one virtual
  // playlist, then reuse the normal Playlist view to search/filter across them.
  const fetchAllTracks = async (playlistId) => {
    let items = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const off = offset; // per-iteration capture for the retry closure
      const res = await spotifyRetry(() =>
        spotifyWebApi.getPlaylistTracks(playlistId, { offset: off, limit: 100 })
      );
      items = items.concat(res.items || []);
      if (!res.next) break;
      offset += 100;
    }
    return items.filter((it) => it.track && it.track.id);
  };

  const fetchFeatures = async (ids) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await spotifyRetry(() =>
        spotifyWebApi.getAudioFeaturesForTracks(ids.slice(i, i + 100))
      );
      out.push(...(res.audio_features || []));
    }
    return out;
  };

  // Run `fetcher` once per cache key, reusing the result across the session AND
  // (when a `version` token is given) across browser restarts via IndexedDB.
  // `version` is a freshness token (Spotify snapshot_id / SoundCloud track-count)
  // — a stored entry is only reused when its version still matches, so an edited
  // crate auto-refetches. A falsy version means in-memory only (don't persist).
  // Failures aren't cached (the throw happens before the set).
  const cachedCrate = async (key, version, fetcher) => {
    const mem = crateCacheRef.current.get(key);
    if (mem && mem.__v === version) return mem.data;
    if (version) {
      const persisted = await idbGet(key);
      if (persisted && persisted.__v === version) {
        crateCacheRef.current.set(key, persisted);
        return persisted.data;
      }
    }
    const data = await fetcher();
    const rec = { __v: version, data };
    crateCacheRef.current.set(key, rec);
    if (version) idbSet(key, rec);
    return data;
  };

  // A Spotify crate's tracks + audio features, cached by uid + snapshot_id (so
  // an edited playlist auto-refetches).
  const getSpotifyCrate = (uid, snapshot) =>
    cachedCrate(`sp:${uid}`, snapshot || null, async () => {
      const items = await fetchAllTracks(uid);
      const features = await fetchFeatures(items.map((t) => t.track.id));
      return { items, features };
    });

  // A SoundCloud crate's full track list, cached by uid. Playlists persist
  // (keyed by track-count); likes/reposts stay in-memory only (their counts grow
  // and the count we have is only the first page — persisting would go stale).
  const getScCrate = async (c) => {
    const k = c.raw.kind;
    const path =
      k === "likes"
        ? "/soundcloud/me/likes/tracks"
        : k === "reposts"
        ? "/soundcloud/me/reposts"
        : "/soundcloud/playlists/" + encodeURIComponent(c.raw.id) + "/tracks";
    const version = k === "playlist" && c.count != null ? `n${c.count}` : null;
    const { tracks } = await cachedCrate(`sc:${c.uid}`, version, async () => ({
      tracks: await fetchScTracks(scFetch, path),
    }));
    return tracks;
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

  // Dismiss the cross-search loader and abort the remaining fetches.
  const cancelSearchAll = () => {
    cancelAllRef.current = true;
    setLoadingAll(false);
  };

  const handleOpenSelected = async () => {
    // Selected crates across both sources. The `!hidden` guard keeps hidden
    // crates out of Open(N) from the NORMAL library, but must NOT apply inside
    // the Hidden-crates view (showHidden) — otherwise Open(N) there strips every
    // crate and silently no-ops.
    const chosen = library.filter(
      (c) =>
        selected.has(c.uid) &&
        (showHidden || !(crateMeta[c.uid] && crateMeta[c.uid].hidden))
    );
    if (chosen.length === 0) return;
    const spotifyCrates = chosen.filter((c) => c.source === "spotify");
    const scCratesSel = chosen.filter((c) => c.source === "soundcloud");

    cancelAllRef.current = false;
    setAllProgress({ done: 0, total: chosen.length });
    setLoadingAll(true);
    try {
      // Pure-Spotify selection → the rich Playlist view (audio features +
      // recommendations + set builder). Unchanged behavior.
      if (scCratesSel.length === 0) {
        const perPlaylist = await mapWithLimit(spotifyCrates, 3, async (c) => {
          if (cancelAllRef.current) return { tracks: [], features: [] };
          const { items, features } = await getSpotifyCrate(
            c.uid,
            c.raw && c.raw.snapshot_id
          );
          setAllProgress((p) => ({ ...p, done: p.done + 1 }));
          return { tracks: items, features };
        });
        if (cancelAllRef.current) return;
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
        setPlaylistName(
          `${spotifyCrates.length} crate${spotifyCrates.length === 1 ? "" : "s"} · ${allTracks.length} tracks`
        );
        setPlaylistId("__all_crates__");
        setPlaylistOwnerId(null); // hides owner-only Recommendations
        setCurrPlaylist(allTracks);
        setPlaylistKeys(Array.from(featById.values()));
        setShowPlaylist(true);
        return;
      }

      // SoundCloud-inclusive selection → the combined view, which renders through
      // the real Playlist (via CombinedPlaylist). Gather the RAW per-source
      // material; CombinedPlaylist shapes SoundCloud tracks into Spotify-item
      // form and synthesizes their keys.
      const spotifyItems = [];
      const seenSp = new Set();
      const featById = new Map();
      await mapWithLimit(spotifyCrates, 3, async (c) => {
        if (cancelAllRef.current) return;
        const { items, features: feats } = await getSpotifyCrate(
          c.uid,
          c.raw && c.raw.snapshot_id
        );
        feats.forEach((f) => f && featById.set(f.id, f));
        items.forEach((item) => {
          if (seenSp.has(item.track.id)) return;
          seenSp.add(item.track.id);
          spotifyItems.push(item);
        });
        setAllProgress((p) => ({ ...p, done: p.done + 1 }));
      });

      const scTracksAll = [];
      const seenSc = new Set();
      await mapWithLimit(scCratesSel, 4, async (c) => {
        if (cancelAllRef.current) return;
        const scTracks = await getScCrate(c);
        scTracks.forEach((tr) => {
          const urn = tr.urn || String(tr.id);
          if (seenSc.has(urn)) return;
          seenSc.add(urn);
          scTracksAll.push(tr);
        });
        setAllProgress((p) => ({ ...p, done: p.done + 1 }));
      });

      if (cancelAllRef.current) return;
      const spotifyFeatures = Array.from(featById.values());
      setCombinedData({
        spotifyItems,
        spotifyFeatures,
        scTracks: scTracksAll,
        title: `${chosen.length} crate${chosen.length === 1 ? "" : "s"} · ${
          spotifyItems.length + scTracksAll.length
        } tracks`,
      });
    } catch (error) {
      console.error("Failed to load selected crates", error);
    } finally {
      setLoadingAll(false);
    }
  };

  // Open the user's Spotify Liked Songs as a virtual crate.
  const handleOpenLikedSongs = async () => {
    setLoadingPlaylist(true);
    setLoadingId("__liked__");
    try {
      // Cached by uid — re-opening Liked Songs this session is instant instead
      // of re-paging the whole saved-tracks library.
      const { items: tracks, features } = await cachedCrate(
        "sp:__liked__",
        null,
        async () => {
          let items = [];
          let offset = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const off = offset; // per-iteration capture for the retry closure
            const res = await spotifyRetry(() =>
              spotifyWebApi.getMySavedTracks({ limit: 50, offset: off })
            );
            items = items.concat(res.items || []);
            if (!res.next) break;
            offset += 50;
          }
          const filtered = items.filter((it) => it.track && it.track.id);
          const feats = await fetchFeatures(filtered.map((t) => t.track.id));
          return { items: filtered, features: feats.filter(Boolean) };
        }
      );

      setPlaylistName(`Liked Songs · ${tracks.length} tracks`);
      setPlaylistId("__liked__");
      setPlaylistOwnerId(null); // hides owner-only Recommendations
      setCurrPlaylist(tracks);
      setPlaylistKeys(features);
      setShowPlaylist(true);
    } catch (error) {
      console.error("Failed to load liked songs", error);
    } finally {
      setLoadingPlaylist(false);
      setLoadingId(null);
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
    sortedCrates.forEach((c) => {
      const fid = (crateMeta[c.uid] || {}).folderId;
      if (fid && folderIds.has(fid)) groups[fid].push(c);
      else groups.__root__.push(c);
    });
    return groups;
  }, [sortedCrates, folders, crateMeta]);

  // A crate rendered as a cover-art tile: the playlist artwork as a banner
  // (with the cross-search checkbox + favorite star overlaid), then title /
  // owner / cleaned description / track + tag chips, and a footer action row.
  const renderCrateCard = (crate) => {
    const meta = metaFor(crate.uid);
    const img = crate.image;
    const desc = cleanDescription(crate.description);
    const isSelected = selected.has(crate.uid);
    const isSc = crate.source === "soundcloud";
    const accent = isSc ? SC_ORANGE : SPOTIFY_GREEN;
    // With "Disable Sets" on, show the non-set count (once known) so the chip
    // matches what's actually inside the crate.
    const displayCount =
      isSc && props.hideSets && crate.nonSetCount != null
        ? crate.nonSetCount
        : crate.trackCount;
    return (
      <Card
        key={crate.uid}
        className={classes.tileCard}
        onClick={() => toggleSelect(crate.uid)}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          border: isSelected
            ? `2px solid ${SPOTIFY_GREEN}`
            : meta.favorite
            ? `1px solid ${accent}`
            : "1px solid rgba(128,128,128,0.18)",
          backgroundColor: isSelected ? "rgba(30,215,96,0.08)" : undefined,
        }}
      >
        <Box
          className={classes.tileCover}
          style={img ? { backgroundImage: `url(${img})` } : {}}
        >
          {!img &&
            (isSc ? (
              <Cloud style={{ color: "#fff", fontSize: 42, opacity: 0.9 }} />
            ) : (
              <MusicNote style={{ color: "#fff", fontSize: 42, opacity: 0.85 }} />
            ))}
          {/* Source badge — provenance always visible in the unified grid. */}
          <span
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              backgroundColor: accent,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            {isSc ? (
              <SoundcloudIcon size={13} color="#fff" />
            ) : (
              <SpotifyIcon size={12} color="#fff" />
            )}
            {isSc ? "SoundCloud" : "Spotify"}
          </span>
          {/* Select for a combined open — Spotify + SoundCloud mix freely. */}
          <Checkbox
            key={selected.has(crate.uid) ? "on" : "off"}
            className={`${classes.tileCheckbox} ${
              selected.has(crate.uid) ? classes.iconPop : ""
            }`}
            checked={selected.has(crate.uid)}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(crate.uid);
            }}
            title="Select to open combined"
            size="small"
          />
          <IconButton
            className={classes.tileFav}
            size="small"
            onClick={(e) => toggleFavorite(e, crate)}
            title={meta.favorite ? "Unfavorite" : "Favorite"}
            aria-label="favorite crate"
          >
            <span
              key={meta.favorite ? "fav" : "unfav"}
              className={meta.favorite ? classes.iconPop : ""}
              style={{ display: "inline-flex" }}
            >
              {meta.favorite ? (
                <Star style={{ color: accent }} fontSize="small" />
              ) : (
                <StarBorder style={{ color: "#fff" }} fontSize="small" />
              )}
            </span>
          </IconButton>
          {loadingId === crate.uid && (
            <Box className={classes.tileLoading}>
              <CircularProgress size={28} style={{ color: "#fff" }} />
            </Box>
          )}
        </Box>

        <CardContent className={classes.tileBody}>
          <Typography
            className={classes.playlistTitle}
            noWrap
            title={crate.name}
          >
            {crate.name}
          </Typography>
          <Typography className={classes.ownerText} noWrap>
            {isSc ? crate.ownerName : `by ${crate.ownerName}`}
          </Typography>
          {desc && (
            <Typography className={classes.tileDesc}>{desc}</Typography>
          )}
          <Box className={classes.tileMeta}>
            <Chip
              label={`${displayCount}${crate.more ? "+" : ""} tracks`}
              size="small"
              className={classes.trackChip}
              style={{ backgroundColor: accent }}
              icon={<MusicNote style={{ color: "#fff" }} />}
            />
            {(meta.genres || []).map((g) => (
              <Chip key={`g-${g}`} label={g} size="small" variant="outlined" />
            ))}
            {(meta.tags || []).map((t) => (
              <Chip
                key={`t-${t}`}
                label={`#${t}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </CardContent>

        <Box className={classes.tileActions}>
          <IconButton
            size="small"
            onClick={(e) => openTagEdit(e, crate)}
            title="Tags, genres & folder"
            aria-label="organize crate"
          >
            <LocalOffer fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => toggleHidden(e, crate)}
            title={meta.hidden ? "Unhide" : "Hide"}
            aria-label="hide crate"
          >
            <VisibilityOff
              fontSize="small"
              style={{ color: meta.hidden ? accent : undefined }}
            />
          </IconButton>
          <Box style={{ flex: 1 }} />
          <Button
            size="small"
            className={classes.openButton}
            startIcon={<MenuOpen fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              if (isSc) openScCrate(crate);
              else handlePlaylistOpen(crate);
            }}
            title="Open crate for digging"
            aria-label="open crate"
            style={{ textTransform: "none", fontWeight: 600, color: accent }}
          >
            Open
          </Button>
        </Box>
      </Card>
    );
  };

  // Lay crates out as a responsive grid of cover tiles — denser and more
  // visual than the old full-width rows, and it actually uses the page width.
  // `leadingTile` (e.g. Liked Songs) occupies the first cell so it flows with
  // the crates instead of sitting alone on its own row.
  const renderCrateGrid = (crates, leadingTile) => (
    <Grid container spacing={2}>
      {leadingTile && (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={3}
          className={classes.tileIn}
          style={{ animationDelay: "0ms" }}
        >
          {leadingTile}
        </Grid>
      )}
      {crates.map((p, i) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={3}
          key={p.uid}
          className={classes.tileIn}
          style={{
            animationDelay: `${Math.min(i + (leadingTile ? 1 : 0), 14) * 35}ms`,
          }}
        >
          {renderCrateCard(p)}
        </Grid>
      ))}
    </Grid>
  );

  // The Liked Songs virtual crate, styled as a cover tile (matching the grid)
  // so it sits at the top as the first card.
  const renderLikedTile = () => (
    <Card
      className={classes.tileCard}
      onClick={handleOpenLikedSongs}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #1ED760",
      }}
    >
      <Box
        className={classes.tileCover}
        style={{ background: "linear-gradient(135deg,#450af5,#c4efd9)" }}
      >
        <Favorite style={{ color: "#fff", fontSize: 42 }} />
        {loadingId === "__liked__" && (
          <Box className={classes.tileLoading}>
            <CircularProgress size={28} style={{ color: "#fff" }} />
          </Box>
        )}
      </Box>
      <CardContent className={classes.tileBody}>
        <Typography className={classes.playlistTitle} noWrap>
          Liked Songs
        </Typography>
        <Typography className={classes.ownerText} noWrap>
          Your Spotify Liked Songs
        </Typography>
      </CardContent>
      <Box className={classes.tileActions}>
        <Box style={{ flex: 1 }} />
        <Button
          size="small"
          className={classes.openButton}
          startIcon={<MenuOpen fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLikedSongs();
          }}
          title="Open Liked Songs"
          aria-label="open liked songs"
          style={{ textTransform: "none", fontWeight: 600 }}
        >
          Open
        </Button>
      </Box>
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
      <Collapse in={isExpanded(key)} timeout={320} unmountOnExit>
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
            renderCrateGrid(crates)
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
      <Box
        sx={{ padding: isMobile ? 1 : 2 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Paper elevation={0} className={classes.searchPill}>
          <Input
            disableUnderline
            fullWidth
            type="text"
            onChange={handleChange}
            placeholder="Search Crates"
            endAdornment={
              <InputAdornment position="end">
                <Search style={{ color: theme.palette.text.secondary }} />
              </InputAdornment>
            }
          />
        </Paper>
        {/* Source toggles — both default on, at least one always stays on. */}
        {scConnected && (
          <>
            <Chip
              label="Spotify"
              clickable
              onClick={() => setSource("spotify", !sources.spotify)}
              icon={
                <SpotifyIcon
                  size={17}
                  color={sources.spotify ? "#fff" : SPOTIFY_GREEN}
                  style={{ marginLeft: 8 }}
                />
              }
              style={{
                backgroundColor: sources.spotify ? SPOTIFY_GREEN : "transparent",
                color: sources.spotify ? "#fff" : theme.palette.text.secondary,
                border: `1px solid ${SPOTIFY_GREEN}`,
                fontWeight: 700,
              }}
            />
            <Chip
              label="SoundCloud"
              clickable
              onClick={() => setSource("soundcloud", !sources.soundcloud)}
              icon={
                <SoundcloudIcon
                  size={18}
                  color={sources.soundcloud ? "#fff" : SC_ORANGE}
                  style={{ marginLeft: 8 }}
                />
              }
              style={{
                backgroundColor: sources.soundcloud ? SC_ORANGE : "transparent",
                color: sources.soundcloud ? "#fff" : theme.palette.text.secondary,
                border: `1px solid ${SC_ORANGE}`,
                fontWeight: 700,
              }}
            />
          </>
        )}
      </Box>

      {/* Crates / Folders tab toggle (normal Library view only). */}
      {!showHidden && !favoritesOnly && (
        <Box sx={{ paddingLeft: isMobile ? 1 : 2, paddingRight: isMobile ? 1 : 2 }}>
          <Tabs
            value={folderView ? 1 : 0}
            onChange={(e, v) => setFolderView(v === 1)}
            indicatorColor="primary"
            textColor="primary"
            variant={isMobile ? "fullWidth" : "standard"}
            style={{ borderBottom: "1px solid rgba(128,128,128,0.18)" }}
          >
            <Tab
              label="Crates"
              style={{ textTransform: "none", fontWeight: 700, minWidth: 120 }}
            />
            <Tab
              label="Folders"
              style={{ textTransform: "none", fontWeight: 700, minWidth: 120 }}
            />
          </Tabs>
        </Box>
      )}

      <Dialog
        open={loadingAll}
        onClose={cancelSearchAll}
        PaperProps={{
          style: {
            position: "relative",
            padding: "26px 36px 30px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            borderRadius: 12,
          },
        }}
      >
        {/* Small close (X) in the corner cancels the load. */}
        <IconButton
          size="small"
          onClick={cancelSearchAll}
          aria-label="cancel"
          title="Cancel"
          style={{ position: "absolute", top: 6, right: 6 }}
        >
          <Close fontSize="small" />
        </IconButton>
        {/* The crate-loader style is chosen in Settings → Crate loaders. */}
        <div style={{ display: "flex", alignItems: "center", minHeight: 84 }}>
          <MusicSpinner variant={props.loaderStyle || "cdj"} />
        </div>
        <Typography variant="body1" style={{ fontWeight: 700 }}>
          Loading all crates…
        </Typography>
        <FillBar done={allProgress.done} total={allProgress.total} />
      </Dialog>

      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 12,
          columnGap: 12,
          padding: isMobile ? "14px 8px" : "20px 16px",
        }}
      >
        <Box style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Sort — a Button + Menu so it matches the Folders button. */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<SortByAlpha style={{ color: "#1ED760" }} />}
            endIcon={<ArrowDropDown />}
            onClick={(e) => setSortAnchor(e.currentTarget)}
            style={{ textTransform: "none", borderRadius: 8 }}
          >
            <span style={{ color: theme.palette.text.secondary, fontWeight: 400 }}>
              Sort:&nbsp;
            </span>
            {{ name: "Name", tracks: "Track count", owner: "Owner" }[crateSort]}
          </Button>
          <Menu
            anchorEl={sortAnchor}
            open={Boolean(sortAnchor)}
            onClose={() => setSortAnchor(null)}
            getContentAnchorEl={null}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            {[
              ["name", "Name"],
              ["tracks", "Track count"],
              ["owner", "Owner"],
            ].map(([val, label]) => (
              <MenuItem
                key={val}
                selected={crateSort === val}
                onClick={() => {
                  setCrateSort(val);
                  setSortAnchor(null);
                }}
              >
                {label}
              </MenuItem>
            ))}
          </Menu>

          {allTagsGenres.length > 0 && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterList style={{ color: "#1ED760" }} />}
                endIcon={<ArrowDropDown />}
                onClick={(e) => setFilterAnchor(e.currentTarget)}
                style={{ textTransform: "none", borderRadius: 8 }}
              >
                <span
                  style={{ color: theme.palette.text.secondary, fontWeight: 400 }}
                >
                  Filter:&nbsp;
                </span>
                {metaFilter.length === 0
                  ? "All"
                  : metaFilter.length === 1
                  ? metaFilter[0]
                  : `${metaFilter.length} selected`}
              </Button>
              <Menu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                getContentAnchorEl={null}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              >
                {allTagsGenres.map((v) => (
                  <MenuItem key={v} onClick={() => toggleMetaFilter(v)} dense>
                    <Checkbox
                      checked={metaFilter.includes(v)}
                      size="small"
                      style={{ padding: 4, marginRight: 6 }}
                    />
                    <ListItemText primary={v} />
                  </MenuItem>
                ))}
                {metaFilter.length > 0 && (
                  <MenuItem
                    onClick={() => {
                      setMetaFilter([]);
                      setFilterAnchor(null);
                    }}
                    style={{ color: theme.palette.text.secondary }}
                  >
                    Clear filters
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        </Box>
        <Box style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(() => {
            const shownIds = sortedCrates.map((c) => c.uid);
            const allSelected =
              shownIds.length > 0 && shownIds.every((id) => selected.has(id));
            return (
              <Button
                size="small"
                onClick={() =>
                  allSelected ? clearSelection() : setSelected(new Set(shownIds))
                }
                disabled={shownIds.length === 0}
                style={{ textTransform: "none", borderRadius: 8 }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
            );
          })()}
          {selected.size > 0 && (
            <Button
              size="small"
              onClick={clearSelection}
              startIcon={<Close fontSize="small" />}
              style={{ textTransform: "none", borderRadius: 8 }}
            >
              Clear ({selected.size})
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<MenuOpen />}
            disabled={selected.size === 0}
            onClick={handleOpenSelected}
            style={{ textTransform: "none", borderRadius: 8, fontWeight: 600 }}
          >
            Open (
            <span
              key={selected.size}
              className={classes.countBump}
              style={{ display: "inline-block" }}
            >
              {selected.size}
            </span>
            )
          </Button>
          {folderView && (
            <Button
              size="small"
              startIcon={<CreateNewFolder />}
              onClick={handleNewFolder}
              style={{ textTransform: "none", borderRadius: 8 }}
            >
              New folder
            </Button>
          )}
          <Typography variant="caption" color="textSecondary">
            {sortedCrates.length} crate{sortedCrates.length === 1 ? "" : "s"}
          </Typography>
          {scLoading && sortedCrates.length > 0 && (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <CircularProgress size={11} style={{ color: SC_ORANGE }} />
              loading SoundCloud…
            </Typography>
          )}
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

      {favoritesOnly && !showHidden && (
        <Box sx={{ padding: isMobile ? 1 : 2 }} style={{ paddingTop: 0 }}>
          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            ★ Favorite crates
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Star a crate to pin it here.
          </Typography>
        </Box>
      )}

      {sortedCrates.length === 0 &&
        (libraryLoading ? (
          <Box style={{ padding: 56, textAlign: "center" }}>
            <CircularProgress style={{ color: "#1ED760" }} />
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginTop: 12 }}
            >
              Loading your library…
            </Typography>
          </Box>
        ) : (
          <Box sx={{ padding: isMobile ? 1 : 2 }}>
            <Typography variant="body2" color="textSecondary">
              {showHidden
                ? "No hidden crates."
                : favoritesOnly
                ? "No favorite crates yet — tap the ★ on a crate to add one."
                : "No crates to show."}
            </Typography>
          </Box>
        ))}

      <div
        key={folderView ? "folders" : "crates"}
        className={classes.contentFade}
      >
        {folderView ? (
          <Box sx={{ padding: isMobile ? 0 : 1 }}>
            {renderFolderGroup("__root__", "Unfiled", grouped.__root__, null)}
            {folders.map((f) =>
              renderFolderGroup(f.id, f.name, grouped[f.id] || [], f)
            )}
          </Box>
        ) : (
          <Box sx={{ padding: isMobile ? 1 : 2 }}>
            {renderCrateGrid(
              pagedCrates,
              !showHidden && !favoritesOnly && cratePage === 0 && sources.spotify
                ? renderLikedTile()
                : null
            )}
          </Box>
        )}
      </div>

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

      {/* Combined multi-source view — rendered through the real Playlist so it's
          pixel-identical to the Spotify view. Used for a SoundCloud-inclusive
          Open(N) AND for a single SoundCloud crate (spotifyItems = []). */}
      <CombinedPlaylist
        open={Boolean(combinedData)}
        onClose={() => setCombinedData(null)}
        title={combinedData ? combinedData.title : ""}
        spotifyItems={combinedData ? combinedData.spotifyItems : []}
        spotifyFeatures={combinedData ? combinedData.spotifyFeatures : []}
        scTracks={combinedData ? combinedData.scTracks : []}
        scFetch={scFetch}
        token={props.token}
        userId={props.userId}
        updatePlayer={props.updatePlayer}
        onPlaySoundcloud={props.onPlaySoundcloud}
        onAddToSet={props.onAddToSet}
        onOpenSet={props.onOpenSet}
        setCount={props.setCount}
      />
    </>
  );
};
// Memoized so toggling unrelated app-level state (e.g. opening the Set drawer)
// doesn't re-render the whole library + playlist table. App passes stable props
// (bound methods + state that doesn't change on those toggles).
export default React.memo(PLLibrary);
