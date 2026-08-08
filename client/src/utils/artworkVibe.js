// Tier 1 "vibe" analysis: pure colour/composition maths on the cover itself.
//
// Free, offline, and instant — no API, no model download, no key. It runs on a
// 64x64 downsample, which is plenty for palette and global statistics and keeps
// each cover at a few milliseconds. Spotify's image CDN sends
// `Access-Control-Allow-Origin: *`, so a crossOrigin="anonymous" image can be
// drawn to a canvas and read back without tainting it.
//
// This gives colour and mood (dark / neon / pastel / minimal ...). It cannot
// tell you an image contains a face or a desert — that's Tier 2 (artworkSemantic).

export const VIBE_ANALYSIS_VERSION = 1;

const SIZE = 64;

// --- colour space helpers -------------------------------------------------

export function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Standard RGB -> HSL. Hue in degrees, s/l in 0..1.
export function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
  else if (max === gg) h = ((bb - rr) / d + 2) * 60;
  else h = ((rr - gg) / d + 4) * 60;
  return { h, s, l };
}

// Perceived brightness (ITU-R BT.601). Closer to human perception than a plain
// RGB mean, which would call pure blue as bright as pure green.
function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// --- palette --------------------------------------------------------------

// k-means in RGB. k=5 with a fixed iteration cap: deterministic enough for a
// stable palette, cheap enough to run over a whole library.
function kmeansPalette(pixels, k = 5, iterations = 8) {
  const n = pixels.length / 4;
  if (!n) return [];

  // Deterministic seeding (evenly spaced samples) so the same cover always
  // yields the same palette — random seeding would make results flicker
  // between runs and break cached comparisons.
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i + 0.5) * (n / k)) * 4;
    centroids.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
  }

  const assign = new Uint8Array(n);
  for (let iter = 0; iter < iterations; iter++) {
    for (let p = 0; p < n; p++) {
      const r = pixels[p * 4];
      const g = pixels[p * 4 + 1];
      const b = pixels[p * 4 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dr = r - centroids[c][0];
        const dg = g - centroids[c][1];
        const db = b - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[p] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      const s = sums[assign[p]];
      s[0] += pixels[p * 4];
      s[1] += pixels[p * 4 + 1];
      s[2] += pixels[p * 4 + 2];
      s[3] += 1;
    }
    sums.forEach((s, i) => {
      if (s[3] > 0) centroids[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }

  const counts = new Array(centroids.length).fill(0);
  for (let p = 0; p < n; p++) counts[assign[p]] += 1;

  return centroids
    .map((c, i) => ({
      hex: rgbToHex(c[0], c[1], c[2]),
      rgb: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])],
      weight: counts[i] / n,
    }))
    .filter((c) => c.weight > 0.01)
    .sort((a, b) => b.weight - a.weight);
}

// --- vibe tags ------------------------------------------------------------

// Thresholds are tuned for album art specifically, which skews darker and more
// saturated than general photography.
function deriveTags(m) {
  const tags = [];

  if (m.brightness < 60) tags.push("dark");
  else if (m.brightness > 175) tags.push("bright");

  if (m.colorfulness < 12) tags.push("monochrome");
  else if (m.saturation > 0.55 && m.brightness > 110) tags.push("neon");
  else if (m.saturation < 0.25 && m.brightness > 150) tags.push("pastel");
  else if (m.saturation > 0.5) tags.push("vivid");
  else if (m.saturation < 0.2) tags.push("muted");

  if (m.contrast > 70) tags.push("high-contrast");
  else if (m.contrast < 28) tags.push("flat");

  if (m.edgeDensity < 0.12) tags.push("minimal");
  else if (m.edgeDensity > 0.38) tags.push("busy");

  if (m.warmth > 0.2) tags.push("warm");
  else if (m.warmth < -0.2) tags.push("cool");

  // Sepia: warm, desaturated and mid-dark all at once reads as vintage.
  if (m.warmth > 0.15 && m.saturation < 0.35 && m.brightness < 150) {
    tags.push("vintage");
  }
  if (m.brightness < 45 && m.contrast > 55) tags.push("moody");

  return tags;
}

/**
 * Analyze one already-decoded image.
 * @param {ImageData} imageData  SIZE x SIZE RGBA pixels
 */
export function analyzePixels(imageData) {
  const px = imageData.data;
  const n = px.length / 4;

  let sumL = 0;
  let sumSat = 0;
  let warm = 0;
  let cool = 0;
  const lumas = new Float32Array(n);

  for (let p = 0; p < n; p++) {
    const r = px[p * 4];
    const g = px[p * 4 + 1];
    const b = px[p * 4 + 2];
    const l = luma(r, g, b);
    lumas[p] = l;
    sumL += l;

    const { h, s } = rgbToHsl(r, g, b);
    sumSat += s;
    // Reds/oranges/yellows read warm; cyans/blues read cool. Greens/magentas
    // are deliberately neutral.
    if (h < 60 || h >= 330) warm += s;
    else if (h >= 170 && h < 270) cool += s;
  }

  const brightness = sumL / n;
  const saturation = sumSat / n;

  let variance = 0;
  for (let p = 0; p < n; p++) {
    const d = lumas[p] - brightness;
    variance += d * d;
  }
  const contrast = Math.sqrt(variance / n);

  // Hasler-Süsstrunk colourfulness — separates "genuinely colourful" from
  // "one saturated hue everywhere", which plain saturation cannot.
  let rgSum = 0;
  let ybSum = 0;
  let rgSq = 0;
  let ybSq = 0;
  for (let p = 0; p < n; p++) {
    const r = px[p * 4];
    const g = px[p * 4 + 1];
    const b = px[p * 4 + 2];
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg;
    ybSum += yb;
    rgSq += rg * rg;
    ybSq += yb * yb;
  }
  const rgMean = rgSum / n;
  const ybMean = ybSum / n;
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean * rgMean));
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean * ybMean));
  const colorfulness =
    Math.sqrt(rgStd * rgStd + ybStd * ybStd) +
    0.3 * Math.sqrt(rgMean * rgMean + ybMean * ybMean);

  // Edge density: how much detail/structure the cover carries — distinguishes a
  // minimal single-colour sleeve from a dense collage. Uses ADJACENT-pixel
  // differences rather than a central difference: sampling i-1 vs i+1 skips the
  // pixel between them, so any fine alternating pattern (the highest-frequency
  // detail there is) cancels to zero and reads as flat.
  let edges = 0;
  for (let y = 1; y < SIZE; y++) {
    for (let x = 1; x < SIZE; x++) {
      const i = y * SIZE + x;
      const gx = lumas[i] - lumas[i - 1];
      const gy = lumas[i] - lumas[i - SIZE];
      if (Math.sqrt(gx * gx + gy * gy) > 32) edges += 1;
    }
  }
  const edgeDensity = edges / ((SIZE - 1) * (SIZE - 1));

  const warmth = (warm - cool) / n / Math.max(0.05, saturation);
  const palette = kmeansPalette(px);
  const dominant = palette[0] || { hex: "#000000", rgb: [0, 0, 0] };
  const dominantHsl = rgbToHsl(dominant.rgb[0], dominant.rgb[1], dominant.rgb[2]);

  const metrics = {
    brightness,
    saturation,
    contrast,
    colorfulness,
    edgeDensity,
    warmth: Math.max(-1, Math.min(1, warmth)),
  };

  return {
    ...metrics,
    palette,
    dominantHex: dominant.hex,
    dominantHue: dominantHsl.h,
    tags: deriveTags(metrics),
    v: VIBE_ANALYSIS_VERSION,
  };
}

// Every vibe tag the UI can filter by, in display order.
export const ALL_VIBE_TAGS = [
  "dark",
  "moody",
  "bright",
  "neon",
  "vivid",
  "pastel",
  "muted",
  "monochrome",
  "high-contrast",
  "flat",
  "minimal",
  "busy",
  "warm",
  "cool",
  "vintage",
];

export const ANALYSIS_SIZE = SIZE;
