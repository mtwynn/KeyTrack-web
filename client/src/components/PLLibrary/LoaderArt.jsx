import React from "react";
import { makeStyles } from "@material-ui/core/styles";

// Music-player themed loaders for the "Loading all crates…" dialog: a spinning
// vinyl, CD, cassette, or CDJ jog-wheel, plus a sleek progress bar that fills.
// MusicSpinner takes a `size` so the same art works big (the loader) and small
// (the picker thumbnails). Every disc fills its wrapper and rotates about its
// center; fixed center bits (labels/holes/displays) sit on top.
const useStyles = makeStyles({
  "@keyframes ktspin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
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

  // CDJ jog wheel
  cdjPlatter: {
    background: "radial-gradient(circle, #3a3a3a 0 30%, #232323 30% 72%, #3d3d3d 72% 100%)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35), inset 0 0 0 4px #1c1c1c",
    animation: "$ktspin 1.9s linear infinite",
  },
  cdjMarker: {
    position: "absolute",
    top: "7%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "9%",
    height: "9%",
    borderRadius: "50%",
    background: "#1ED760",
    boxShadow: "0 0 5px #1ED760",
  },
  cdjCenter: {
    width: "46%",
    height: "46%",
    background: "radial-gradient(circle, #0d0d0d, #242424)",
    border: "2px solid #585858",
    boxShadow: "inset 0 0 6px rgba(0,0,0,0.6)",
  },

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

export const LOADER_STYLES = [
  { key: "vinyl", label: "Vinyl" },
  { key: "cd", label: "CD" },
  { key: "cassette", label: "Cassette" },
  { key: "cdj", label: "CDJ" },
];

export const MusicSpinner = ({ variant = "vinyl", size = 64 }) => {
  const c = useStyles();
  const wrap = { position: "relative", width: size, height: size };

  if (variant === "cd") {
    return (
      <div style={wrap}>
        <div className={`${c.disc} ${c.cd}`} />
        <div className={`${c.center} ${c.cdRing}`} />
        <div className={`${c.center} ${c.cdHole}`} />
      </div>
    );
  }
  if (variant === "cdj") {
    return (
      <div style={wrap}>
        <div className={`${c.disc} ${c.cdjPlatter}`}>
          <div className={c.cdjMarker} />
        </div>
        <div className={`${c.center} ${c.cdjCenter}`} />
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
