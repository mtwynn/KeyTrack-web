import React from "react";
import { makeStyles } from "@material-ui/core/styles";

// Music-player themed loaders for the "Loading all crates…" dialog: a Pioneer
// CDJ-3000-style deck (a screen with a mirrored waveform scrolling right→left
// above a spinning jog wheel with an offset colorful album disc), a vinyl, a
// CD, or a cassette — plus a sleek progress bar that fills.
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

  // CDJ
  cdjUnit: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  cdjScreen: {
    position: "relative",
    width: 140,
    height: 46,
    borderRadius: 10,
    background: "#0b0d11",
    border: "2px solid #20242a",
    boxShadow: "0 3px 10px rgba(0,0,0,0.35), inset 0 0 10px rgba(0,0,0,0.65)",
    overflow: "hidden",
  },
  cdjWave: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    alignItems: "center",
    padding: "0 2px",
    animation: "$ktwave 2.6s linear infinite",
  },
  cdjBar: {
    flex: "0 0 auto",
    width: 2.5,
    margin: "0 0.7px",
    borderRadius: 1,
    alignSelf: "center",
    // Mirrored stereo waveform: blue on top, orange on the bottom.
    background: "linear-gradient(to bottom, #4cc2ff 0 50%, #ff8a2a 50% 100%)",
  },
  cdjJogWrap: { position: "relative", width: 120, height: 120 },
  cdjJog: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 50% 40%, #3d3d3d 0%, #2a2a2a 44%, #1b1b1b 74%, #121212 100%)",
    boxShadow:
      "0 6px 18px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 22px rgba(0,0,0,0.55)",
  },
  cdjSheen: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, rgba(255,255,255,0.09) 0 24deg, transparent 24deg 360deg)",
    animation: "$ktspin 2.4s linear infinite",
  },
  cdjSpindle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "15%",
    height: "15%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "radial-gradient(circle, #0c0c0c, #1d1d1d)",
    boxShadow: "inset 0 0 5px rgba(0,0,0,0.85)",
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
  0.32, 0.58, 0.44, 0.82, 0.5, 0.95, 0.4, 0.72, 0.6, 1, 0.62, 0.36, 0.78, 0.5,
  0.88, 0.46, 0.68, 0.42, 0.92, 0.56, 0.74, 0.5, 0.84, 0.38, 0.64, 0.97, 0.48,
  0.72, 0.54, 0.88, 0.42, 0.62, 0.8, 0.5, 0.92, 0.58,
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
                style={{ height: `${Math.round(h * 90)}%` }}
              />
            ))}
          </div>
        </div>
        <div className={c.cdjJogWrap}>
          <div className={c.cdjJog} />
          <div className={c.cdjSheen} />
          <div className={c.cdjSpindle} />
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
