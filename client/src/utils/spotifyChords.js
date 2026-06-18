// Client-side chord-loop detection for SPOTIFY tracks from their /audio-analysis
// chroma — no analysis service involved. Each segment carries a 12-dim pitch
// (chroma) vector; we template-match it to a maj/min triad, collapse to a chord
// timeline, extract the repeating loop, and rotate it to start on the FIRST
// loop-chord that actually sounds (empirical, never assume the tonic). Spelled
// to the track's key. Returns an array like ["Em","A","D","Bm"], or null when
// there's no clear loop. This is the lighter, automatic path for Spotify;
// madmom (preview) is the heavier on-demand fallback.

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// 24 unit-norm triad templates.
const TRIADS = [];
for (let r = 0; r < 12; r++) {
  for (const [isMin, ints] of [
    [false, [0, 4, 7]],
    [true, [0, 3, 7]],
  ]) {
    const v = new Array(12).fill(0);
    for (const i of ints) v[(r + i) % 12] = 1;
    const norm = Math.sqrt(3);
    TRIADS.push({ root: r, min: isMin, vec: v.map((x) => x / norm) });
  }
}

// `${root}-${min}` key helpers keep the maj/min distinction through the pipeline.
const ck = (root, min) => `${root}-${min ? 1 : 0}`;

function segChord(pitches) {
  if (!pitches || pitches.length < 12) return null;
  let n = 0;
  for (let i = 0; i < 12; i++) n += pitches[i] * pitches[i];
  n = Math.sqrt(n);
  if (!n) return null;
  let best = null;
  let bestSim = -1;
  for (const t of TRIADS) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += (pitches[i] / n) * t.vec[i];
    if (s > bestSim) {
      bestSim = s;
      best = t;
    }
  }
  return best;
}

function collapse(segments, minDur = 0.8) {
  const runs = [];
  for (const s of segments) {
    const t = segChord(s.pitches);
    if (!t) continue;
    const last = runs[runs.length - 1];
    if (last && last.root === t.root && last.min === t.min) last.dur += s.duration;
    else runs.push({ root: t.root, min: t.min, dur: s.duration });
  }
  return runs.filter((r) => r.dur >= minDur);
}

function mostCommon(arr) {
  const c = {};
  let best = arr[0];
  let bn = 0;
  for (const x of arr) {
    c[x] = (c[x] || 0) + 1;
    if (c[x] > bn) {
      bn = c[x];
      best = x;
    }
  }
  return best;
}

function extractLoop(runs) {
  if (!runs.length) return null;
  // Core chords by total time (cover ~85%, cap 6).
  const dur = {};
  let total = 0;
  for (const r of runs) {
    const k = ck(r.root, r.min);
    dur[k] = (dur[k] || 0) + r.dur;
    total += r.dur;
  }
  const sorted = Object.entries(dur).sort((a, b) => b[1] - a[1]);
  const core = [];
  let cum = 0;
  for (const [k, d] of sorted) {
    core.push(k);
    cum += d;
    if (cum / total >= 0.85 || core.length >= 6) break;
  }
  if (core.length > 5) return null;
  const coreSet = new Set(core);
  // Dedup'd chronological sequence of core chords.
  const seq = [];
  for (const r of runs) {
    const k = ck(r.root, r.min);
    if (coreSet.has(k) && seq[seq.length - 1] !== k) seq.push(k);
  }
  if (!seq.length) return null;
  // Reconstruct the cycle by following the most common successor.
  const trans = {};
  for (let i = 0; i < seq.length - 1; i++) {
    const t = `${seq[i]}>${seq[i + 1]}`;
    trans[t] = (trans[t] || 0) + 1;
  }
  let cur = mostCommon(seq);
  const cyc = [cur];
  while (cyc.length < coreSet.size) {
    let next = null;
    let nb = -1;
    for (const k of coreSet) {
      if (cyc.includes(k)) continue;
      const c = trans[`${cur}>${k}`] || 0;
      if (c > nb) {
        nb = c;
        next = k;
      }
    }
    if (next === null) break;
    cyc.push(next);
    cur = next;
  }
  // Chronological-first: rotate so the loop starts on the first core chord that
  // actually sounds (the collapse step already dropped sub-0.8s intro stabs).
  const first = seq[0];
  const i = cyc.indexOf(first);
  return i > 0 ? cyc.slice(i).concat(cyc.slice(0, i)) : cyc;
}

// Should this key be spelled with flats? (flat-side of the Camelot wheel)
const FLAT_KEYS = new Set([
  "1-1", "8-1", "3-1", "10-1", "5-1", "6-1", // Db Ab Eb Bb F Gb major
  "5-0", "0-0", "7-0", "2-0", "10-0", "3-0", // Fm Cm Gm Dm Bbm Ebm minor
]);

// Given Spotify's /audio-analysis JSON, return the chord loop or null.
export function chordsFromAnalysis(analysis) {
  try {
    const segs = analysis && analysis.segments;
    if (!Array.isArray(segs) || !segs.length) return null;
    const cyc = extractLoop(collapse(segs));
    if (!cyc || !cyc.length) return null;
    const key = analysis.track ? analysis.track.key : -1;
    const mode = analysis.track ? analysis.track.mode : 1;
    const flats = key >= 0 && FLAT_KEYS.has(`${key}-${mode}`);
    const names = flats ? FLAT : SHARP;
    return cyc.map((k) => {
      const [root, min] = k.split("-");
      return names[Number(root)] + (min === "1" ? "m" : "");
    });
  } catch (e) {
    return null;
  }
}
