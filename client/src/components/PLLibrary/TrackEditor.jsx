import React from "react";
import {
  Popover,
  Box,
  Chip,
  Typography,
  Button,
  TextField,
  Divider,
} from "@material-ui/core";
import { musicalLabel } from "../../utils/harmonic";

// Same Camelot number, flip A↔B = the relative major/minor.
const relativeOf = (code) => {
  const m = /^(\d+)([AB])$/.exec(code || "");
  return m ? m[1] + (m[2] === "A" ? "B" : "A") : null;
};

const ALL_CAMELOT = [];
for (let n = 1; n <= 12; n++) ALL_CAMELOT.push(`${n}A`, `${n}B`);

// "Em, A D bm" → ["Em","A","D","Bm"] — accept any maj/min triad token.
const parseChords = (text) =>
  (text || "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => /^[A-Ga-g][#b]?m?$/.test(t))
    .map((t) => t[0].toUpperCase() + t.slice(1));

// The clickable key pill + its editor popover: change the key (relative major/
// minor surfaced first, then all 24) and fully edit the chord loop (the first
// chord is how the loop starts). Key and chords are independent. Also hosts the
// "highlight harmonic matches" action (which used to be the pill's click).
export default function TrackEditor({
  camelot,
  keyLabel,
  keyColor,
  chords,
  isAnchor,
  onToggleAnchor,
  onSetKey,
  onSetChords,
  hasKeyOverride,
  hasChordsOverride,
}) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);
  const [text, setText] = React.useState("");
  const open = Boolean(anchorEl);
  const rel = relativeOf(camelot);

  const openPop = (e) => {
    e.stopPropagation();
    setText((chords || []).join(" "));
    setShowAll(false);
    setAnchorEl(e.currentTarget);
  };
  const close = () => setAnchorEl(null);
  const applyChords = () => {
    const arr = parseChords(text);
    onSetChords(arr.length ? arr : null);
  };
  const keyBtn = (code, label, primary) => (
    <Button
      key={code}
      size="small"
      variant={code === camelot ? "contained" : "outlined"}
      color={primary ? "primary" : "default"}
      onClick={(e) => {
        e.stopPropagation();
        onSetKey(code);
      }}
      style={{ textTransform: "none", minWidth: 0, margin: 2 }}
    >
      {label}
    </Button>
  );

  return (
    <>
      <span
        onClick={openPop}
        title="Click to edit key & chords"
        style={
          keyColor
            ? {
                backgroundColor: keyColor.bg,
                color: keyColor.text,
                padding: "3px 10px",
                borderRadius: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-block",
                whiteSpace: "nowrap",
              }
            : { cursor: "pointer" }
        }
      >
        {keyLabel}
      </span>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableScrollLock
        onClick={(e) => e.stopPropagation()}
      >
        <Box style={{ padding: 14, width: 310 }}>
          <Button
            size="small"
            fullWidth
            variant="outlined"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAnchor();
              close();
            }}
            style={{ textTransform: "none", marginBottom: 12 }}
          >
            {isAnchor ? "Clear harmonic highlight" : "🎚 Highlight harmonic matches"}
          </Button>

          <Typography variant="caption" color="textSecondary">
            Key {hasKeyOverride ? "(edited)" : ""}
          </Typography>
          <Box style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap" }}>
            {camelot && keyBtn(camelot, `${musicalLabel(camelot)} · ${camelot}`, false)}
            {rel && keyBtn(rel, `${musicalLabel(rel)} · ${rel}  (relative)`, true)}
          </Box>
          <Box style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll((v) => !v);
              }}
              style={{ textTransform: "none", padding: 0 }}
            >
              {showAll ? "Hide all keys" : "All keys…"}
            </Button>
            {hasKeyOverride && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetKey(null);
                }}
                style={{ textTransform: "none", padding: 0, marginLeft: 8 }}
              >
                Reset to detected
              </Button>
            )}
          </Box>
          {showAll && (
            <Box style={{ display: "flex", flexWrap: "wrap", marginTop: 6 }}>
              {ALL_CAMELOT.map((c) => keyBtn(c, c, false))}
            </Box>
          )}

          <Divider style={{ margin: "12px 0 8px" }} />
          <Typography variant="caption" color="textSecondary">
            Chords — loop in order {hasChordsOverride ? "(edited)" : ""}
          </Typography>
          <Box style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0" }}>
            {(chords || []).length ? (
              chords.map((c, i) => <Chip key={i} size="small" label={c} />)
            ) : (
              <Typography variant="caption" color="textSecondary">
                none detected — type one below
              </Typography>
            )}
          </Box>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="e.g. Em A D Bm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyChords();
            }}
          />
          <Box style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                applyChords();
              }}
            >
              Save chords
            </Button>
            {hasChordsOverride && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetChords(null);
                  setText("");
                }}
              >
                Reset
              </Button>
            )}
          </Box>
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ display: "block", marginTop: 8 }}
          >
            The <b>first</b> chord is how the loop starts. Type the chords in order.
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
