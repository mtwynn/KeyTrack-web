import React from "react";
import axios from "axios";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Input,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Typography,
  withStyles,
} from "@material-ui/core";
import {
  Cloud,
  MusicNote,
  ArrowBack,
  OpenInNew,
  PlayArrow,
  GraphicEq,
  Search,
} from "@material-ui/icons";

import { camelotColor } from "../../utils/harmonic";
import { fetchScTracks } from "../../utils/soundcloudCrates";
import { useScAnalysisQueue } from "./useScAnalysisQueue";

// SoundCloud's brand orange — keeps SoundCloud crates visually distinct from
// Spotify's green (strict source separation).
const SC_ORANGE = "#ff5500";

// Tracks longer than this are almost certainly DJ sets/mixes — their key/BPM
// wander across the whole thing, so analyzing them is meaningless. We flag them
// as "Set" and exclude them from analysis. ~6 min is a heuristic; one constant
// so it's easy to tune.
const LIKELY_SET_MS = 6 * 60 * 1000;
const isLikelySet = (ms) => ms && ms > LIKELY_SET_MS;

// Sort rank for a Camelot code ("8B" -> 17) so the key column sorts around the
// wheel; un-analyzed tracks sort last.
const camelotRank = (c) => {
  const m = /(\d+)([AB])/.exec(c || "");
  return m ? parseInt(m[1], 10) * 2 + (m[2] === "B" ? 1 : 0) : 9999;
};

const fmtDuration = (ms) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

// Orange table header to match the SoundCloud source color.
const ScHeadCell = withStyles({
  head: { backgroundColor: SC_ORANGE, color: "#fff", fontWeight: "bold" },
})(TableCell);

// White sort arrows so they stay visible on the orange header.
const ScSortLabel = withStyles({
  root: { color: "#fff", "&:hover": { color: "#fff" }, "&$active": { color: "#fff" } },
  active: {},
  icon: { color: "#fff !important" },
})(TableSortLabel);

// A single opened SoundCloud crate: the track table, the analyze-on-play FIFO
// queue (computing our own key/BPM, since SoundCloud has none), in-crate search
// + sortable columns, and the embedded SoundCloud Widget player. Reusable — the
// unified library opens SoundCloud crates through this.
//
// Props: crate ({ id, kind, name, count }), token, backend, onRefreshToken,
// onBack.
let SoundCloudCrate = (props) => {
  const { crate, onBack, backend, token, onRefreshToken } = props;
  const [tracks, setTracks] = React.useState(null);
  // The track currently highlighted as playing (playback is in the bottom bar).
  const [playing, setPlaying] = React.useState(null);
  // Within-crate search + column sort (parity with the Spotify track table).
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState({ col: null, dir: "asc" });
  // Render only the current page of rows (parity with the Spotify track view).
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);

  // Call the backend proxy with the SoundCloud token. On a 401 (expired access
  // token) refresh once and retry, mirroring the Spotify session handling.
  const scFetch = React.useCallback(
    async (path, retried = false) => {
      try {
        const res = await axios.get(backend + path, {
          headers: { Authorization: "OAuth " + token },
        });
        return res.data;
      } catch (e) {
        if (e.response && e.response.status === 401 && !retried && onRefreshToken) {
          const fresh = await onRefreshToken();
          if (fresh) {
            const res = await axios.get(backend + path, {
              headers: { Authorization: "OAuth " + fresh },
            });
            return res.data;
          }
        }
        throw e;
      }
    },
    // Depend on the specific (stable) values only — NOT the whole `props`
    // object, which is a new reference every render. `[props]` made scFetch
    // unstable, so the load effect (and the analysis queue) re-ran on every
    // unrelated re-render — e.g. playing a track or an analysis completing —
    // which reset the table to its loading spinner and re-fetched the crate.
    [backend, token, onRefreshToken]
  );

  // Lazy key/BPM analysis (SoundCloud has none) via the shared single-worker
  // queue. Results fill in live and cache app-wide.
  const { analysis, enqueue, enqueueAll } = useScAnalysisQueue(scFetch);

  // Play a track → bottom-bar playback (lifted to App) + kick off analysis
  // (non-blocking). Local `playing` only highlights the active row.
  const playTrack = (t) => {
    setPlaying(t);
    enqueue(t);
    if (props.onPlaySoundcloud) props.onPlaySoundcloud(t);
  };

  // "Analyze Crate" → enqueue every track in the open crate.
  const analyzeCrate = () => enqueueAll(tracks);

  // Load the crate's tracks. Likes/reposts have their own endpoints; a
  // playlist's tracks come from /playlists/:urn/tracks.
  React.useEffect(() => {
    let cancelled = false;
    setTracks(null);
    setPlaying(null);
    setSearch("");
    setSort({ col: null, dir: "asc" });
    const path =
      crate.kind === "likes"
        ? "/soundcloud/me/likes/tracks"
        : crate.kind === "reposts"
        ? "/soundcloud/me/reposts"
        : "/soundcloud/playlists/" + encodeURIComponent(crate.id) + "/tracks";
    (async () => {
      try {
        // Follow pagination so the whole crate loads, not just the first 50.
        const list = await fetchScTracks(scFetch, path);
        if (!cancelled) setTracks(list);
      } catch (e) {
        console.error("Failed to load SoundCloud crate", e);
        if (!cancelled) setTracks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crate, scFetch]);

  // Filtered + sorted track view (search + clickable column sort). Sorting by
  // key/BPM uses our analysis; un-analyzed tracks sort last.
  const view = React.useMemo(() => {
    let list = tracks || [];
    // "Disable Sets" (KeyTrack setting): drop likely DJ sets/mixes entirely.
    if (props.hideSets) {
      list = list.filter((t) => !isLikelySet(t.duration));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.title || "").toLowerCase().includes(q) ||
          ((t.user && t.user.username) || "").toLowerCase().includes(q)
      );
    }
    if (sort.col) {
      const d = sort.dir === "desc" ? -1 : 1;
      const an = (t) => analysis[t.urn || t.id] || {};
      list = [...list].sort((a, b) => {
        switch (sort.col) {
          case "title":
            return d * (a.title || "").localeCompare(b.title || "");
          case "artist":
            return (
              d *
              ((a.user && a.user.username) || "").localeCompare(
                (b.user && b.user.username) || ""
              )
            );
          case "length":
            return d * ((a.duration || 0) - (b.duration || 0));
          case "key":
            return d * (camelotRank(an(a).camelot) - camelotRank(an(b).camelot));
          case "bpm":
            return d * ((an(a).bpm || 1e9) - (an(b).bpm || 1e9));
          default:
            return 0;
        }
      });
    }
    return list;
  }, [tracks, search, sort, analysis, props.hideSets]);

  const toggleSort = (col) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" }
    );

  // Only the current page is rendered into the DOM (search/sort still run over
  // the whole crate). Snap back to page 1 whenever the result set changes.
  React.useEffect(() => {
    setPage(0);
  }, [search, sort, props.hideSets, crate]);
  const pagedView = view.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    // paddingBottom clears the fixed bottom player bar so the last rows /
    // footer note aren't hidden behind it inside the full-screen modal.
    <Box style={{ padding: 16, paddingBottom: 140 }}>
      <Box
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
      >
        <IconButton size="small" onClick={onBack} title="Back to crates">
          <ArrowBack />
        </IconButton>
        <Cloud style={{ color: SC_ORANGE }} />
        <Typography variant="h6" style={{ fontWeight: 700 }} noWrap>
          {crate.name}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {crate.count} tracks
        </Typography>
        <Box style={{ flex: 1 }} />
        {tracks && tracks.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<GraphicEq />}
            onClick={analyzeCrate}
            style={{ textTransform: "none", borderRadius: 8, borderColor: SC_ORANGE, color: SC_ORANGE }}
          >
            Analyze crate
          </Button>
        )}
      </Box>


      {tracks && tracks.length > 0 && (
        <Paper
          elevation={0}
          style={{
            display: "flex",
            alignItems: "center",
            maxWidth: 360,
            borderRadius: 24,
            padding: "2px 8px 2px 16px",
            marginBottom: 12,
            border: "1px solid rgba(128,128,128,0.28)",
          }}
        >
          <Input
            disableUnderline
            fullWidth
            type="text"
            placeholder="Search this crate"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <Search style={{ color: "rgba(128,128,128,0.8)" }} />
              </InputAdornment>
            }
          />
        </Paper>
      )}

      {!tracks ? (
        <Box style={{ padding: 48, textAlign: "center" }}>
          <CircularProgress style={{ color: SC_ORANGE }} />
        </Box>
      ) : view.length === 0 ? (
        <Typography color="textSecondary" style={{ padding: 16 }}>
          {tracks.length === 0
            ? "No tracks in this crate."
            : props.hideSets && tracks.every((t) => isLikelySet(t.duration))
            ? "Every track here is a set — hidden by your “Disable Sets” setting."
            : "No tracks match your search."}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <ScHeadCell></ScHeadCell>
              <ScHeadCell sortDirection={sort.col === "title" ? sort.dir : false}>
                <ScSortLabel
                  active={sort.col === "title"}
                  direction={sort.col === "title" ? sort.dir : "asc"}
                  onClick={() => toggleSort("title")}
                >
                  Track
                </ScSortLabel>
              </ScHeadCell>
              <ScHeadCell sortDirection={sort.col === "artist" ? sort.dir : false}>
                <ScSortLabel
                  active={sort.col === "artist"}
                  direction={sort.col === "artist" ? sort.dir : "asc"}
                  onClick={() => toggleSort("artist")}
                >
                  Artist
                </ScSortLabel>
              </ScHeadCell>
              <ScHeadCell sortDirection={sort.col === "key" ? sort.dir : false}>
                <ScSortLabel
                  active={sort.col === "key"}
                  direction={sort.col === "key" ? sort.dir : "asc"}
                  onClick={() => toggleSort("key")}
                >
                  Key
                </ScSortLabel>
              </ScHeadCell>
              <ScHeadCell sortDirection={sort.col === "bpm" ? sort.dir : false}>
                <ScSortLabel
                  active={sort.col === "bpm"}
                  direction={sort.col === "bpm" ? sort.dir : "asc"}
                  onClick={() => toggleSort("bpm")}
                >
                  BPM
                </ScSortLabel>
              </ScHeadCell>
              <ScHeadCell>Genre</ScHeadCell>
              <ScHeadCell sortDirection={sort.col === "length" ? sort.dir : false}>
                <ScSortLabel
                  active={sort.col === "length"}
                  direction={sort.col === "length" ? sort.dir : "asc"}
                  onClick={() => toggleSort("length")}
                >
                  Length
                </ScSortLabel>
              </ScHeadCell>
              <ScHeadCell></ScHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedView.map((t) => {
              const tid = t.urn || t.id;
              const isPlaying = playing && (playing.urn || playing.id) === tid;
              const a = analysis[tid];
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
                    onClick={() => playTrack(t)}
                    title="Play + analyze"
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
                {isLikelySet(t.duration) || (a && a.isLikelySet) ? (
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
                ) : a && a.status === "loading" ? (
                  <TableCell colSpan={2}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#888",
                      }}
                    >
                      <CircularProgress size={13} style={{ color: SC_ORANGE }} />
                      analyzing…
                    </span>
                  </TableCell>
                ) : a && a.camelot ? (
                  <>
                    <TableCell>
                      <span
                        style={{
                          backgroundColor: camelotColor(a.camelot).bg,
                          color: camelotColor(a.camelot).text,
                          padding: "3px 8px",
                          borderRadius: 10,
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          whiteSpace: "nowrap",
                        }}
                        title={a.preview ? "Approximate — from a 30s SoundCloud preview" : "Detected by KeyTrack"}
                      >
                        {a.camelot}
                        {a.key ? " · " + a.key : ""}
                      </span>
                      {a.preview && (
                        <span
                          title="Approximate — from a 30s SoundCloud preview"
                          style={{ color: SC_ORANGE, fontWeight: 700, marginLeft: 4 }}
                        >
                          ~
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{a.bpm || "—"}</TableCell>
                  </>
                ) : a && a.unavailable ? (
                  <TableCell colSpan={2}>
                    <Chip
                      size="small"
                      label="SoundCloud-only"
                      title="Only available on SoundCloud — no stream we can analyze"
                      style={{ backgroundColor: "rgba(0,0,0,0.08)", color: "#666", height: 20, fontWeight: 700 }}
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

      {tracks && view.length > 50 && (
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
          labelRowsPerPage="Tracks per page"
        />
      )}

      <Typography
        variant="caption"
        color="textSecondary"
        style={{ display: "block", marginTop: 12 }}
      >
        Play a track or hit <b>Analyze crate</b> to compute its key + BPM with
        KeyTrack (SoundCloud has none). Colored keys are ours; plain values are
        artist-entered. Tracks link out to SoundCloud (source &amp; attribution).
      </Typography>
    </Box>
  );
};

export default SoundCloudCrate;
