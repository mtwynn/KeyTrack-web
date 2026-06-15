// BPM octave/metric correction.
//
// Beat trackers reliably find the *period* but often pick the wrong octave
// (½, ⅔, etc.) of the true tempo — every error is a clean ratio. We resolve
// the octave using the track's SoundCloud genre tag: each genre sits in a
// known tempo band, so we fold the detected value into the octave that lands
// in that band. Conservative on purpose: if the raw value is already plausible
// for the genre, we leave it alone (the benchmark showed raw detection is
// already ~82% exact — don't break what's right).

// genre substring(s) → [minBPM, maxBPM]
const GENRE_BANDS = [
  [["drum & bass", "drum and bass", "dnb", "d&b", "neurofunk", "liquid funk"], [165, 185]],
  [["drumstep"], [160, 180]],
  [["hardstyle", "hardcore", "rawstyle", "frenchcore", "uptempo"], [145, 185]],
  [["dubstep", "riddim", "brostep", "tearout"], [135, 150]],
  [["future bass", "melodic bass", "melodic dubstep", "future", "melodic"], [140, 165]],
  [["trap", "phonk"], [140, 175]],
  [["psytrance"], [140, 150]],
  [["trance", "uplifting", "progressive trance"], [130, 145]],
  [["techno", "tech house", "tech-house", "minimal"], [122, 138]],
  [["garage", "ukg", "2-step", "speed garage"], [128, 142]],
  [["house", "deep house", "bass house", "progressive house", "electro house", "big room", "g-house", "future house"], [120, 132]],
  [["disco", "funk", "nu disco"], [110, 125]],
  [["hip hop", "hip-hop", "rap", "r&b", "rnb"], [80, 110]],
  // generic / wide → weak hint, rarely used
  [["dance", "edm", "electronic", "pop"], [100, 160]],
];

const FOLD_FACTORS = [1, 0.5, 2, 1.5, 2 / 3, 0.75, 4 / 3, 3, 1 / 3];

function genreBand(genre) {
  if (!genre) return null;
  const g = String(genre).toLowerCase();
  for (const [keys, band] of GENRE_BANDS) {
    if (keys.some((k) => g.includes(k))) return band;
  }
  return null;
}

// Fold `raw` BPM toward the genre's tempo band. Returns a rounded integer.
function octaveFold(raw, genre) {
  if (!raw || isNaN(raw)) return null;
  const band = genreBand(genre);
  if (!band) {
    // No usable genre hint: only nudge clearly-out-of-range values into a
    // broad perceptual window so we never report something absurd.
    let b = raw;
    while (b < 80) b *= 2;
    while (b > 185) b /= 2;
    return Math.round(b);
  }
  const [lo, hi] = band;
  // Already plausible for the genre → trust the detector, don't touch it.
  if (raw >= lo && raw <= hi) return Math.round(raw);
  // Otherwise pick the octave multiple that lands inside the band (closest to
  // its center). If none lands cleanly, leave the detected value as-is.
  const center = (lo + hi) / 2;
  let best = null;
  for (const f of FOLD_FACTORS) {
    const v = raw * f;
    if (v >= lo && v <= hi && (best === null || Math.abs(v - center) < Math.abs(best - center))) {
      best = v;
    }
  }
  return Math.round(best === null ? raw : best);
}

module.exports = { octaveFold, genreBand };
