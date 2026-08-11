import {
  pickImages,
  imageWidth,
  indexSignature,
  clearArtworkIndexMemo,
  buildArtworkIndex,
  repairArtworkCacheDamage,
} from './artworkIndex';
import { idbGet, idbSet, idbGetAll, idbDelete } from './crateStore';

jest.mock('./crateStore', () => ({
  CRATE_STORE: 'crates',
  ARTWORK_STORE: 'artwork',
  idbGet: jest.fn(),
  idbSet: jest.fn(() => Promise.resolve()),
  idbGetAll: jest.fn(() => Promise.resolve(new Map())),
  idbDelete: jest.fn(() => Promise.resolve()),
}));

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

// --- caching behaviour: the reason opening the view was slow every time ---

const track = (id, albumId) => ({
  track: {
    id,
    type: 'track',
    is_local: false,
    name: `Track ${id}`,
    uri: `spotify:track:${id}`,
    artists: [{ id: `art_${albumId}`, name: 'Artist' }],
    album: {
      id: albumId,
      name: `Album ${albumId}`,
      release_date: '2024-01-01',
      images: [{ url: U640, width: 640 }, { url: U300, width: 300 }],
    },
  },
});

const makeApi = () => ({
  getPlaylistTracks: jest.fn(() =>
    Promise.resolve({ items: [track('t1', 'alb1')], next: null })
  ),
  getMySavedTracks: jest.fn(() =>
    Promise.resolve({ items: [], total: 0, next: null })
  ),
});
const passthru = (fn) => fn();

describe('buildArtworkIndex caching', () => {
  beforeEach(() => {
    clearArtworkIndexMemo();
    idbGet.mockReset();
    idbSet.mockReset();
    idbSet.mockResolvedValue(undefined);
  });

  it('writes a freshly fetched crate back to the cache', async () => {
    idbGet.mockResolvedValue(null); // nothing cached
    const api = makeApi();
    await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(api.getPlaylistTracks).toHaveBeenCalledTimes(1);
    // The write-back is what stops it re-fetching on every future open. It goes
    // to artwork's OWN namespace — writing `sp:` corrupted PLLibrary's cache.
    const write = idbSet.mock.calls.find((c) => c[0] === 'art:p1');
    expect(write).toBeTruthy();
    expect(write[1].__v).toBe('snapA');
    expect(write[1].data.items).toHaveLength(1);
  });

  it('does not hit the network when the crate is cached at the same snapshot', async () => {
    idbGet.mockResolvedValue({ __v: 'snapA', data: { items: [track('t1', 'alb1')] } });
    const api = makeApi();
    await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(api.getPlaylistTracks).not.toHaveBeenCalled();
  });

  it('refetches when the playlist was edited (snapshot changed)', async () => {
    idbGet.mockResolvedValue({ __v: 'OLD', data: { items: [track('t1', 'alb1')] } });
    const api = makeApi();
    await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'NEW' }],
      includeLiked: false,
    });
    expect(api.getPlaylistTracks).toHaveBeenCalledTimes(1);
  });

  it('reuses the session memo on reopen instead of rebuilding', async () => {
    idbGet.mockResolvedValue({ __v: 'snapA', data: { items: [track('t1', 'alb1')] } });
    const api = makeApi();
    const args = {
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    };
    const first = await buildArtworkIndex(args);
    idbGet.mockClear();
    const second = await buildArtworkIndex(args);
    expect(second).toBe(first); // same object, no work redone
    expect(idbGet).not.toHaveBeenCalled();
  });

  it('force rebuilds past the memo', async () => {
    idbGet.mockResolvedValue({ __v: 'snapA', data: { items: [track('t1', 'alb1')] } });
    const api = makeApi();
    const args = {
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    };
    await buildArtworkIndex(args);
    idbGet.mockClear();
    await buildArtworkIndex({ ...args, force: true });
    expect(idbGet).toHaveBeenCalled();
  });

  it('collapses tracks from the same album into one cover', async () => {
    idbGet.mockResolvedValue({
      __v: 'snapA',
      data: { items: [track('t1', 'alb1'), track('t2', 'alb1'), track('t3', 'alb2')] },
    });
    const res = await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    // Three tracks, two albums -> two tiles, not three. This is the whole point:
    // every track on an EP shares one cover, so per-track tiles were duplicates.
    expect(res.tiles).toHaveLength(2);
    expect(res.covers.size).toBe(2);
    const alb1 = res.tiles.find((t) => t.albumId === 'alb1');
    expect(alb1.trackCount).toBe(2);
    expect(alb1.trackNames).toEqual(['Track t1', 'Track t2']);
  });

  it('shows an album saved to several playlists only once globally', async () => {
    idbGet.mockImplementation(() =>
      Promise.resolve({ __v: 'snapA', data: { items: [track('t1', 'alb1')] } })
    );
    const res = await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [
        { id: 'p1', name: 'One', snapshot_id: 'snapA' },
        { id: 'p2', name: 'Two', snapshot_id: 'snapA' },
      ],
      includeLiked: false,
    });
    expect(res.tiles).toHaveLength(1);
    expect(res.tiles[0].playlistNames).toEqual(['One', 'Two']);
    // ...but each playlist view still lists it.
    expect(res.albums).toHaveLength(2);
    expect(res.albums[0].tiles).toHaveLength(1);
  });

  it('reports album counts, not track counts, per crate', async () => {
    idbGet.mockResolvedValue({
      __v: 'snapA',
      data: { items: [track('t1', 'alb1'), track('t2', 'alb1'), track('t3', 'alb2')] },
    });
    const res = await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(res.albums[0].uniqueCovers).toBe(2);
    expect(res.albums[0].trackCount).toBe(3);
  });

  it('skips episodes, local files and removed tracks', async () => {
    idbGet.mockResolvedValue({
      __v: 'snapA',
      data: {
        items: [
          track('t1', 'alb1'),
          { track: null },
          { track: { id: 'e1', type: 'episode', album: { id: 'x', images: [{ url: U640, width: 640 }] } } },
          { track: { id: 'l1', is_local: true, album: { id: 'y', images: [{ url: U640, width: 640 }] } } },
          { track: { id: 'n1', type: 'track', album: { id: 'z', images: [] } } },
        ],
      },
    });
    const res = await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(res.tiles).toHaveLength(1);
  });
});

describe('indexSignature', () => {
  it('changes when a playlist is edited', () => {
    const a = indexSignature([{ id: 'p1', snapshot_id: 'x' }], false);
    const b = indexSignature([{ id: 'p1', snapshot_id: 'y' }], false);
    expect(a).not.toBe(b);
  });

  it('changes when a playlist is added', () => {
    const a = indexSignature([{ id: 'p1', snapshot_id: 'x' }], false);
    const b = indexSignature(
      [{ id: 'p1', snapshot_id: 'x' }, { id: 'p2', snapshot_id: 'z' }],
      false
    );
    expect(a).not.toBe(b);
  });
});

// --- regression: Artwork Explorer must not corrupt PLLibrary's crate cache ---

describe('crate cache isolation', () => {
  beforeEach(() => {
    clearArtworkIndexMemo();
    idbGet.mockReset();
    idbSet.mockReset();
    idbSet.mockResolvedValue(undefined);
  });

  it('never writes to the sp: namespace PLLibrary owns', async () => {
    idbGet.mockResolvedValue(null);
    await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    const spWrites = idbSet.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].startsWith('sp:')
    );
    // Writing a featureless {items} into sp: crashed the Library on removed
    // tracks AND starved it of audio features (the snapshot matched, so it
    // reused our entry and never refetched).
    expect(spWrites).toHaveLength(0);
    expect(
      idbSet.mock.calls.some((c) => c[0] === 'art:p1')
    ).toBe(true);
  });

  it('strips removed tracks before they can reach any cache', async () => {
    idbGet.mockResolvedValue(null);
    const api = {
      getPlaylistTracks: jest.fn(() =>
        Promise.resolve({
          items: [track('t1', 'alb1'), { track: null }, { track: { id: null } }],
          next: null,
        })
      ),
      getMySavedTracks: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
    };
    await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    const write = idbSet.mock.calls.find((c) => c[0] === 'art:p1');
    expect(write[1].data.items).toHaveLength(1);
    // This is the exact expression that threw in PLLibrary.
    expect(() =>
      write[1].data.items.forEach((it) => it.track.id)
    ).not.toThrow();
  });

  it('still reads PLLibrary cache when it is warm', async () => {
    idbGet.mockImplementation((key) =>
      Promise.resolve(
        key === 'sp:p1'
          ? { __v: 'snapA', data: { items: [track('t1', 'alb1')], features: [] } }
          : null
      )
    );
    const api = makeApi();
    const res = await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(api.getPlaylistTracks).not.toHaveBeenCalled();
    expect(res.tiles).toHaveLength(1);
  });

  it('falls back to its own cache when PLLibrary has nothing', async () => {
    idbGet.mockImplementation((key) =>
      Promise.resolve(
        key === 'art:p1'
          ? { __v: 'snapA', data: { items: [track('t1', 'alb1')] } }
          : null
      )
    );
    const api = makeApi();
    await buildArtworkIndex({
      spotifyWebApi: api,
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(api.getPlaylistTracks).not.toHaveBeenCalled();
  });

  it('sanitizes a poisoned cache entry on read', async () => {
    idbGet.mockImplementation((key) =>
      Promise.resolve(
        key === 'sp:p1'
          ? {
              __v: 'snapA',
              data: { items: [track('t1', 'alb1'), { track: null }], features: [] },
            }
          : null
      )
    );
    const res = await buildArtworkIndex({
      spotifyWebApi: makeApi(),
      spotifyRetry: passthru,
      playlists: [{ id: 'p1', name: 'One', snapshot_id: 'snapA' }],
      includeLiked: false,
    });
    expect(res.tiles).toHaveLength(1);
  });
});

describe('repairArtworkCacheDamage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    idbGetAll.mockReset();
    idbDelete.mockReset();
    idbDelete.mockResolvedValue(undefined);
  });

  const good = { __v: 's', data: { items: [track('t1', 'a1')], features: [{ id: 't1' }] } };
  const noFeatures = { __v: 's', data: { items: [track('t1', 'a1')], features: [] } };
  const nullTrack = {
    __v: 's',
    data: { items: [track('t1', 'a1'), { track: null }], features: [{ id: 't1' }] },
  };

  it('deletes entries poisoned by the earlier build, keeps healthy ones', async () => {
    idbGetAll.mockResolvedValue(
      new Map([
        ['sp:good', good],
        ['sp:nofeat', noFeatures],
        ['sp:nulltrack', nullTrack],
      ])
    );
    const n = await repairArtworkCacheDamage();
    expect(n).toBe(2);
    const deleted = idbDelete.mock.calls[0][0];
    expect(deleted).toEqual(expect.arrayContaining(['sp:nofeat', 'sp:nulltrack']));
    expect(deleted).not.toContain('sp:good');
  });

  it('leaves non-sp keys alone', async () => {
    idbGetAll.mockResolvedValue(new Map([['art:p1', { __v: 's', data: { items: [] } }]]));
    expect(await repairArtworkCacheDamage()).toBe(0);
  });

  it('runs only once', async () => {
    idbGetAll.mockResolvedValue(new Map([['sp:nofeat', noFeatures]]));
    expect(await repairArtworkCacheDamage()).toBe(1);
    idbGetAll.mockClear();
    expect(await repairArtworkCacheDamage()).toBe(0);
    expect(idbGetAll).not.toHaveBeenCalled();
  });

  it('does not delete an empty crate (legitimately has no features)', async () => {
    idbGetAll.mockResolvedValue(
      new Map([['sp:empty', { __v: 's', data: { items: [], features: [] } }]])
    );
    expect(await repairArtworkCacheDamage()).toBe(0);
  });
});
