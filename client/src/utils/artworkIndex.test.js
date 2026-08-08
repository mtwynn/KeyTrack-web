import { pickImages, imageWidth } from './artworkIndex';

// Spotify's real CDN path prefixes encode the size, which is our fallback when
// the width field comes back null.
const U640 = 'https://i.scdn.co/image/ab67616d0000b273abcdef';
const U300 = 'https://i.scdn.co/image/ab67616d00001e02abcdef';
const U64 = 'https://i.scdn.co/image/ab67616d00004851abcdef';

describe('imageWidth', () => {
  it('uses the width field when present', () => {
    expect(imageWidth({ url: U64, width: 640 })).toBe(640);
  });

  it('falls back to the CDN prefix when width is null', () => {
    expect(imageWidth({ url: U640, width: null })).toBe(640);
    expect(imageWidth({ url: U300, width: null })).toBe(300);
    expect(imageWidth({ url: U64, width: null })).toBe(64);
  });

  it('returns 0 for an unrecognisable image', () => {
    expect(imageWidth({ url: 'https://example.com/x.jpg' })).toBe(0);
    expect(imageWidth(null)).toBe(0);
  });
});

describe('pickImages', () => {
  const full = [
    { url: U640, width: 640, height: 640 },
    { url: U300, width: 300, height: 300 },
    { url: U64, width: 64, height: 64 },
  ];

  it('picks the largest for the lightbox and a mid size for the grid', () => {
    const out = pickImages(full);
    expect(out.url640).toBe(U640);
    expect(out.url300).toBe(U300);
    expect(out.url64).toBe(U64);
  });

  it('is order-independent', () => {
    const out = pickImages([full[2], full[0], full[1]]);
    expect(out.url640).toBe(U640);
    expect(out.url300).toBe(U300);
  });

  // The regression that made the lightbox tiny: with null widths every entry
  // compared equal, so the "largest" could end up being the 64px thumbnail.
  it('still resolves sizes when every width is null', () => {
    const out = pickImages(full.map((i) => ({ url: i.url, width: null })));
    expect(out.url640).toBe(U640);
    expect(out.url300).toBe(U300);
    expect(out.url64).toBe(U64);
  });

  it('never returns a smaller image than necessary for a size bucket', () => {
    // Only 640 and 64 exist — the 300 slot must take 64, not jump to 640,
    // but the 640 slot must never fall back to 64.
    const out = pickImages([full[0], full[2]]);
    expect(out.url640).toBe(U640);
    expect(out.url64).toBe(U64);
  });

  it('falls back to the only image available', () => {
    const out = pickImages([{ url: U640, width: 640 }]);
    expect(out.url640).toBe(U640);
    expect(out.url300).toBe(U640);
    expect(out.url64).toBe(U640);
  });

  it('returns null when there is no usable artwork', () => {
    expect(pickImages([])).toBeNull();
    expect(pickImages(null)).toBeNull();
    expect(pickImages([{ width: 640 }])).toBeNull();
  });
});
