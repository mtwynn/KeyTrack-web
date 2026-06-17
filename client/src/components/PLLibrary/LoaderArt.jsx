import React from "react";
import { makeStyles } from "@material-ui/core/styles";

// Music-player themed loaders for the "Loading all crates…" dialog: a Pioneer-
// style CDJ (spinning jog wheel + a waveform that scrolls right→left), a vinyl,
// a CD, or a cassette — plus a sleek progress bar that fills.
const useStyles = makeStyles({
  "@keyframes ktspin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
  // The waveform scrolls by exactly one of its two identical halves → seamless.
  "@keyframes ktwave": {
    "0%": { transform: "translateX(0)" },
    "100%": { transform: "translateX(-50%)" },
  },
  disc: { position: "absolute", inset: 0, borderRadius: "50%", transformOrigin: "50% 50%" },
  center: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
  },

  // Vinyl
  vinyl: {
    background:
      "conic-gradient(from 0deg, rgba(255,255,255,0.16) 0 26deg, transparent 26deg 360deg)," +
      "repeating-radial-gradient(circle at center, #000 0 1.5px, #1c1c1c 1.5px 3.5px)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
    animation: "$ktspin 1.7s linear infinite",
  },
  vinylLabel: {
    width: "40%",
    height: "40%",
    background: "#1ED760",
    boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.15)",
  },
  hole: { width: "7%", height: "7%", background: "#fff" },

  // CD
  cd: {
    background:
      "conic-gradient(from 0deg, #ff5500, #ffd000, #1ED760, #00b4d8, #7b2ff7, #ff2d8e, #ff5500)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
    animation: "$ktspin 1.25s linear infinite",
  },
  cdRing: {
    width: "34%",
    height: "34%",
    background: "#fff",
    boxShadow: "inset 0 0 0 5px rgba(180,180,180,0.5)",
  },
  cdHole: { width: "13%", height: "13%", background: "#fafafa", border: "1px solid #ccc" },

  // Cassette
  cassette: {
    position: "relative",
    borderRadius: 8,
    background: "linear-gradient(#454545, #222)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "&::before": {
      content: '""',
      position: "absolute",
      top: "16%",
      left: "10%",
      right: "10%",
      height: "36%",
      borderRadius: 4,
      background: "rgba(255,255,255,0.09)",
    },
  },
  reel: {
    borderRadius: "50%",
    background:
      "conic-gradient(#cfcfcf 0 18deg, #555 18deg 90deg, #cfcfcf 90deg 108deg, #555 108deg 180deg," +
      "#cfcfcf 180deg 198deg, #555 198deg 270deg, #cfcfcf 270deg 288deg, #555 288deg 360deg)",
    border: "3px solid #ececec",
    animation: "$ktspin 1.5s linear infinite",
    zIndex: 1,
  },

  // CDJ — screen with a scrolling waveform over a spinning jog wheel
  cdjUnit: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  cdjScreen: {
    position: "relative",
    width: 116,
    height: 40,
    borderRadius: 4,
    background: "#070b10",
    border: "2px solid #2a2f36",
    overflow: "hidden",
    boxShadow: "inset 0 0 8px rgba(0,0,0,0.6)",
  },
  cdjWave: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    alignItems: "center",
    animation: "$ktwave 2.6s linear infinite",
  },
  cdjBar: {
    flex: "0 0 auto",
    width: 2,
    margin: "0 0.6px",
    borderRadius: 1,
    background: "linear-gradient(to top, #ff8a2a 0 45%, #38b6ff 55% 100%)",
  },
  cdjJog: { position: "relative", width: 74, height: 74 },
  cdjRim: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: "radial-gradient(circle, #1e1e1e 0 58%, #2d2d2d 58% 84%, #161616 84% 100%)",
    border: "2px solid #0d0d0d",
    boxShadow: "0 2px 10px rgba(0,0,0,0.4), inset 0 0 0 6px #242424",
  },
  cdjDisplay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "50%",
    height: "50%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "conic-gradient(#00d4ff, #ff7a00, #ff2d6f, #b14bff, #00d4ff)",
    boxShadow: "0 0 6px rgba(0,0,0,0.5)",
    animation: "$ktspin 2s linear infinite",
  },
  cdjLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "26%",
    height: "26%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "radial-gradient(circle, #111, #222)",
    border: "1px solid #444",
    zIndex: 2,
  },

  // Fill bar
  barTrack: {
    position: "relative",
    width: 270,
    maxWidth: "72vw",
    height: 26,
    borderRadius: 13,
    background: "#ececec",
    overflow: "hidden",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
  },
  barFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 13,
    background: "linear-gradient(90deg, #25e06a, #15b94f)",
    transition: "width 0.45s ease",
  },
  barText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f3d22",
    fontWeight: 700,
    fontSize: "0.85rem",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: 0.3,
  },
});

// A pseudo-random waveform (peaks/troughs), doubled below for a seamless scroll.
const WAVE = [
  0.3, 0.55, 0.42, 0.8, 0.5, 0.92, 0.38, 0.7, 0.58, 1, 0.6, 0.34, 0.76, 0.48,
  0.86, 0.44, 0.66, 0.4, 0.9, 0.54, 0.72, 0.5, 0.82, 0.36, 0.62, 0.95, 0.46,
  0.7, 0.52, 0.86, 0.4, 0.6, 0.78, 0.5, 0.9, 0.56,
];

export const LOADER_STYLES = [
  { key: "cdj", label: "CDJ" },
  { key: "vinyl", label: "Vinyl" },
  { key: "cd", label: "CD" },
  { key: "cassette", label: "Cassette" },
];

export const MusicSpinner = ({ variant = "cdj", size = 72 }) => {
  const c = useStyles();
  const wrap = { position: "relative", width: size, height: size };

  if (variant === "cdj") {
    return (
      <div className={c.cdjUnit}>
        <div className={c.cdjScreen}>
          <div className={c.cdjWave}>
            {WAVE.concat(WAVE).map((h, i) => (
              <div
                key={i}
                className={c.cdjBar}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <div className={c.cdjJog}>
          <div className={c.cdjRim} />
          <div className={c.cdjDisplay} />
          <div className={c.cdjLabel} />
        </div>
      </div>
    );
  }
  if (variant === "cd") {
    return (
      <div style={wrap}>
        <div className={`${c.disc} ${c.cd}`} />
        <div className={`${c.center} ${c.cdRing}`} />
        <div className={`${c.center} ${c.cdHole}`} />
      </div>
    );
  }
  if (variant === "cassette") {
    const w = Math.round(size * 1.5);
    const h = Math.round(size * 0.9);
    const reel = Math.round(size * 0.34);
    return (
      <div className={c.cassette} style={{ width: w, height: h, gap: Math.round(size * 0.42) }}>
        <div className={c.reel} style={{ width: reel, height: reel }} />
        <div className={c.reel} style={{ width: reel, height: reel }} />
      </div>
    );
  }
  return (
    <div style={wrap}>
      <div className={`${c.disc} ${c.vinyl}`} />
      <div className={`${c.center} ${c.vinylLabel}`} />
      <div className={`${c.center} ${c.hole}`} />
    </div>
  );
};

export const FillBar = ({ done, total }) => {
  const c = useStyles();
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={c.barTrack}>
      <div className={c.barFill} style={{ width: pct + "%" }} />
      <span className={c.barText}>
        {done}/{total}
      </span>
    </div>
  );
};
