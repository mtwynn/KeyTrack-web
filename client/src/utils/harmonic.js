// Harmonic-mixing helpers built around the Camelot wheel.
//
// A Camelot code is a number 1-12 plus a letter: "A" = minor, "B" = major.
// Two tracks mix harmonically when their codes are: identical, ±1 on the same
// letter (adjacent on the wheel = neighboring keys), or the same number on the
// opposite letter (relative major/minor). These are the rules DJs use for a
// clean key transition.

import KeyMap from "./KeyMap";

const CAMELOT_RE = /^(\d{1,2})([AB])$/;

// Camelot codes are the canonical representation of a key across every filter
// surface (piano, wheel, open). Build a reverse lookup from KeyMap so any code
// can be rendered in musical or Open-key notation. mode 0 = minor, 1 = major.
const CAMELOT_INFO = {};
KeyMap.forEach((entry, pitchClass) => {
  [0, 1].forEach((mode) => {
    CAMELOT_INFO[entry.camelot[mode]] = {
      musical: entry.key, // e.g. "C", "C♯/D♭"
      quality: mode === 1 ? "Major" : "Minor",
      open: entry.open[mode], // e.g. "10m"
      pitchClass,
      mode,
    };
  });
});

// Look up musical/open info for a Camelot code (or null).
export function camelotInfo(code) {
  return CAMELOT_INFO[code] || null;
}

// Compact musical label for a code, e.g. "C♯ Maj" (drops the enharmonic
// alternative so it fits on a wheel wedge or piano key).
export function musicalLabel(code) {
  const info = CAMELOT_INFO[code];
  if (!info) return "";
  const note = info.musical.split("/")[0];
  return `${note} ${info.quality === "Major" ? "Maj" : "Min"}`;
}

// Camelot code for a pitch class (0-11) and mode (0 minor, 1 major).
export function camelotForKey(pitchClass, mode) {
  return KeyMap[pitchClass] ? KeyMap[pitchClass].camelot[mode] : null;
}

function parse(code) {
  const m = CAMELOT_RE.exec(code || "");
  if (!m) return null;
  return { num: parseInt(m[1], 10), letter: m[2] };
}

// Set of codes that mix harmonically with `code` (includes `code` itself).
export function compatibleCamelot(code) {
  const p = parse(code);
  if (!p) return new Set();

  const up = (p.num % 12) + 1; // 12 wraps to 1
  const down = ((p.num + 10) % 12) + 1; // 1 wraps to 12
  const other = p.letter === "A" ? "B" : "A";

  return new Set([
    `${p.num}${p.letter}`, // same key
    `${up}${p.letter}`, // +1 (perfect fifth)
    `${down}${p.letter}`, // -1 (perfect fourth)
    `${p.num}${other}`, // relative major/minor
  ]);
}

// Camelot-wheel color for a code. Each number maps to a distinct hue around the
// wheel; minor (A) is rendered darker and major (B) lighter, mirroring how
// Mixed In Key / Rekordbox color keys. Returns { bg, text } for styling a chip.
export function camelotColor(code) {
  const p = parse(code);
  if (!p) return null;

  const hue = ((p.num - 1) * 30) % 360; // 12 keys evenly around the color wheel
  const lightness = p.letter === "B" ? 64 : 48;
  const bg = `hsl(${hue}, 68%, ${lightness}%)`;
  const text = lightness >= 58 ? "#1a1a1a" : "#ffffff";

  return { bg, text };
}

// Relationship of `code` to the currently anchored key, used to highlight rows.
// `isAnchor` distinguishes the clicked track from other tracks in the same key.
export function harmonicRelation(anchorCode, code, isAnchor) {
  if (!anchorCode) return "none";
  if (isAnchor) return "anchor";
  return compatibleCamelot(anchorCode).has(code) ? "compatible" : "incompatible";
}
