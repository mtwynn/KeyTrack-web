import React from "react";
import { Popover, Box, Chip, Typography, Input, Button } from "@material-ui/core";

// The metric relatives a tempo detector typically confuses. Showing the
// detected value's whole family as one-tap chips means the right answer (often
// a ½/⅔/¾/1⅓/2× of what was detected) is a single click — no math for the user.
const FACTORS = [0.5, 2 / 3, 0.75, 1, 4 / 3, 1.5, 2];

// A clickable BPM value (SoundCloud rows): tap it to correct a mis-detected
// tempo. The correction is saved to the shared analysis cache so it sticks.
export default function BpmOverride({ bpm, onSet }) {
  const [anchor, setAnchor] = React.useState(null);
  const [manual, setManual] = React.useState("");
  const rounded = Math.round(bpm);

  const candidates = React.useMemo(() => {
    const s = new Set(
      FACTORS.map((f) => Math.round(bpm * f)).filter((v) => v >= 40 && v <= 300)
    );
    return [...s].sort((a, b) => a - b);
  }, [bpm]);

  const close = () => {
    setAnchor(null);
    setManual("");
  };
  const choose = (v) => {
    onSet(v);
    close();
  };

  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
        title="Click to correct the BPM"
        style={{ cursor: "pointer", borderBottom: "1px dotted #999" }}
      >
        {rounded}
      </span>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableScrollLock
        onClick={(e) => e.stopPropagation()}
      >
        <Box style={{ padding: 12, maxWidth: 260 }}>
          <Typography variant="caption" color="textSecondary">
            Correct BPM — tap a multiple or type the exact value
          </Typography>
          <Box style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
            {candidates.map((v) => (
              <Chip
                key={v}
                size="small"
                label={v}
                clickable
                color={v === rounded ? "primary" : "default"}
                onClick={(e) => {
                  e.stopPropagation();
                  choose(v);
                }}
              />
            ))}
          </Box>
          <Box style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input
              type="number"
              placeholder="exact"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 64 }}
            />
            <Button
              size="small"
              disabled={!manual || parseInt(manual, 10) <= 0}
              onClick={(e) => {
                e.stopPropagation();
                const v = parseInt(manual, 10);
                if (v > 0) choose(v);
              }}
            >
              Set
            </Button>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSet(null);
                close();
              }}
              style={{ marginLeft: "auto", textTransform: "none" }}
              title="Revert to the auto-detected BPM"
            >
              Auto
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
