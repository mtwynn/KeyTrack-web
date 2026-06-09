import React from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Slider,
  Typography,
} from "@material-ui/core";
import {
  ArrowUpward,
  ArrowDownward,
  Close,
  Delete,
  DragIndicator,
} from "@material-ui/icons";

import KeyMap from "../../utils/KeyMap";
import { camelotColor, compatibleCamelot } from "../../utils/harmonic";

const codeOf = (k) => (k ? KeyMap[k.key].camelot[k.mode] : null);

// The ordered set, shown in a slide-out panel (bottom sheet on mobile, right
// drawer on desktop). Each transition between consecutive tracks is validated
// for harmonic key compatibility and BPM jump (vs a user-set threshold).
const SetBuilder = ({
  open,
  onClose,
  set,
  getKey,
  onReorder,
  onRemove,
  onClear,
  bpmThreshold,
  onChangeBpmThreshold,
  isMobile,
}) => {
  const [dragIndex, setDragIndex] = React.useState(null);

  const rows = set.map((item) => {
    const k = getKey(item.track.id);
    return { item, code: codeOf(k), bpm: k ? Math.round(k.bpm) : null };
  });

  const transition = (a, b) => {
    if (!a.code || !b.code || a.bpm == null || b.bpm == null) return null;
    const keyCompatible = compatibleCamelot(a.code).has(b.code);
    const sameKey = a.code === b.code;
    const bpmDelta = b.bpm - a.bpm;
    const bpmPct = a.bpm ? (Math.abs(bpmDelta) / a.bpm) * 100 : 0;
    const bpmClash = bpmPct > bpmThreshold;
    return {
      keyCompatible,
      sameKey,
      bpmDelta,
      bpmPct,
      bpmClash,
      clash: !keyCompatible || bpmClash,
    };
  };

  const clashCount = rows.reduce((n, r, i) => {
    if (i === 0) return n;
    const t = transition(rows[i - 1], r);
    return n + (t && t.clash ? 1 : 0);
  }, 0);

  const handleDrop = (to) => {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to);
    setDragIndex(null);
  };

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      PaperProps={{
        style: {
          width: isMobile ? "100%" : 380,
          maxWidth: "100%",
          maxHeight: isMobile ? "85vh" : "100%",
          borderTopLeftRadius: isMobile ? 16 : 0,
          borderTopRightRadius: isMobile ? 16 : 0,
        },
      }}
    >
      <Box
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">Your Set ({set.length})</Typography>
          <IconButton size="small" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
        </Box>

        <Box style={{ margin: "8px 0 12px" }}>
          <Typography variant="caption" color="textSecondary">
            Flag BPM jumps over {bpmThreshold}%
          </Typography>
          <Slider
            value={bpmThreshold}
            min={1}
            max={20}
            step={1}
            valueLabelDisplay="auto"
            onChange={(e, v) => onChangeBpmThreshold(v)}
          />
        </Box>

        {set.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Add tracks with the + on each row to start building a set. Transitions
            are checked for key compatibility and BPM jumps as you go.
          </Typography>
        ) : (
          <>
            <Typography
              variant="caption"
              style={{
                color: clashCount ? "#c0392b" : "#2e7d32",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {clashCount
                ? `${clashCount} rough transition${clashCount > 1 ? "s" : ""}`
                : "All transitions smooth ✓"}
            </Typography>

            <Box style={{ overflowY: "auto", flex: 1 }}>
              {rows.map((r, i) => (
                <React.Fragment key={`${r.item.track.id}-${i}`}>
                  <Box
                    draggable={!isMobile}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid rgba(128,128,128,0.25)",
                      opacity: dragIndex === i ? 0.5 : 1,
                    }}
                  >
                    {!isMobile && (
                      <DragIndicator
                        style={{ cursor: "grab", color: "#999", fontSize: 18 }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      style={{ width: 16, color: "#999" }}
                    >
                      {i + 1}
                    </Typography>
                    {r.code && (
                      <Chip
                        size="small"
                        label={r.code}
                        style={{
                          backgroundColor: camelotColor(r.code).bg,
                          color: camelotColor(r.code).text,
                        }}
                      />
                    )}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        style={{
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.item.track.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {r.item.track.artists.map((a) => a.name).join(", ")} ·{" "}
                        {r.bpm} BPM
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      disabled={i === 0}
                      onClick={() => onReorder(i, i - 1)}
                      aria-label="move up"
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === rows.length - 1}
                      onClick={() => onReorder(i, i + 1)}
                      aria-label="move down"
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onRemove(i)}
                      aria-label="remove"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>

                  {i < rows.length - 1 &&
                    (() => {
                      const t = transition(rows[i], rows[i + 1]);
                      if (!t) return null;
                      return (
                        <Box
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 14px",
                            fontSize: 12,
                            color: t.clash ? "#c0392b" : "#2e7d32",
                          }}
                        >
                          <span>{t.clash ? "⚠" : "✓"}</span>
                          <span>
                            {t.sameKey
                              ? "same key"
                              : t.keyCompatible
                              ? "key compatible"
                              : "key clash"}
                          </span>
                          <span>
                            · {t.bpmDelta >= 0 ? "+" : ""}
                            {t.bpmDelta} BPM ({Math.round(t.bpmPct)}%)
                            {t.bpmClash ? " ⚠" : ""}
                          </span>
                        </Box>
                      );
                    })()}
                </React.Fragment>
              ))}
            </Box>

            <Button
              size="small"
              startIcon={<Delete />}
              onClick={onClear}
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              Clear set
            </Button>
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default SetBuilder;
