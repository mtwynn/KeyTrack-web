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
import { getScAnalysis, saveScAnalysis } from "../../utils/scAnalysis";

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
  const { crate, onBack } = props;
  const [tracks, setTracks] = React.useState(null);
  // The track currently loaded into the embedded SoundCloud Widget player.
  const [playing, setPlaying] = React.useState(null);
  // Our computed key/BPM per track URN: { status:'loading' } | result.
  const [analysis, setAnalysis] = React.useState({});
  const queueRef = React.useRef([]); // FIFO of tracks awaiting analysis
  const seenRef = React.useRef(new Set()); // urns already queued/done (dedupe)
  const processingRef = React.useRef(false);
  // Within-crate search + column sort (parity with the Spotify track table).
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState({ col: null, dir: "asc" });

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

  // --- Key/BPM analysis: a single-worker FIFO queue. Enqueuing never blocks
  // (playback is independent); results fill in live and cache to Firestore so a
  // track is only ever analyzed once for the whole app.
  const trackUrn = (t) => t.urn || String(t.id);

  const processQueue = React.useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    (async () => {
      while (queueRef.current.length) {
        const t = queueRef.current.shift();
        const urn = trackUrn(t);
        let result = await getScAnalysis(urn); // shared cache first
        if (!result) {
          try {
            const tid = t.id || t.urn;
            result = await scFetch(
              `/soundcloud/analyze?track_id=${encodeURIComponent(tid)}` +
                `&duration=${t.duration || 0}` +
                `&genre=${encodeURIComponent(t.genre || "")}`
            );
            if (result && !result.isLikelySet && result.camelot) {
              saveScAnalysis(urn, result);
            }
          } catch (e) {
            result = { error: true };
          }
        }
        setAnalysis((a) => ({ ...a, [urn]: result || { error: true } }));
        // Failed (e.g. HLS-only / no progressive stream) → allow a retry later.
        if (!result || result.error || (!result.camelot && !result.isLikelySet)) {
          seenRef.current.delete(urn);
        }
      }
      processingRef.current = false;
    })();
  }, [scFetch]);

  const enqueueAnalysis = React.useCallback(
    (t) => {
      const urn = trackUrn(t);
      if (seenRef.current.has(urn)) return; // already queued/done
      seenRef.current.add(urn);
      if (isLikelySet(t.duration)) {
        setAnalysis((a) => ({ ...a, [urn]: { isLikelySet: true } }));
        return;
      }
      setAnalysis((a) => ({ ...a, [urn]: { status: "loading" } }));
      queueRef.current.push(t);
      processQueue();
    },
    [processQueue]
  );

  // Play a track → load the Widget AND kick off analysis (non-blocking).
  const playTrack = (t) => {
    setPlaying(t);
    enqueueAnalysis(t);
  };

  // "Analyze Crate" → enqueue every track in the open crate.
  const analyzeCrate = () => (tracks || []).forEach((t) => enqueueAnalysis(t));

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
        const data = await scFetch(path);
        const list = data && data.collection ? data.collection : Array.isArray(data) ? data : [];
        // Likes/reposts come back as { track: {...} } wrappers on some endpoints.
        if (!cancelled) setTracks(list.map((t) => (t && t.track ? t.track : t)).filter(Boolean));
      } catch (e) {
        console.error("Failed to load SoundCloud crate", e);
        if (!cancelled) setTracks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crate, scFetch]);

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
            {view.map((t) => {
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
                        title="Detected by KeyTrack"
                      >
                        {a.camelot}
                        {a.key ? " · " + a.key : ""}
                      </span>
                    </TableCell>
                    <TableCell>{a.bpm || "—"}</TableCell>
                  </>
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
        Play a track or hit <b>Analyze crate</b> to compute its key + BPM with
        KeyTrack (SoundCloud has none). Colored keys are ours; plain values are
        artist-entered. Tracks link out to SoundCloud (source &amp; attribution).
      </Typography>
    </Box>
  );
};

export default SoundCloudCrate;
