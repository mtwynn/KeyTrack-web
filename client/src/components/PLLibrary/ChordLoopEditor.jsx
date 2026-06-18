import React from "react";
import { Box, Button, Typography, IconButton } from "@material-ui/core";

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
// flat-side Camelot keys → spell roots with flats
const FLAT_CAMELOT = new Set(["3B", "4B", "5B", "6B", "7B", "2A", "3A", "4A", "5A", "6A", "7A"]);

const parse = (label) => {
  const m = /^([A-G][#b]?)(m?)$/.exec(String(label).trim());
  if (!m) return null;
  const r = NOTE[m[1]];
  return r == null ? null : { root: r, min: m[2] === "m" };
};
const toLabel = (c, flats) => (flats ? FLAT : SHARP)[c.root] + (c.min ? "m" : "");

// Structured, no-typing chord-loop editor. Chips reorder with ◀ ▶, delete with
// ×, and a chip's chord is picked from root + maj/min buttons. First chip = how
// the loop starts.
export default function ChordLoopEditor({ chords, camelot, onSave, onReset, hasOverride }) {
  const flats = FLAT_CAMELOT.has(camelot || "");
  const names = flats ? FLAT : SHARP;
  const chordsKey = (chords || []).join(",");

  const [list, setList] = React.useState([]);
  const [editIdx, setEditIdx] = React.useState(-1);
  React.useEffect(() => {
    setList((chords || []).map(parse).filter(Boolean));
    setEditIdx(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chordsKey]); // re-seed only when the underlying chords actually change

  const dirty =
    JSON.stringify((chords || []).map(parse).filter(Boolean)) !== JSON.stringify(list);

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const l = [...list];
    [l[i], l[j]] = [l[j], l[i]];
    setList(l);
    if (editIdx === i) setEditIdx(j);
    else if (editIdx === j) setEditIdx(i);
  };
  const remove = (i) => {
    setList(list.filter((_, k) => k !== i));
    setEditIdx(-1);
  };
  const add = () => {
    setList([...list, { root: 0, min: false }]);
    setEditIdx(list.length);
  };
  const patch = (p) => {
    if (editIdx < 0) return;
    const l = [...list];
    l[editIdx] = { ...l[editIdx], ...p };
    setList(l);
  };

  const arrowBtn = {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    padding: "0 2px",
  };

  return (
    <Box>
      <Box style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {list.map((c, i) => (
          <Box
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: editIdx === i ? "1px solid #1ED760" : "1px solid #ddd",
              borderRadius: 14,
              padding: "1px 2px 1px 3px",
              background: i === 0 ? "#eafaf0" : "#fafafa",
            }}
          >
            <button style={{ ...arrowBtn, opacity: i === 0 ? 0.3 : 1 }} disabled={i === 0} onClick={() => move(i, -1)}>
              ‹
            </button>
            <span
              onClick={() => setEditIdx(editIdx === i ? -1 : i)}
              title="Change this chord"
              style={{ cursor: "pointer", fontWeight: 600, padding: "0 4px" }}
            >
              {toLabel(c, flats)}
            </span>
            <button style={{ ...arrowBtn, opacity: i === list.length - 1 ? 0.3 : 1 }} disabled={i === list.length - 1} onClick={() => move(i, 1)}>
              ›
            </button>
            <button style={{ ...arrowBtn, color: "#c0392b" }} title="Remove" onClick={() => remove(i)}>
              ×
            </button>
          </Box>
        ))}
        <Button size="small" onClick={add} style={{ textTransform: "none", minWidth: 0 }}>
          + Add
        </Button>
      </Box>

      {editIdx >= 0 && list[editIdx] && (
        <Box style={{ marginTop: 8, padding: 8, background: "#f4f4f4", borderRadius: 8 }}>
          <Box style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <Button size="small" variant={!list[editIdx].min ? "contained" : "outlined"} onClick={() => patch({ min: false })} style={{ minWidth: 0, textTransform: "none" }}>
              Maj
            </Button>
            <Button size="small" variant={list[editIdx].min ? "contained" : "outlined"} onClick={() => patch({ min: true })} style={{ minWidth: 0, textTransform: "none" }}>
              Min
            </Button>
            <IconButton size="small" onClick={() => setEditIdx(-1)} style={{ marginLeft: "auto" }} title="Done">
              ✓
            </IconButton>
          </Box>
          <Box style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {names.map((n, pc) => (
              <Button key={pc} size="small" variant={list[editIdx].root === pc ? "contained" : "outlined"} color={list[editIdx].root === pc ? "primary" : "default"} onClick={() => patch({ root: pc })} style={{ minWidth: 36, padding: "2px 4px" }}>
                {n}
              </Button>
            ))}
          </Box>
        </Box>
      )}

      <Box style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Button size="small" variant="contained" color="primary" disabled={!dirty} onClick={() => onSave(list.length ? list.map((c) => toLabel(c, flats)) : null)}>
          Save chords
        </Button>
        {hasOverride && (
          <Button size="small" onClick={onReset}>
            Reset
          </Button>
        )}
      </Box>
      <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 6 }}>
        ◀ ▶ reorder · click a chip to change it · the <b>first</b> chip is the start.
      </Typography>
    </Box>
  );
}
