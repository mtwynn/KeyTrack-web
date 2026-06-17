// The analysis pipeline: audio → key (keyfinder-cli) + BPM (madmom).
//
// Key detection shells out to keyfinder-cli (GPL) as a separate process (no
// linking), so this service — and KeyTrack — stay MIT. BPM is computed by
// madmom (band-constrained, genre-aware) via a separate Python venv; see
// bpm_madmom.py.
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");
const execFileP = promisify(execFile);

const { CAMELOT_TO_KEY } = require("./camelot");

// Tracks longer than this are almost certainly DJ sets/mixes — their key/BPM
// wander, so analysis is meaningless. Mirror the frontend constant.
const LIKELY_SET_MS = 6 * 60 * 1000;
// Allow overriding the binary paths for local dev (where keyfinder-cli may be
// a freshly-built binary rather than on PATH).
const KEYFINDER = process.env.KEYFINDER_CLI || "keyfinder-cli";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
// BPM + chords are computed by madmom in its own Python venv (overridable for
// local dev).
const MADMOM_PY = process.env.MADMOM_PY || "/opt/madmom-venv/bin/python";
const MADMOM_BPM = path.join(__dirname, "bpm_madmom.py");
const MADMOM_CHORDS = path.join(__dirname, "chords_madmom.py");

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
  // A SHORTER segment for the heavy chord CNN — fewer seconds of audio = faster
  // inference, so the time-boxed chord pass finishes on the small Eco dyno (a
  // ~30s window still spans several repetitions of the loop).
  const cseg = path.join(dir, "cseg.wav");
  await run(FFMPEG, ["-y", "-ss", String(start), "-t", "30", "-i", wav, "-ac", "1", cseg]).catch(
    () => {}
  );
  // If a mid-segment is empty (e.g. a ~30s preview shorter than the 25%-in
  // start offset), fall back to the full decoded wav so BPM still runs. An
  // empty WAV is just its ~44-byte header; a real segment is far larger.
  const segOk = fs.existsSync(seg) && fs.statSync(seg).size > 4096;
  const csegOk = fs.existsSync(cseg) && fs.statSync(cseg).size > 4096;
  return { wav, seg: segOk ? seg : wav, cseg: csegOk ? cseg : segOk ? seg : wav };
}

async function detectKey(wav) {
  const camelot = await run(KEYFINDER, ["-n", "camelot", wav]).catch(() => null);
  return { camelot: camelot || null, key: (camelot && CAMELOT_TO_KEY[camelot]) || null };
}

// BPM via madmom: shell out to the Python script (like keyfinder-cli) with the
// decoded segment + SoundCloud genre tag. It prints a single integer BPM
// already folded into the genre's tempo band, or nothing on failure → null.
function detectBpm(seg, genre) {
  return run(MADMOM_PY, [MADMOM_BPM, seg, genre || ""])
    .then((out) => {
      const v = parseInt(out, 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    })
    .catch(() => null);
}

// Chord loop via madmom: prints a JSON array of the repeating chords in cyclic
// order (rotated to the camelot tonic + spelled to its key), or `null` when
// there's no clear loop. `camelot` is our own keyfinder result.
function detectChords(seg, camelot) {
  // Time-boxed + KILLED at 14s: the chord CNN is heavy, and a slow one must
  // never push the request past Heroku's 30s router timeout (nor linger and
  // OOM the next analysis). On timeout/kill or any error we return null — key
  // and BPM are unaffected.
  return execFileP(MADMOM_PY, [MADMOM_CHORDS, seg, camelot || ""], {
    maxBuffer: 1 << 26,
    timeout: 14000,
    killSignal: "SIGKILL",
  })
    .then((r) => {
      try {
        const arr = JSON.parse(r.stdout.trim());
        return Array.isArray(arr) && arr.length ? arr : null;
      } catch (e) {
        return null;
      }
    })
    .catch(() => null);
}

// Analyze a local file path OR a remote URL. `headers` is passed to ffmpeg for
// remote (HLS) inputs so it can fetch the playlist + segments with auth.
async function analyzeFile(input, { durationMs, genre, headers } = {}) {
  if (durationMs && durationMs > LIKELY_SET_MS) return { isLikelySet: true };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kt-an-"));
  try {
    const { wav, seg, cseg } = await decode(input, durationMs, dir, headers);
    // Key (keyfinder, light) + BPM (madmom) run in parallel — the critical data.
    const [key, bpm] = await Promise.all([detectKey(wav), detectBpm(seg, genre)]);
    // Chords run AFTER (never a second madmom CNN concurrently → stays under the
    // dyno's memory) on a shorter segment, and detectChords self-bounds at 14s,
    // so a slow chord pass returns null rather than blowing the request past
    // Heroku's 30s limit — key/BPM always return even when chords don't make it.
    const chords = await detectChords(cseg, key.camelot);
    return { isLikelySet: false, camelot: key.camelot, key: key.key, bpm, chords };
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
