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
// `headers` (an HLS auth header) is given to ffmpeg for REMOTE inputs so it can
// fetch the m3u8 playlist + its segments itself; omitted for a local file.
async function decode(input, durationMs, dir, headers) {
  const wav = path.join(dir, "a.wav");
  const seg = path.join(dir, "seg.wav");
  // For an HLS/remote input, let ffmpeg follow the playlist (a downloaded .m3u8
  // has no base URL to resolve its segments). Whitelist the nested protocols
  // and carry auth on every request.
  const pre = headers
    ? [
        "-protocol_whitelist",
        "file,http,https,tcp,tls,crypto",
        "-headers",
        `Authorization: ${headers}\r\n`,
      ]
    : [];
  await run(FFMPEG, ["-y", ...pre, "-i", input, "-ac", "1", "-ar", "44100", wav]).catch(
    () => {
      const err = new Error("decode_failed");
      err.code = "decode_failed";
      throw err;
    }
  );
  const start = Math.max(20, Math.floor(((durationMs || 0) / 1000) * 0.25));
  await run(FFMPEG, ["-y", "-ss", String(start), "-t", "90", "-i", wav, "-ac", "1", seg]).catch(
    () => {}
  );
  // If the mid-segment is empty (e.g. a ~30s preview shorter than the 25%-in
  // start offset), fall back to the full decoded wav so BPM still runs. An
  // empty WAV is just its ~44-byte header; a real segment is far larger.
  const segOk = fs.existsSync(seg) && fs.statSync(seg).size > 4096;
  return { wav, seg: segOk ? seg : wav };
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

// Analyze a local file path OR a remote URL. `headers` is passed to ffmpeg for
// remote (HLS) inputs so it can fetch the playlist + segments with auth.
async function analyzeFile(input, { durationMs, genre, headers } = {}) {
  if (durationMs && durationMs > LIKELY_SET_MS) return { isLikelySet: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kt-an-"));
  try {
    const { wav, seg } = await decode(input, durationMs, dir, headers);
    const [key, bpm] = await Promise.all([detectKey(wav), detectBpm(seg, genre)]);
    return { isLikelySet: false, camelot: key.camelot, key: key.key, bpm };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Does this URL look like an HLS playlist? SoundCloud's hls_* stream URLs
// resolve to .m3u8 (sometimes behind a query string).
function looksLikeHls(url) {
  return /\.m3u8(\?|$)/i.test(url) || /(^|[?&/])hls/i.test(url);
}

// Analyze a remote audio URL. SoundCloud stream URLs need
// `Authorization: OAuth <token>`.
//   - Progressive MP3: download the bytes, then decode the local file.
//   - HLS (m3u8): hand the URL straight to ffmpeg so it fetches the playlist +
//     segments itself (a saved .m3u8 has no base URL to resolve them).
async function analyzeUrl(audioUrl, { authHeader, durationMs, genre, isHls } = {}) {
  if (durationMs && durationMs > LIKELY_SET_MS) return { isLikelySet: true };

  if (isHls || looksLikeHls(audioUrl)) {
    return await analyzeFile(audioUrl, { durationMs, genre, headers: authHeader });
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kt-an-"));
  const file = path.join(dir, "in.audio");
  try {
    const res = await fetch(audioUrl, {
      headers: authHeader ? { Authorization: authHeader } : {},
      redirect: "follow",
    });
    if (!res.ok) {
      const err = new Error("download_failed " + res.status);
      err.code = "download_failed";
      throw err;
    }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return await analyzeFile(file, { durationMs, genre });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { analyzeFile, analyzeUrl, LIKELY_SET_MS };
