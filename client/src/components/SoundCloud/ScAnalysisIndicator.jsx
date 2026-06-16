import React from "react";
import {
  Box,
  Collapse,
  CircularProgress,
  IconButton,
  LinearProgress,
  Typography,
  withStyles,
} from "@material-ui/core";
import { ExpandLess, ExpandMore } from "@material-ui/icons";

// Orange (SoundCloud) determinate bar.
const ScLinearProgress = withStyles({
  colorPrimary: { backgroundColor: "rgba(255,85,0,0.18)" },
  barColorPrimary: { backgroundColor: "#ff5500" },
})(LinearProgress);

// A small, non-blocking, always-on-top progress pill pinned bottom-right (above
// the player bar). It reflects the GLOBAL SoundCloud analysis queue, so it stays
// visible — and the analysis keeps running — even after the crate is closed.
// Collapsed: spinner + done/total + %. Expanded (upward): a scrollable list of
// the tracks still being analyzed. Hidden entirely when nothing is running.
const ScAnalysisIndicator = ({ analysis, meta, progress, playerInset = 0 }) => {
  const [expanded, setExpanded] = React.useState(false);

  const total = (progress && progress.total) || 0;
  const done = Math.min((progress && progress.done) || 0, total);
  // Nothing analyzing → render nothing.
  if (total === 0) return null;

  const pct = total ? Math.round((done / total) * 100) : 0;
  const pending = Object.keys(meta || {})
    .filter((urn) => analysis[urn] && analysis[urn].status === "loading")
    .map((urn) => meta[urn]);

  return (
    <Box
      style={{
        position: "fixed",
        right: 12,
        bottom: playerInset + 12,
        zIndex: 10001,
        width: 290,
        maxWidth: "calc(100vw - 24px)",
        backgroundColor: "#fff",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}
    >
      {/* List grows UPWARD (the box is anchored by its bottom edge). */}
      <Collapse in={expanded}>
        <Box style={{ maxHeight: 200, overflowY: "auto" }}>
          {pending.length === 0 ? (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "block", padding: "8px 12px" }}
            >
              Finishing up…
            </Typography>
          ) : (
            pending.map((t) => (
              <Box
                key={t.urn}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                }}
              >
                <CircularProgress size={11} style={{ color: "#ff5500" }} />
                <Typography variant="caption" noWrap style={{ flex: 1 }} title={t.title}>
                  {t.title || "Track"}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Collapse>

      <Box
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 6px 8px 10px",
          cursor: "pointer",
        }}
      >
        <CircularProgress size={16} style={{ color: "#ff5500" }} />
        <Typography variant="caption" style={{ flex: 1, fontWeight: 600 }}>
          Analyzing SoundCloud… {done}/{total} ({pct}%)
        </Typography>
        <IconButton size="small" aria-label={expanded ? "collapse" : "expand"}>
          {expanded ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
        </IconButton>
      </Box>

      <ScLinearProgress variant="determinate" value={pct} style={{ height: 3 }} />
    </Box>
  );
};

export default ScAnalysisIndicator;
