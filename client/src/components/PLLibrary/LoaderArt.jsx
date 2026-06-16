import React from "react";
import { makeStyles } from "@material-ui/core/styles";

// Music-player themed loaders for the "Loading all crates…" dialog: a spinning
// vinyl, a CD, or a cassette, plus a sleek progress bar that fills up.
const useStyles = makeStyles({
  "@keyframes ktspin": {
    "0%": { transform: "translate(-50%, -50%) rotate(0deg)" },
    "100%": { transform: "translate(-50%, -50%) rotate(360deg)" },
  },
  "@keyframes ktspinPlain": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },

  // --- Vinyl record ---
  vinylWrap: { position: "relative", width: 76, height: 76 },
  vinyl: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 76,
    height: 76,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, rgba(255,255,255,0.14) 0 26deg, transparent 26deg 360deg)," +
      "repeating-radial-gradient(circle at center, #000 0 1.5px, #1c1c1c 1.5px 3.5px)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
    animation: "$ktspin 1.7s linear infinite",
  },
  vinylLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "40%",
    height: "40%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "#1ED760",
    boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.15)",
  },
  vinylHole: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "7%",
    height: "7%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "#fff",
  },

  // --- CD ---
  cdWrap: { position: "relative", width: 76, height: 76 },
  cd: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 76,
    height: 76,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, #ff5500, #ffd000, #1ED760, #00b4d8, #7b2ff7, #ff2d8e, #ff5500)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
    animation: "$ktspin 1.25s linear infinite",
  },
  cdRing: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "34%",
    height: "34%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "inset 0 0 0 5px rgba(180,180,180,0.5)",
  },
  cdHole: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "13%",
    height: "13%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "#fafafa",
    border: "1px solid #ccc",
  },

  // --- Cassette ---
  cassette: {
    position: "relative",
    width: 104,
    height: 64,
    borderRadius: 8,
    background: "linear-gradient(#444, #222)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    "&::before": {
      content: '""',
      position: "absolute",
      top: 8,
      left: 10,
      right: 10,
      height: 26,
      borderRadius: 4,
      background: "rgba(255,255,255,0.08)",
    },
  },
  reel: {
    position: "relative",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background:
      "conic-gradient(#bbb 0 18deg, #555 18deg 90deg, #bbb 90deg 108deg, #555 108deg 180deg," +
      "#bbb 180deg 198deg, #555 198deg 270deg, #bbb 270deg 288deg, #555 288deg 360deg)",
    border: "3px solid #e8e8e8",
    animation: "$ktspinPlain 1.5s linear infinite",
    zIndex: 1,
  },

  // --- Fill bar ---
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

export const MusicSpinner = ({ variant = "vinyl" }) => {
  const classes = useStyles();
  if (variant === "cd") {
    return (
      <div className={classes.cdWrap}>
        <div className={classes.cd} />
        <div className={classes.cdRing} />
        <div className={classes.cdHole} />
      </div>
    );
  }
  if (variant === "cassette") {
    return (
      <div className={classes.cassette}>
        <div className={classes.reel} />
        <div className={classes.reel} />
      </div>
    );
  }
  return (
    <div className={classes.vinylWrap}>
      <div className={classes.vinyl} />
      <div className={classes.vinylLabel} />
      <div className={classes.vinylHole} />
    </div>
  );
};

export const FillBar = ({ done, total }) => {
  const classes = useStyles();
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={classes.barTrack}>
      <div className={classes.barFill} style={{ width: pct + "%" }} />
      <span className={classes.barText}>
        {done}/{total}
      </span>
    </div>
  );
};
