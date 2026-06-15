// The analysis pipeline: audio → key (keyfinder-cli) + BPM (bpm-tools).
//
// We shell out to two GPL command-line tools as separate processes (no linking
// into our code), so this service — and KeyTrack — stay MIT.
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");
const execFileP = promisify(execFile);

const { CAMELOT_TO_KEY } = require("./camelot");
const { octaveFold } = require("./bpm");

// Tracks longer than this are almost certainly DJ sets/mixes — their key/BPM
// wander, so analysis is meaningless. Mirror the frontend constant.
const LIKELY_SET_MS = 6 * 60 * 1000;
// Allow overriding the binary paths for local dev (where keyfinder-cli may be
// a freshly-built binary rather than on PATH).
const KEYFINDER = process.env.KEYFINDER_CLI || "keyfinder-cli";
const BPM_BIN = process.env.BPM_BIN || "bpm";
const FFMPEG = process.env.FFMPEG || "ffmpeg";

const run = (cmd, args) =>
  execFileP(cmd, args, { maxBuffer: 1 << 26 }).then((r) => r.stdout.trim());

// Decode to mono 44.1k WAV + a steady ~90s mid-segment (start at 25% in).
async function decode(input, durationMs, dir) {
  const wav = path.join(dir, "a.wav");
  const seg = path.join(dir, "seg.wav");
  await run(FFMPEG, ["-y", "-i", input, "-ac", "1", "-ar", "44100", wav]);
  const start = Math.max(20, Math.floor(((durationMs || 0) / 1000) * 0.25));
  await run(FFMPEG, ["-y", "-ss", String(start), "-t", "90", "-i", wav, "-ac", "1", seg]).catch(
    () => {}
  );
  return { wav, seg: fs.existsSync(seg) ? seg : wav };
}

async function detectKey(wav) {
  const camelot = await run(KEYFINDER, ["-n", "camelot", wav]).catch(() => null);
  return { camelot: camelot || null, key: (camelot && CAMELOT_TO_KEY[camelot]) || null };
}

// bpm-tools reads raw float samples from stdin — pipe ffmpeg's PCM into it.
function detectBpm(seg, genre) {
  return new Promise((resolve) => {
    const ff = spawn(FFMPEG, ["-v", "quiet", "-i", seg, "-f", "f32le", "-ar", "44100", "-ac", "1", "-"]);
    const bpm = spawn(BPM_BIN, ["-m", "70", "-x", "180"]);
    let out = "";
    ff.stdout.pipe(bpm.stdin);
    bpm.stdout.on("data", (d) => (out += d));
    ff.on("error", () => {});
    bpm.on("error", () => resolve(null));
    bpm.on("close", () => {
      const raw = parseFloat(out);
      resolve(raw ? octaveFold(raw, genre) : null);
    });
  });
}

// Analyze a local audio file path.
async function analyzeFile(input, { durationMs, genre } = {}) {
  if (durationMs && durationMs > LIKELY_SET_MS) return { isLikelySet: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kt-an-"));
  try {
    const { wav, seg } = await decode(input, durationMs, dir);
    const [key, bpm] = await Promise.all([detectKey(wav), detectBpm(seg, genre)]);
    return { isLikelySet: false, camelot: key.camelot, key: key.key, bpm };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Analyze a remote audio URL (downloads first, with an optional auth header —
// SoundCloud stream URLs need `Authorization: OAuth <token>`).
async function analyzeUrl(audioUrl, { authHeader, durationMs, genre } = {}) {
  if (durationMs && durationMs > LIKELY_SET_MS) return { isLikelySet: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kt-an-"));
  const file = path.join(dir, "in.audio");
  try {
    const res = await fetch(audioUrl, {
      headers: authHeader ? { Authorization: authHeader } : {},
      redirect: "follow",
    });
    if (!res.ok) throw new Error("download failed " + res.status);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return await analyzeFile(file, { durationMs, genre });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { analyzeFile, analyzeUrl, LIKELY_SET_MS };
