import { getHashParams, saveSpotifyHashParams } from './utils';

// Regression cover for the sign-in bug: a stale token in localStorage used to
// shadow the fresh credentials handed back on the OAuth return URL, so every
// Spotify call 401'd ("Missing/invalid/expired access token") even though the
// user had just signed in successfully — and signing in again never helped.
const setUrl = (href) => {
  delete window.location;
  window.location = new URL(href);
  window.history.replaceState = jest.fn();
};

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('getHashParams', () => {
  it('prefers fresh credentials on the return URL over a stale stored token', () => {
    saveSpotifyHashParams({
      access_token: 'STALE',
      refresh_token: 'STALE_REFRESH',
    });
    setUrl(
      'http://localhost:3000/#access_token=FRESH&refresh_token=FRESH_REFRESH&expires_in=3600'
    );

    expect(getHashParams('spotify', false).access_token).toBe('FRESH');
    // ...and the fresh pair replaces the stale one in storage.
    expect(
      JSON.parse(window.localStorage.getItem('spotify_hash_params')).access_token
    ).toBe('FRESH');
  });

  it('reads credentials from the query string too (deployed backend -> localhost)', () => {
    setUrl(
      'http://localhost:3000/?access_token=QFRESH&refresh_token=QREFRESH&expires_in=3600'
    );
    expect(getHashParams('spotify', false).access_token).toBe('QFRESH');
  });

  it('falls back to stored credentials when the URL has none', () => {
    saveSpotifyHashParams({ access_token: 'STORED', refresh_token: 'R' });
    setUrl('http://localhost:3000/');
    expect(getHashParams('spotify', false).access_token).toBe('STORED');
  });

  it('derives expires_at from expires_in so refresh can be scheduled', () => {
    setUrl(
      'http://localhost:3000/#access_token=A&refresh_token=B&expires_in=3600'
    );
    const { expires_at } = getHashParams('spotify', false);
    expect(expires_at).toBeGreaterThan(Date.now() + 3500 * 1000);
  });

  it('strips the consumed tokens from the URL but keeps SoundCloud params', () => {
    setUrl(
      'http://localhost:3000/#access_token=A&refresh_token=B&sc_access_token=SC'
    );
    getHashParams('spotify', false);

    const rewritten = window.history.replaceState.mock.calls[0][2];
    expect(rewritten).not.toContain('access_token=A');
    expect(rewritten).toContain('sc_access_token=SC');
  });

  it('returns empty credentials when there are none anywhere', () => {
    setUrl('http://localhost:3000/');
    expect(getHashParams('spotify', false).access_token).toBe('');
  });
});
