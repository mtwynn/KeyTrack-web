import React from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Avatar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  TablePagination,
  Input,
  InputAdornment,
  Paper,
  CircularProgress,
} from "@material-ui/core";
import { ArrowBack, Search, OpenInNew } from "@material-ui/icons";

import { camelotColor } from "../../utils/harmonic";
import { camelotRank, fmtDuration } from "../../utils/unifiedTrack";
import { SpotifyIcon, SoundcloudIcon } from "../BrandIcons";
import { useScAnalysisQueue } from "../SoundCloud/useScAnalysisQueue";

const SC_ORANGE = "#ff5500";
const SPOTIFY_GREEN = "#1ED760";

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
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState({ col: null, dir: "asc" });
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);
  const [playingUid, setPlayingUid] = React.useState(null);

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
  }, [merged, search, sort]);

  React.useEffect(() => {
    setPage(0);
  }, [search, sort, tracks]);
  const paged = view.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const toggleSort = (col) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" }
    );

  const playRow = (t) => {
    setPlayingUid(t.uid);
    if (t.source === "spotify" && props.updatePlayer) {
      props.updatePlayer([t.spotifyUri], true);
    } else if (t.source === "soundcloud" && props.onPlaySoundcloud) {
      props.onPlaySoundcloud(t.raw);
    }
  };

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

  // The Key cell — colored Camelot pill, or a per-source placeholder.
  const keyCell = (t) => {
    if (t.camelot) {
      const c = camelotColor(t.camelot);
      return (
        <span
          style={{
            backgroundColor: c.bg,
            color: c.text,
            padding: "3px 8px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
          }}
        >
          {t.camelot}
          {t.keyName ? " · " + t.keyName : ""}
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
    <TableCell sortDirection={sort.col === col ? sort.dir : false} align={align}>
      <TableSortLabel
        active={sort.col === col}
        direction={sort.col === col ? sort.dir : "asc"}
        onClick={() => toggleSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const scCount = (tracks || []).filter((t) => t.source === "soundcloud").length;
  const analyzing =
    scCount > 0 &&
    merged.filter((t) => t.source === "soundcloud" && t.scStatus === "loading").length > 0;

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      {/* paddingBottom clears the fixed bottom player bar. */}
      <Box style={{ padding: 16, paddingBottom: 140 }}>
        <Box style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <IconButton size="small" onClick={onClose} title="Back to crates">
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" style={{ fontWeight: 700 }} noWrap>
            {title}
          </Typography>
          {analyzing && (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <CircularProgress size={12} style={{ color: SC_ORANGE }} />
              analyzing SoundCloud keys…
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="textSecondary" style={{ display: "block", marginBottom: 12, paddingLeft: 4 }}>
          Combined crate · {(tracks || []).length} tracks. Spotify keys are from
          audio features; SoundCloud keys are computed by KeyTrack.
        </Typography>

        {(tracks || []).length > 0 && (
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
              placeholder="Search these tracks"
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

        <Box style={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                {headCell("source", "Src")}
                {headCell("title", "Track")}
                {headCell("artist", "Artist")}
                {headCell("key", "Key")}
                {headCell("bpm", "BPM")}
                {headCell("energy", "Energy")}
                <TableCell>Genre</TableCell>
                <TableCell>Released</TableCell>
                {headCell("length", "Length")}
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((t) => {
                const isPlaying = playingUid === t.uid;
                return (
                  <TableRow
                    key={t.uid}
                    hover
                    style={{
                      cursor: "pointer",
                      backgroundColor: isPlaying
                        ? t.source === "soundcloud"
                          ? "rgba(255,85,0,0.08)"
                          : "rgba(30,215,96,0.10)"
                        : undefined,
                    }}
                    onClick={() => playRow(t)}
                  >
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
            labelRowsPerPage="Tracks per page"
          />
        )}
      </Box>
    </Dialog>
  );
};

export default CombinedCrate;
