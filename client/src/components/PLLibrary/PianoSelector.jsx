import React from "react";
import { Button } from "@material-ui/core";
import { camelotColor, camelotForKey } from "../../utils/harmonic";

// A one-octave piano for picking musical keys. Pick a quality (Major/Minor),
// then click notes — each note can be selected in either quality independently
// (e.g. D major + G minor). Selections are stored as Camelot codes, so they
// carry over to the wheel/open filters unchanged.

const WHITE = [
  { pc: 0, label: "C" },
  { pc: 2, label: "D" },
  { pc: 4, label: "E" },
  { pc: 5, label: "F" },
  { pc: 7, label: "G" },
  { pc: 9, label: "A" },
  { pc: 11, label: "B" },
];

// `after` = index in WHITE the black key sits to the right of.
const BLACK = [
  { pc: 1, label: "C♯", after: 0 },
  { pc: 3, label: "D♯", after: 1 },
  { pc: 6, label: "F♯", after: 3 },
  { pc: 8, label: "G♯", after: 4 },
  { pc: 10, label: "A♯", after: 5 },
];

const W = 40;
const H = 132;
const BW = 26;
const BH = 84;

const PianoSelector = ({ selected = [], onToggle }) => {
  const [quality, setQuality] = React.useState("Major");
  const mode = quality === "Major" ? 1 : 0;

  // Small dot when the note is selected in the *other* quality.
  const oppositeDot = (pc) => {
    const opp = camelotForKey(pc, mode === 1 ? 0 : 1);
    if (!selected.includes(opp)) return null;
    const c = camelotColor(opp);
    return (
      <span
        title={`also selected as ${opp}`}
        style={{
          position: "absolute",
          top: 4,
          left: "50%",
          transform: "translateX(-50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: c.bg,
          border: "1px solid #fff",
        }}
      />
    );
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 10 }}>
        {["Major", "Minor"].map((q) => (
          <Button
            key={q}
            size="small"
            variant={quality === q ? "contained" : "outlined"}
            color={quality === q ? "primary" : "default"}
            onClick={() => setQuality(q)}
            style={{ margin: "0 4px", textTransform: "none" }}
          >
            {q}
          </Button>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          width: W * 7,
          height: H,
          margin: "0 auto",
          maxWidth: "100%",
        }}
      >
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0 }}>
          {WHITE.map(({ pc, label }) => {
            const code = camelotForKey(pc, mode);
            const sel = selected.includes(code);
            const c = camelotColor(code);
            return (
              <div
                key={pc}
                onClick={() => onToggle(code)}
                style={{
                  position: "relative",
                  width: W,
                  height: H,
                  boxSizing: "border-box",
                  border: "1px solid #bbb",
                  borderRadius: "0 0 5px 5px",
                  background: sel ? c.bg : "#ffffff",
                  color: sel ? c.text : "#333",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  userSelect: "none",
                }}
              >
                {oppositeDot(pc)}
                {sel ? code : label}
              </div>
            );
          })}
        </div>

        {BLACK.map(({ pc, label, after }) => {
          const code = camelotForKey(pc, mode);
          const sel = selected.includes(code);
          const c = camelotColor(code);
          const left = (after + 1) * W - BW / 2;
          return (
            <div
              key={pc}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(code);
              }}
              style={{
                position: "absolute",
                top: 0,
                left,
                width: BW,
                height: BH,
                zIndex: 2,
                background: sel ? c.bg : "#222",
                color: sel ? c.text : "#fff",
                border: "1px solid #000",
                borderRadius: "0 0 4px 4px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 6,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 9,
                userSelect: "none",
              }}
            >
              {oppositeDot(pc)}
              {sel ? code : label}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
        Adding <b>{quality}</b> keys — switch the toggle to add the other quality
      </div>
    </div>
  );
};

export default PianoSelector;
