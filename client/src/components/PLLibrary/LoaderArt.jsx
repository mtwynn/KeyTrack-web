import React from "react";
import { makeStyles } from "@material-ui/core/styles";

// Music-player themed loaders for the "Loading all crates…" dialog: a faithful
// animated Pioneer CDJ-3000 (the default), a vinyl, a CD, or a cassette — plus
// a sleek progress bar that fills. The vinyl/CD/cassette use makeStyles; the CDJ
// is a self-contained hardware recreation whose CSS is scoped under `.ktcdj` so
// it can never leak into the rest of the app.
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
  vinyl: {
    background:
      "conic-gradient(from 0deg, rgba(255,255,255,0.16) 0 26deg, transparent 26deg 360deg)," +
      "repeating-radial-gradient(circle at center, #000 0 1.5px, #1c1c1c 1.5px 3.5px)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
    animation: "$ktspin 1.7s linear infinite",
  },
  vinylLabel: { width: "40%", height: "40%", background: "#1ED760", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.15)" },
  hole: { width: "7%", height: "7%", background: "#fff" },
  cd: {
    background:
      "conic-gradient(from 0deg, #ff5500, #ffd000, #1ED760, #00b4d8, #7b2ff7, #ff2d8e, #ff5500)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
    animation: "$ktspin 1.25s linear infinite",
  },
  cdRing: { width: "34%", height: "34%", background: "#fff", boxShadow: "inset 0 0 0 5px rgba(180,180,180,0.5)" },
  cdHole: { width: "13%", height: "13%", background: "#fafafa", border: "1px solid #ccc" },
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

// Waveform (dense, envelope-like), doubled below for a seamless scroll.
const WF = (() => {
  const h = [];
  for (let i = 0; i < 96; i++) {
    const env =
      Math.pow(Math.abs(Math.sin(i * 0.13)), 0.55) * 0.55 +
      Math.abs(Math.sin(i * 0.47 + 1)) * 0.26;
    const d = (Math.sin(i * 1.9) * 0.5 + 0.5) * 0.2;
    h.push(Math.min(1, 0.15 + env + d * env));
  }
  return h.concat(h);
})();
const OV = Array.from({ length: 60 }, (_, j) => 0.3 + Math.abs(Math.sin(j * 0.5)) * 0.6);

// All CDJ rules are scoped under `.ktcdj`.
const CDJ_CSS = `
.ktcdj { position:relative; width:340px; height:432px; border-radius:16px; box-sizing:border-box; padding:8px;
  font-family:Arial,Helvetica,sans-serif;
  background:linear-gradient(180deg,#2b2b2e 0%,#1b1b1d 8%,#161618 50%,#0e0e10 100%);
  box-shadow:0 18px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.10), inset 0 -2px 6px rgba(0,0,0,.7); }
.ktcdj .lbl { color:#8a8a8e; font-size:5px; letter-spacing:.3px; text-transform:uppercase; }
.ktcdj .header { height:12px; margin:0 28px; border-radius:0 0 5px 5px; background:linear-gradient(#202023,#161618);
  display:flex; align-items:center; gap:8px; padding:0 8px; box-shadow:inset 0 -1px 2px rgba(0,0,0,.6); }
.ktcdj .rekordbox { color:#d7d7d7; font-size:5.5px; font-weight:700; }
.ktcdj .tabs { display:flex; gap:6px; margin-left:6px; }
.ktcdj .tab { font-size:5px; color:#8a8a8e; }
.ktcdj .tab.on { color:#3fa9ff; }
.ktcdj .upper { display:flex; gap:7px; margin-top:7px; padding:0 4px; }
.ktcdj .screen { width:232px; height:150px; flex:0 0 auto; border-radius:6px; background:#0a0d12; border:1.5px solid #2a2d33;
  box-shadow:inset 0 0 14px rgba(0,0,0,.7),0 1px 2px rgba(0,0,0,.5); overflow:hidden; position:relative; }
.ktcdj .screen::after { content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(135deg,rgba(255,255,255,.07) 0 30%,transparent 42%); }
.ktcdj .sc-top { display:flex; align-items:center; gap:4px; padding:4px 5px 2px; }
.ktcdj .sc-art { width:14px; height:14px; border-radius:2px; background:linear-gradient(135deg,#ff5fa2,#ffb04a); }
.ktcdj .sc-title { color:#e8e8e8; font-size:6px; font-weight:700; line-height:1.25; }
.ktcdj .sc-meta { color:#b9b9b9; font-size:5px; }
.ktcdj .lanes { margin:1px 4px 0; }
.ktcdj .lanes div { height:1.5px; margin:1.5px 0; border-radius:1px;
  background:repeating-linear-gradient(90deg,#2a4d6e 0 5px,#1a3550 5px 7px); }
.ktcdj .wf { position:relative; height:50px; margin:1px 4px 0; background:#04060a; border-radius:2px; overflow:hidden; }
.ktcdj .wf-track { position:absolute; inset:0; display:flex; align-items:center; animation:ktcdjwave 2.6s linear infinite; }
.ktcdj .wf-bar { flex:0 0 auto; width:1.5px; margin:0 .35px; border-radius:1px; align-self:center;
  background:linear-gradient(to bottom,#5cc8ff 0 50%,#ff9233 50% 100%); }
.ktcdj .wf::after { content:""; position:absolute; left:30%; top:0; bottom:0; width:1px; background:rgba(255,255,255,.65); z-index:2; }
.ktcdj .sc-data { display:flex; gap:4px; padding:4px 5px; align-items:stretch; }
.ktcdj .sc-box { background:#11151c; border:1px solid #232a33; border-radius:2px; color:#cfcfcf; font-size:5px; padding:2px 3px; }
.ktcdj .sc-time { color:#fff; font-size:13px; font-weight:700; letter-spacing:.5px; flex:1; align-self:center; text-align:center; }
.ktcdj .sc-bpm { color:#ffae3d; font-size:11px; font-weight:800; align-self:center; }
.ktcdj .sc-ov { height:16px; margin:0 4px 4px; border-radius:2px; overflow:hidden; background:linear-gradient(#0a1018,#070b11); position:relative; }
.ktcdj .sc-ov-wave { position:absolute; inset:0; display:flex; align-items:flex-end; padding:0 2px; }
.ktcdj .sc-ov-bar { flex:1; margin:0 .3px; background:linear-gradient(#3fa9ff,#2a6fb0); border-radius:1px; }
.ktcdj .rightcol { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; padding-top:4px; }
.ktcdj .smallbtns { display:flex; gap:3px; }
.ktcdj .sbtn { width:22px; height:11px; border-radius:3px; background:linear-gradient(#26262a,#161619);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 1px rgba(0,0,0,.5);
  color:#9a9a9e; font-size:4px; display:flex; align-items:center; justify-content:center; }
.ktcdj .rotary { width:50px; height:50px; border-radius:50%; position:relative;
  background:radial-gradient(circle at 50% 38%,#45454a,#2a2a2e 55%,#161618 100%);
  box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 0 0 3px #1d1d20; }
.ktcdj .rotary::before { content:""; position:absolute; inset:9px; border-radius:50%;
  background:repeating-conic-gradient(#3a3a3e 0 6deg,#242427 6deg 12deg); box-shadow:inset 0 0 0 2px #0e0e10; }
.ktcdj .rotary::after { content:""; position:absolute; top:50%; left:50%; width:14px; height:14px;
  transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,#3f3f44,#202023); }
.ktcdj .pads { display:flex; gap:4px; justify-content:center; margin:8px 12px 0; }
.ktcdj .pad { flex:1; height:16px; border-radius:3px; background:linear-gradient(#242428,#141417);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 1px 1px rgba(0,0,0,.5); border-top:1.5px solid var(--c,#3a6); }
.ktcdj .mid { display:flex; justify-content:space-between; align-items:center; margin:7px 12px 0; }
.ktcdj .rndbtn { width:18px; height:18px; border-radius:50%; background:radial-gradient(circle at 50% 35%,#2a2a2e,#131316);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.5); }
.ktcdj .amber { background:radial-gradient(circle at 50% 35%,#ffd27a,#f2a01e 60%,#b86f00);
  box-shadow:0 0 7px rgba(255,170,40,.7),inset 0 1px 1px rgba(255,255,255,.5); }
.ktcdj .vinylbtn { width:22px; height:12px; border-radius:3px; font-size:4.5px; color:#fff;
  background:linear-gradient(#1f5fbf,#17458c); display:flex; align-items:center; justify-content:center; box-shadow:0 0 6px rgba(40,110,255,.6); }
.ktcdj .deck { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px; }
.ktcdj .leftcol { display:flex; flex-direction:column; align-items:center; gap:8px; width:46px; }
.ktcdj .bigbtn { width:30px; height:30px; border-radius:50%; position:relative;
  background:radial-gradient(circle at 50% 35%,#303034,#141417); box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 2px 3px rgba(0,0,0,.5); }
.ktcdj .bigbtn.cue { box-shadow:0 0 0 3px rgba(240,200,0,.85),0 2px 4px rgba(0,0,0,.5); }
.ktcdj .bigbtn.play { box-shadow:0 0 0 3px rgba(30,215,96,.9),0 2px 4px rgba(0,0,0,.5); }
.ktcdj .arrbtns { display:flex; gap:4px; }
.ktcdj .arr { width:16px; height:12px; border-radius:3px; background:radial-gradient(circle at 50% 35%,#ffcf7a,#e09a1e); box-shadow:0 0 5px rgba(255,170,40,.5); }
.ktcdj .jog { position:relative; width:192px; height:192px; flex:0 0 auto; }
.ktcdj .jog-ring { position:absolute; inset:0; border-radius:50%; animation:ktcdjspin 6s linear infinite;
  background:repeating-conic-gradient(from 0deg,#56565c 0 3.5deg,#34343a 3.5deg 7deg),
    radial-gradient(circle,#2e2e32 62%,#5a5a62 62% 70%,#3a3a40 70% 90%,#1c1c20 90% 100%);
  box-shadow:0 7px 18px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.06); }
.ktcdj .jog-platter { position:absolute; inset:22px; border-radius:50%;
  background:radial-gradient(circle at 50% 38%,#2a2a2d 0%,#1c1c1f 45%,#121214 78%,#0c0c0e 100%);
  box-shadow:inset 0 0 24px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.5); }
.ktcdj .jog-sheen { position:absolute; inset:22px; border-radius:50%; animation:ktcdjspin 4s linear infinite;
  background:conic-gradient(from 0deg,rgba(255,255,255,.10) 0 22deg,transparent 22deg 360deg); }
.ktcdj .jog-dispwrap { position:absolute; top:50%; left:50%; width:44px; height:44px; transform:translate(-50%,-50%);
  border-radius:50%; box-shadow:0 0 0 4px #0c0c0e,0 0 10px rgba(0,0,0,.6); }
.ktcdj .jog-disp { position:absolute; inset:0; border-radius:50%; animation:ktcdjspin 2.4s linear infinite;
  background:conic-gradient(#ff2d6f,#ff7a00,#ffd000,#1ED760,#00d4ff,#4b7bff,#b14bff,#ff2d6f); }
.ktcdj .jog-disp::after { content:""; position:absolute; inset:16px; border-radius:50%;
  background:radial-gradient(circle,#161616,#262626); box-shadow:inset 0 0 0 1px rgba(255,255,255,.12); }
.ktcdj .rightcol2 { display:flex; flex-direction:column; align-items:center; gap:5px; width:46px; }
.ktcdj .fader { width:16px; height:120px; border-radius:4px; background:linear-gradient(#0e0e10,#1a1a1d);
  box-shadow:inset 0 0 4px rgba(0,0,0,.8); position:relative; }
.ktcdj .fader::before { content:""; position:absolute; left:50%; top:6px; bottom:6px; width:2px; transform:translateX(-50%); background:#000; border-radius:2px; }
.ktcdj .fader-knob { position:absolute; left:50%; top:30px; transform:translateX(-50%); width:24px; height:12px; border-radius:3px;
  background:linear-gradient(#3a3a3e,#1c1c20); box-shadow:0 2px 3px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1); }
.ktcdj .brand { position:absolute; left:0; right:0; bottom:5px; text-align:center; }
.ktcdj .brand .pioneer { color:#d7d7d7; font-size:11px; font-weight:800; font-style:italic; letter-spacing:.5px; }
.ktcdj .brand .model { color:#9a9a9e; font-size:5px; margin-top:1px; }
@keyframes ktcdjspin { from { transform:rotate(0); } to { transform:rotate(360deg); } }
@keyframes ktcdjwave { from { transform:translateX(0); } to { transform:translateX(-50%); } }
`;

function CdjDeck({ scale = 0.56 }) {
  return (
    <div style={{ width: Math.round(340 * scale), height: Math.round(432 * scale) }}>
      <style>{CDJ_CSS}</style>
      <div className="ktcdj" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div className="header">
          <span className="rekordbox">rekordbox</span>
          <div className="tabs">
            <span className="tab">SOURCE</span>
            <span className="tab on">BROWSE</span>
            <span className="tab">TAG LIST</span>
            <span className="tab">PLAYLIST</span>
            <span className="tab">SEARCH</span>
          </div>
        </div>

        <div className="upper">
          <div className="screen">
            <div className="sc-top">
              <div className="sc-art" />
              <div>
                <div className="sc-title">Now Loading (Crate Mix)</div>
                <div className="sc-meta">07:29&nbsp;&nbsp;124.0&nbsp;&nbsp;Cm</div>
              </div>
            </div>
            <div className="lanes">
              <div />
              <div />
            </div>
            <div className="wf">
              <div className="wf-track">
                {WF.map((h, i) => (
                  <div key={i} className="wf-bar" style={{ height: `${Math.round(h * 94)}%` }} />
                ))}
              </div>
            </div>
            <div className="sc-data">
              <div className="sc-box">
                PLAYER 6
                <br />
                TRACK 15
              </div>
              <div className="sc-time">
                02:35<span style={{ fontSize: 7 }}>.350</span>
              </div>
              <div className="sc-bpm">
                124.7
                <div className="sc-meta" style={{ color: "#9a9a9e" }}>
                  BPM · Cm
                </div>
              </div>
            </div>
            <div className="sc-ov">
              <div className="sc-ov-wave">
                {OV.map((h, i) => (
                  <div key={i} className="sc-ov-bar" style={{ height: `${Math.round(h * 100)}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="rightcol">
            <div className="smallbtns">
              <div className="sbtn">BACK</div>
              <div className="sbtn">TAG</div>
            </div>
            <div className="rotary" />
            <div className="smallbtns">
              <div className="sbtn">FILTER</div>
              <div className="sbtn">CUT</div>
            </div>
            <div className="lbl">MP3/AAC/WAV</div>
            <div className="rotary" style={{ width: 26, height: 26 }} />
          </div>
        </div>

        <div className="pads">
          {["#e23b5a", "#3b7de2", "#27c08a", "#e2c23b", "#8a3be2", "#e23bb0", "#3be2c0", "#e2733b"].map(
            (c, i) => (
              <div key={i} className="pad" style={{ "--c": c }} />
            )
          )}
        </div>

        <div className="mid">
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div className="rndbtn amber" />
            <div className="rndbtn amber" />
            <div className="rndbtn" />
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div className="rndbtn amber" style={{ width: 12, height: 12 }} />
            <div className="rndbtn amber" style={{ width: 12, height: 12 }} />
            <div className="rndbtn" style={{ width: 12, height: 12 }} />
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div className="vinylbtn">VINYL</div>
            <div className="sbtn" style={{ width: 18, height: 12 }}>
              JOG
            </div>
          </div>
        </div>

        <div className="deck">
          <div className="leftcol">
            <div className="arrbtns">
              <div className="arr" />
              <div className="arr" />
            </div>
            <div className="arrbtns">
              <div className="arr" />
              <div className="arr" />
            </div>
            <div className="bigbtn cue" />
            <div className="bigbtn play" />
          </div>

          <div className="jog">
            <div className="jog-ring" />
            <div className="jog-platter" />
            <div className="jog-sheen" />
            <div className="jog-dispwrap">
              <div className="jog-disp" />
            </div>
          </div>

          <div className="rightcol2">
            <div className="sbtn" style={{ width: 30 }}>
              TEMPO
            </div>
            <div className="rndbtn" style={{ width: 8, height: 8, boxShadow: "0 0 5px red" }} />
            <div className="fader">
              <div className="fader-knob" />
            </div>
          </div>
        </div>

        <div className="brand">
          <div className="pioneer">Pioneer Dj</div>
          <div className="model">MULTI PLAYER&nbsp;&nbsp;CDJ-3000</div>
        </div>
      </div>
    </div>
  );
}

export const LOADER_STYLES = [
  { key: "cdj", label: "CDJ" },
  { key: "vinyl", label: "Vinyl" },
  { key: "cd", label: "CD" },
  { key: "cassette", label: "Cassette" },
];

export const MusicSpinner = ({ variant = "cdj", size = 72 }) => {
  const c = useStyles();
  const wrap = { position: "relative", width: size, height: size };

  if (variant === "cdj") return <CdjDeck />;
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
