import React from "react";
import {
  makeStyles,
  withStyles,
  Dialog,
  Box,
  Typography,
  IconButton,
  Avatar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  TablePagination,
  AppBar,
  Toolbar,
  Input,
  InputAdornment,
  CircularProgress,
  Collapse,
} from "@material-ui/core";
import {
  ArrowBack,
  Close,
  Search,
  OpenInNew,
  DonutLarge,
  Delete,
  Equalizer,
} from "@material-ui/icons";

import {
  camelotColor,
  camelotInfo,
  musicalLabel,
  harmonicRelation,
} from "../../utils/harmonic";
import { camelotRank, fmtDuration } from "../../utils/unifiedTrack";
import { SpotifyIcon, SoundcloudIcon } from "../BrandIcons";
import { useScAnalysisQueue } from "../SoundCloud/useScAnalysisQueue";
import KeyFilterPicker from "./KeyFilterPicker";
import CrateDNA from "./CrateDNA";

const SC_ORANGE = "#ff5500";
const SPOTIFY_GREEN = "#1ED760";

// Dark Spotify-style toolbar, mirroring Playlist's useStyles (dark appBar,
// white search, white select icon/text, outlined white filter button).
const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "sticky",
    backgroundColor: "#191414",
  },
  title: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  search: {
    flex: 1,
    color: "white",
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(3),
    [theme.breakpoints.down("sm")]: {
      marginRight: 0,
      marginLeft: 0,
    },
  },
  filter: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
      marginBottom: theme.spacing(0.5),
      minWidth: "45%",
      maxWidth: "100%",
    },
  },
  // The small inline number inputs (BPM Min/Max, Year From/To) and their
  // "BPM:" / "to" / "Year:" labels, mirroring Playlist's minFilter/toFilter.
  minFilter: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    minWidth: 50,
    maxWidth: 60,
    [theme.breakpoints.down("sm")]: {
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
      minWidth: 60,
      maxWidth: 60,
    },
  },
  toFilter: {
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
    minWidth: 24,
    maxWidth: 30,
    [theme.breakpoints.down("sm")]: {
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
    },
  },
  inlineLabel: {
    color: "rgba(255,255,255,0.7)",
  },
  icon: {
    fill: "white",
  },
  root: {
    fill: "white",
    color: "white",
  },
}));

// Header cells sit on the colored (green / orange / split) header row, so they
// must be transparent with white bold text, and the sort labels must stay white
// — same approach SoundCloudCrate's ScHeadCell/ScSortLabel use.
const HeadCell = withStyles((theme) => ({
  head: {
    backgroundColor: "transparent",
    color: theme.palette.common.white,
    fontWeight: "bold",
  },
  body: { fontSize: 14 },
}))(TableCell);

const HeadSortLabel = withStyles({
  root: {
    color: "#fff",
    "&:hover": { color: "#fff" },
    "&:focus": { color: "#fff" },
    "&$active": { color: "#fff" },
  },
  active: { color: "#fff" },
  icon: { color: "#fff !important" },
})(TableSortLabel);

// The combined multi-source track browser: Spotify + SoundCloud tracks in one
// table. Spotify rows come fully populated (key/BPM/energy/released from audio
// features); SoundCloud rows get our key/BPM lazily (auto-analyzed on open) and
// keep an "open on SoundCloud" link. Superset columns blank out where a source
// has no data (Energy/Released for SC, Genre for Spotify). Per-source playback:
// Spotify → Web Playback bar, SoundCloud → the Widget bar.
//
// Props: open, onClose, title, tracks (unified[]), scFetch, updatePlayer,
// onPlaySoundcloud.
let CombinedCrate = (props) => {
  const { tracks, open, onClose, title } = props;
  const classes = useStyles();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState({ col: null, dir: "asc" });
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [playingUid, setPlayingUid] = React.useState(null);

  // The combined view is harmonic-first, so Camelot is the default notation.
  const [notation, setNotation] = React.useState("Camelot");
  // Key filter (Camelot codes) + the bottom-sheet picker.
  const [keyFilter, setKeyFilter] = React.useState([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState("camelot");
  // The "anchored" row's uid for harmonic-mixing highlighting (or null).
  const [anchorUid, setAnchorUid] = React.useState(null);

  // BPM range (both sources) and Year range / Energy band (Spotify-only data —
  // SoundCloud rows pass through these two filters). Stored as strings so a
  // blank field means "unbounded".
  const [minBpm, setMinBpm] = React.useState("");
  const [maxBpm, setMaxBpm] = React.useState("");
  const [minYear, setMinYear] = React.useState("");
  const [maxYear, setMaxYear] = React.useState("");
  const [energyFilter, setEnergyFilter] = React.useState("any");
  // Crate DNA panel toggle.
  const [showDNA, setShowDNA] = React.useState(false);

  const { analysis, enqueueAll } = useScAnalysisQueue(props.scFetch);

  // Auto-analyze the SoundCloud tracks on open so their key/BPM fill in (so you
  // can sort/mix the whole combined crate harmonically). Single-worker queue.
  React.useEffect(() => {
    if (!open || !tracks) return;
    const scRaw = tracks
      .filter((t) => t.source === "soundcloud")
      .map((t) => t.raw);
    if (scRaw.length) enqueueAll(scRaw);
  }, [open, tracks, enqueueAll]);

  // Overlay live SoundCloud analysis onto the unified rows.
  const merged = React.useMemo(() => {
    return (tracks || []).map((t) => {
      if (t.source !== "soundcloud") return t;
      const urn = t.raw.urn || String(t.raw.id);
      const a = analysis[urn];
      if (a && a.camelot)
        return { ...t, camelot: a.camelot, keyName: a.key, bpm: a.bpm, scStatus: "done" };
      if (a && a.isLikelySet) return { ...t, scStatus: "set" };
      if (a && a.status === "loading") return { ...t, scStatus: "loading" };
      if (a && a.error) return { ...t, scStatus: "error" };
      return { ...t, scStatus: "pending" };
    });
  }, [tracks, analysis]);

  const toggleKey = (code) =>
    setKeyFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const view = React.useMemo(() => {
    let list = merged;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          (t.artist || "").toLowerCase().includes(q)
      );
    }
    // Key filter holds Camelot codes; un-analyzed SoundCloud tracks (no camelot
    // yet) drop out while a key filter is active.
    if (keyFilter.length) {
      list = list.filter((t) => t.camelot && keyFilter.includes(t.camelot));
    }
    // BPM range applies to BOTH sources (both carry bpm). While a BPM bound is
    // active, rows with no bpm yet (un-analyzed SoundCloud) are EXCLUDED.
    const lo = minBpm === "" ? null : parseInt(minBpm, 10);
    const hi = maxBpm === "" ? null : parseInt(maxBpm, 10);
    if (lo != null || hi != null) {
      list = list.filter((t) => {
        if (t.bpm == null) return false;
        if (lo != null && t.bpm < lo) return false;
        if (hi != null && t.bpm > hi) return false;
        return true;
      });
    }
    // Year range is Spotify-only data: rows without a year (SoundCloud, null)
    // pass through; rows that HAVE a year must fall within the bound.
    const yFrom = minYear === "" ? null : parseInt(minYear, 10);
    const yTo = maxYear === "" ? null : parseInt(maxYear, 10);
    if (yFrom != null || yTo != null) {
      list = list.filter((t) => {
        if (t.releaseYear == null) return true;
        if (yFrom != null && t.releaseYear < yFrom) return false;
        if (yTo != null && t.releaseYear > yTo) return false;
        return true;
      });
    }
    // Energy band is Spotify-only data (0..1): rows without energy (SoundCloud,
    // null) pass through; rows that HAVE energy must fall in the band.
    if (energyFilter !== "any") {
      list = list.filter((t) => {
        if (t.energy == null) return true;
        if (energyFilter === "low") return t.energy < 0.4;
        if (energyFilter === "med") return t.energy >= 0.4 && t.energy <= 0.7;
        return t.energy > 0.7;
      });
    }
    if (sort.col) {
      const d = sort.dir === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => {
        switch (sort.col) {
          case "source":
            return d * a.source.localeCompare(b.source);
          case "title":
            return d * (a.title || "").localeCompare(b.title || "");
          case "artist":
            return d * (a.artist || "").localeCompare(b.artist || "");
          case "key":
            return d * (camelotRank(a.camelot) - camelotRank(b.camelot));
          case "bpm":
            return d * ((a.bpm || 1e9) - (b.bpm || 1e9));
          case "energy":
            return d * ((a.energy == null ? -1 : a.energy) - (b.energy == null ? -1 : b.energy));
          case "length":
            return d * ((a.durationMs || 0) - (b.durationMs || 0));
          default:
            return 0;
        }
      });
    }
    return list;
  }, [merged, search, keyFilter, minBpm, maxBpm, minYear, maxYear, energyFilter, sort]);

  React.useEffect(() => {
    setPage(0);
  }, [search, sort, keyFilter, minBpm, maxBpm, minYear, maxYear, energyFilter, tracks]);
  const paged = view.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const toggleSort = (col) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" }
    );

  // The "Sort by" dropdown drives the same `sort` state the column headers use:
  // selecting a column sorts ascending (or keeps the current dir if it's already
  // the active column), so the two controls stay in sync.
  const sortByColumn = (col) =>
    setSort((s) => (s.col === col ? s : { col, dir: "asc" }));

  // Reset every filter, the sort, and the harmonic anchor back to defaults.
  const clearFilters = () => {
    setSearch("");
    setKeyFilter([]);
    setMinBpm("");
    setMaxBpm("");
    setMinYear("");
    setMaxYear("");
    setEnergyFilter("any");
    setSort({ col: null, dir: "asc" });
    setAnchorUid(null);
  };

  const playRow = (t) => {
    setPlayingUid(t.uid);
    if (t.source === "spotify" && props.updatePlayer) {
      props.updatePlayer([t.spotifyUri], true);
    } else if (t.source === "soundcloud" && props.onPlaySoundcloud) {
      props.onPlaySoundcloud(t.raw);
    }
  };

  const toggleAnchor = (t) =>
    setAnchorUid((prev) => (prev === t.uid ? null : t.uid));

  // Camelot code of the anchored track (from the merged rows so SoundCloud
  // anchors work once analyzed).
  const anchorCamelot = React.useMemo(() => {
    if (!anchorUid) return null;
    const a = merged.find((t) => t.uid === anchorUid);
    return a ? a.camelot : null;
  }, [anchorUid, merged]);

  // Small per-row source badge.
  const sourceBadge = (source) => {
    const sc = source === "soundcloud";
    return (
      <span
        title={sc ? "SoundCloud" : "Spotify"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          backgroundColor: sc ? SC_ORANGE : SPOTIFY_GREEN,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 10,
        }}
      >
        {sc ? <SoundcloudIcon size={12} color="#fff" /> : <SpotifyIcon size={11} color="#fff" />}
      </span>
    );
  };

  // Render a Camelot code in the selected notation, keeping the colored pill.
  const keyLabel = (code) => {
    if (notation === "Musical") return musicalLabel(code) || code;
    if (notation === "Open") {
      const info = camelotInfo(code);
      return info ? info.open : code;
    }
    return code;
  };

  // The Key cell — a colored, clickable Camelot pill (clicking anchors the
  // track for harmonic highlighting), or a per-source placeholder.
  const keyCell = (t) => {
    if (t.camelot) {
      const c = camelotColor(t.camelot);
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            toggleAnchor(t);
          }}
          title="Click to highlight harmonic matches"
          style={{
            backgroundColor: c.bg,
            color: c.text,
            padding: "3px 8px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
            cursor: "pointer",
            display: "inline-block",
          }}
        >
          {keyLabel(t.camelot)}
        </span>
      );
    }
    if (t.scStatus === "loading") {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#888" }}>
          <CircularProgress size={12} style={{ color: SC_ORANGE }} />
          analyzing…
        </span>
      );
    }
    if (t.scStatus === "set") {
      return (
        <span
          style={{
            backgroundColor: SC_ORANGE,
            color: "#fff",
            padding: "2px 7px",
            borderRadius: 10,
            fontSize: "0.72rem",
            fontWeight: 700,
          }}
        >
          Set
        </span>
      );
    }
    return "—";
  };

  const energyCell = (t) => {
    if (t.energy == null) return "—";
    const pct = Math.round(t.energy * 100);
    return (
      <div
        title={`Energy ${pct}%`}
        style={{ width: 46, height: 6, background: "rgba(128,128,128,0.2)", borderRadius: 3 }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: 6,
            borderRadius: 3,
            background: `hsl(${(1 - t.energy) * 200}, 75%, 48%)`,
          }}
        />
      </div>
    );
  };

  const headCell = (col, label, align) => (
    <HeadCell sortDirection={sort.col === col ? sort.dir : false} align={align}>
      <HeadSortLabel
        active={sort.col === col}
        direction={sort.col === col ? sort.dir : "asc"}
        onClick={() => toggleSort(col)}
      >
        {label}
      </HeadSortLabel>
    </HeadCell>
  );

  const scCount = (tracks || []).filter((t) => t.source === "soundcloud").length;
  const analyzing =
    scCount > 0 &&
    merged.filter((t) => t.source === "soundcloud" && t.scStatus === "loading").length > 0;

  // Tri-state header color from which sources are present. Only Spotify → green;
  // only SoundCloud → orange; both → a diagonal split (green left / orange right)
  // with a thin white dividing line.
  const hasSpotify = (tracks || []).some((t) => t.source === "spotify");
  const hasSoundcloud = (tracks || []).some((t) => t.source === "soundcloud");
  let headerBg = SPOTIFY_GREEN;
  if (hasSpotify && hasSoundcloud) {
    headerBg =
      "linear-gradient(115deg, #1ED760 0%, #1ED760 calc(50% - 1px), #fff calc(50% - 1px), #fff calc(50% + 1px), #ff5500 calc(50% + 1px), #ff5500 100%)";
  } else if (hasSoundcloud && !hasSpotify) {
    headerBg = SC_ORANGE;
  }

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="back" title="Back to crates">
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            {title}
          </Typography>
          {analyzing && (
            <Typography
              variant="caption"
              style={{ color: "rgba(255,255,255,0.7)", display: "inline-flex", alignItems: "center", gap: 5, marginRight: 8, whiteSpace: "nowrap" }}
            >
              <CircularProgress size={12} style={{ color: SC_ORANGE }} />
              analyzing SoundCloud keys…
            </Typography>
          )}
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
        </Toolbar>
        <Toolbar
          style={{
            flexWrap: "wrap",
            alignItems: "center",
            paddingTop: 4,
            paddingBottom: 8,
          }}
        >
          <Input
            classes={{ root: classes.search }}
            type="text"
            placeholder="Search these tracks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <Search style={{ color: "rgba(255,255,255,0.8)" }} />
              </InputAdornment>
            }
          />
          <FormControl className={classes.filter}>
            <InputLabel style={{ color: "rgba(255,255,255,0.7)" }}>Notation</InputLabel>
            <Select
              value={notation}
              onChange={(e) => setNotation(e.target.value)}
              inputProps={{ classes: { icon: classes.icon, root: classes.root } }}
              input={<Input />}
            >
              {["Musical", "Camelot", "Open"].map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl className={classes.filter}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DonutLarge />}
              onClick={() => setPickerOpen(true)}
              style={{
                height: "100%",
                textTransform: "none",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.6)",
              }}
            >
              Filter by Key{keyFilter.length ? ` (${keyFilter.length})` : ""}
            </Button>
          </FormControl>

          {/* BPM range (both sources) */}
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>BPM:</InputLabel>
          </FormControl>
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>Min</InputLabel>
            <Input
              id="combinedMinBpm"
              type="number"
              classes={{ root: classes.root }}
              value={minBpm}
              onChange={(e) => setMinBpm(e.target.value)}
            />
          </FormControl>
          <FormControl className={classes.toFilter}>
            <InputLabel className={classes.inlineLabel}>to</InputLabel>
          </FormControl>
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>Max</InputLabel>
            <Input
              id="combinedMaxBpm"
              type="number"
              classes={{ root: classes.root }}
              value={maxBpm}
              onChange={(e) => setMaxBpm(e.target.value)}
            />
          </FormControl>

          {/* Year range (Spotify-only data; SoundCloud rows pass through) */}
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>Year:</InputLabel>
          </FormControl>
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>From</InputLabel>
            <Input
              id="combinedMinYear"
              type="number"
              classes={{ root: classes.root }}
              value={minYear}
              onChange={(e) => setMinYear(e.target.value)}
            />
          </FormControl>
          <FormControl className={classes.toFilter}>
            <InputLabel className={classes.inlineLabel}>to</InputLabel>
          </FormControl>
          <FormControl className={classes.minFilter}>
            <InputLabel className={classes.inlineLabel}>To</InputLabel>
            <Input
              id="combinedMaxYear"
              type="number"
              classes={{ root: classes.root }}
              value={maxYear}
              onChange={(e) => setMaxYear(e.target.value)}
            />
          </FormControl>

          {/* Sort by — drives the same `sort` state as the column headers */}
          <FormControl className={classes.filter}>
            <InputLabel className={classes.inlineLabel}>Sort by</InputLabel>
            <Select
              value={sort.col || ""}
              onChange={(e) => sortByColumn(e.target.value)}
              inputProps={{ classes: { icon: classes.icon, root: classes.root } }}
              input={<Input />}
            >
              <MenuItem value="source">Source</MenuItem>
              <MenuItem value="title">Track</MenuItem>
              <MenuItem value="artist">Artist</MenuItem>
              <MenuItem value="key">Key</MenuItem>
              <MenuItem value="bpm">BPM</MenuItem>
              <MenuItem value="energy">Energy</MenuItem>
              <MenuItem value="length">Length</MenuItem>
            </Select>
          </FormControl>

          {/* Energy band (Spotify-only data; SoundCloud rows pass through) */}
          <FormControl className={classes.filter}>
            <InputLabel className={classes.inlineLabel}>Energy</InputLabel>
            <Select
              value={energyFilter}
              onChange={(e) => setEnergyFilter(e.target.value)}
              inputProps={{ classes: { icon: classes.icon, root: classes.root } }}
              input={<Input />}
            >
              <MenuItem value="any">Any energy</MenuItem>
              <MenuItem value="low">Chill</MenuItem>
              <MenuItem value="med">Medium</MenuItem>
              <MenuItem value="high">Hype</MenuItem>
            </Select>
          </FormControl>

          <IconButton
            aria-label="clear filters"
            onClick={clearFilters}
            size="small"
            title="Clear all filters"
            style={{ color: "#fff", marginLeft: 8, marginBottom: 8 }}
          >
            <Delete />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* paddingBottom clears the fixed bottom player bar. */}
      <Box style={{ padding: 16, paddingBottom: 140 }}>
        <Typography variant="caption" color="textSecondary" style={{ display: "block", marginBottom: 12, paddingLeft: 4 }}>
          Combined crate · {(tracks || []).length} tracks. Spotify keys are from
          audio features; SoundCloud keys are computed by KeyTrack.
        </Typography>

        {/* Crate DNA panel over the merged tracks (each unified row carries its
            own Camelot, so CrateDNA reads it via getCamelot). */}
        <Box style={{ marginBottom: 4 }}>
          <Button
            size="small"
            startIcon={<Equalizer />}
            onClick={() => setShowDNA((v) => !v)}
            style={{ textTransform: "none" }}
          >
            {showDNA ? "Hide" : "Show"} Crate DNA
          </Button>
          <Collapse in={showDNA} timeout="auto" unmountOnExit>
            <CrateDNA items={merged} getCamelot={(t) => t.camelot} />
          </Collapse>
        </Box>

        {/* Rows-per-page at the TOP, like the Spotify view. */}
        {view.length > 50 && (
          <TablePagination
            component="div"
            count={view.length}
            page={page}
            onChangePage={(e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onChangeRowsPerPage={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[50, 100, 200]}
            labelRowsPerPage="Rows per page"
          />
        )}

        <Box style={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow style={{ background: headerBg }}>
                <HeadCell></HeadCell>
                {headCell("source", "Src")}
                {headCell("title", "Track")}
                {headCell("artist", "Artist")}
                {headCell("key", `Key (${notation})`)}
                {headCell("bpm", "BPM")}
                {headCell("energy", "Energy")}
                <HeadCell>Genre</HeadCell>
                <HeadCell>Released</HeadCell>
                {headCell("length", "Length")}
                <HeadCell></HeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((t) => {
                const isPlaying = playingUid === t.uid;
                const isAnchor = anchorUid === t.uid;
                const relation = harmonicRelation(anchorCamelot, t.camelot, isAnchor);
                const rowStyle = { cursor: "pointer" };
                if (relation === "incompatible") rowStyle.opacity = 0.4;
                if (relation === "compatible")
                  rowStyle.backgroundColor = "rgba(30, 215, 96, 0.12)";
                if (relation === "anchor") {
                  rowStyle.backgroundColor = "rgba(30, 215, 96, 0.2)";
                  const kc = t.camelot ? camelotColor(t.camelot) : null;
                  rowStyle.boxShadow = `inset 3px 0 0 ${kc ? kc.bg : "#1ED760"}`;
                } else if (isPlaying) {
                  // Per-source play tint when this row isn't the harmonic anchor.
                  rowStyle.backgroundColor =
                    t.source === "soundcloud"
                      ? "rgba(255,85,0,0.08)"
                      : "rgba(30,215,96,0.10)";
                }
                return (
                  <TableRow key={t.uid} hover style={rowStyle} onClick={() => playRow(t)}>
                    <TableCell style={{ width: 44 }}>
                      <Avatar variant="rounded" src={t.artwork} style={{ width: 34, height: 34 }} />
                    </TableCell>
                    <TableCell>{sourceBadge(t.source)}</TableCell>
                    <TableCell style={{ fontWeight: 600, maxWidth: 280 }}>{t.title}</TableCell>
                    <TableCell style={{ maxWidth: 200 }}>{t.artist}</TableCell>
                    <TableCell>{keyCell(t)}</TableCell>
                    <TableCell>{t.bpm || "—"}</TableCell>
                    <TableCell>{energyCell(t)}</TableCell>
                    <TableCell>{t.genre || "—"}</TableCell>
                    <TableCell style={{ whiteSpace: "nowrap" }}>{t.released || "—"}</TableCell>
                    <TableCell style={{ whiteSpace: "nowrap" }}>{fmtDuration(t.durationMs)}</TableCell>
                    <TableCell>
                      {t.source === "soundcloud" && t.externalUrl && (
                        <IconButton
                          size="small"
                          href={t.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open on SoundCloud"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Box>

      <KeyFilterPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        notation={notation}
        selected={keyFilter}
        onToggle={toggleKey}
        onClear={() => setKeyFilter([])}
        filterMode={filterMode}
        onChangeFilterMode={setFilterMode}
      />
    </Dialog>
  );
};

export default CombinedCrate;
