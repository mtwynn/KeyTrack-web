import { analyzePixels, rgbToHsl, rgbToHex } from './artworkVibe';
import { quantizeEmbedding, cosineInt8 } from './artworkSemantic';

// Build SIZE x SIZE RGBA data from a per-pixel colour function.
const SIZE = 64;
const makeImage = (fn) => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * SIZE + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width: SIZE, height: SIZE };
};

describe('colour helpers', () => {
  it('converts rgb to hex', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(29, 215, 96)).toBe('#1dd760');
  });

  it('clamps out-of-range channels rather than emitting invalid hex', () => {
    expect(rgbToHex(-20, 300, 128)).toBe('#00ff80');
  });

  it('converts rgb to hsl', () => {
    expect(rgbToHsl(255, 0, 0).h).toBeCloseTo(0, 0);
    expect(rgbToHsl(0, 255, 0).h).toBeCloseTo(120, 0);
    expect(rgbToHsl(0, 0, 255).h).toBeCloseTo(240, 0);
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });
});

describe('analyzePixels', () => {
  it('tags a near-black cover as dark', () => {
    const res = analyzePixels(makeImage(() => [8, 8, 10]));
    expect(res.tags).toContain('dark');
    expect(res.brightness).toBeLessThan(60);
  });

  it('tags a white cover as bright', () => {
    const res = analyzePixels(makeImage(() => [245, 245, 245]));
    expect(res.tags).toContain('bright');
  });

  it('tags a flat grey cover as monochrome and minimal', () => {
    const res = analyzePixels(makeImage(() => [128, 128, 128]));
    expect(res.tags).toContain('monochrome');
    expect(res.tags).toContain('minimal');
    expect(res.edgeDensity).toBeLessThan(0.05);
  });

  it('detects a busy, high-contrast cover', () => {
    // Fine checkerboard: maximum local detail and luminance spread.
    const res = analyzePixels(
      makeImage((x, y) => ((x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255]))
    );
    expect(res.tags).toContain('busy');
    expect(res.tags).toContain('high-contrast');
  });

  it('separates warm from cool covers', () => {
    const warm = analyzePixels(makeImage(() => [230, 90, 20]));
    const cool = analyzePixels(makeImage(() => [20, 90, 230]));
    expect(warm.tags).toContain('warm');
    expect(cool.tags).toContain('cool');
  });

  it('returns a weighted palette sorted by coverage', () => {
    // Two-thirds red, one-third blue.
    const res = analyzePixels(
      makeImage((x) => (x < (SIZE * 2) / 3 ? [200, 20, 20] : [20, 20, 200]))
    );
    expect(res.palette.length).toBeGreaterThan(0);
    expect(res.palette[0].weight).toBeGreaterThanOrEqual(
      res.palette[res.palette.length - 1].weight
    );
    expect(res.dominantHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is deterministic — same pixels give the same palette', () => {
    const img = makeImage((x, y) => [x * 3, y * 3, 128]);
    const a = analyzePixels(img);
    const b = analyzePixels(img);
    expect(a.dominantHex).toBe(b.dominantHex);
    expect(a.tags).toEqual(b.tags);
  });

  it('stamps the analysis version so improvements invalidate the cache', () => {
    expect(analyzePixels(makeImage(() => [10, 10, 10])).v).toBe(1);
  });
});

describe('embedding quantization', () => {
  it('round-trips similarity: identical vectors score ~1', () => {
    const v = Array.from({ length: 64 }, (_, i) => Math.sin(i));
    const q = quantizeEmbedding(v);
    expect(cosineInt8(q, q)).toBeCloseTo(1, 1);
  });

  it('scores opposite vectors near -1', () => {
    const v = Array.from({ length: 64 }, (_, i) => Math.sin(i));
    const a = quantizeEmbedding(v);
    const b = quantizeEmbedding(v.map((x) => -x));
    expect(cosineInt8(a, b)).toBeLessThan(-0.8);
  });

  it('ranks a closer vector above a distant one', () => {
    const base = Array.from({ length: 64 }, (_, i) => Math.sin(i));
    const near = base.map((x, i) => x + (i % 7 === 0 ? 0.05 : 0));
    const far = Array.from({ length: 64 }, (_, i) => Math.cos(i * 3));
    const q = quantizeEmbedding(base);
    expect(cosineInt8(q, quantizeEmbedding(near))).toBeGreaterThan(
      cosineInt8(q, quantizeEmbedding(far))
    );
  });

  it('guards against mismatched or missing vectors', () => {
    expect(cosineInt8(null, null)).toBe(-1);
    expect(cosineInt8(new Int8Array(4), new Int8Array(8))).toBe(-1);
  });
});
