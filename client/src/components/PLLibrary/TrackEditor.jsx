import React from "react";
import { Popover, Box, Typography, Button, Divider } from "@material-ui/core";
import { musicalLabel } from "../../utils/harmonic";
import ChordLoopEditor from "./ChordLoopEditor";

// Same Camelot number, flip A↔B = the relative major/minor.
const relativeOf = (code) => {
  const m = /^(\d+)([AB])$/.exec(code || "");
  return m ? m[1] + (m[2] === "A" ? "B" : "A") : null;
};

const ALL_CAMELOT = [];
for (let n = 1; n <= 12; n++) ALL_CAMELOT.push(`${n}A`, `${n}B`);

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
  const open = Boolean(anchorEl);
  const rel = relativeOf(camelot);

  const openPop = (e) => {
    e.stopPropagation();
    setShowAll(false);
    setAnchorEl(e.currentTarget);
  };
  const close = () => setAnchorEl(null);
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
            Chords — loop {hasChordsOverride ? "(edited)" : ""}
          </Typography>
          <Box style={{ marginTop: 6 }}>
            <ChordLoopEditor
              chords={chords}
              camelot={camelot}
              onSave={onSetChords}
              onReset={() => onSetChords(null)}
              hasOverride={hasChordsOverride}
            />
          </Box>
        </Box>
      </Popover>
    </>
  );
}
