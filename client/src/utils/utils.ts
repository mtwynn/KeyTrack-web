type HashParams = {
  access_token: string,
  refresh_token: string,
  // Absolute epoch-ms timestamp at which access_token expires. Derived from
  // Spotify's expires_in (seconds) so the app can refresh proactively.
  expires_at?: number
}

// Spotify hands the tokens back on the OAuth return URL. Strip them once
// they've been consumed so (a) a later reload falls through to the refreshed
// token in storage instead of replaying the original sign-in token, and
// (b) credentials don't linger in the address bar / browser history. Only the
// Spotify keys are removed — the SoundCloud `sc_*` params travel on the same
// URL and are read straight after this by getSoundcloudParams().
const SPOTIFY_URL_KEYS = ['access_token', 'refresh_token', 'expires_in'];

// The deployed frontend receives the params on the query string and a local dev
// server receives them on the hash, but a locally-run client pointed at the
// deployed backend is a mix of the two. Reading (and clearing) BOTH removes the
// coupling to NODE_ENV entirely, so the tokens are always picked up wherever
// the backend happens to put them.
function readUrlParam(url: URL, key: string): string {
  return (
    url.searchParams.get(key) ??
    new URLSearchParams(url.hash.replace(/^#/, '')).get(key) ??
    ''
  );
}

function clearSpotifyTokensFromUrl() {
  const url = new URL(window.location.href);
  SPOTIFY_URL_KEYS.forEach((key) => url.searchParams.delete(key));

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  SPOTIFY_URL_KEYS.forEach((key) => hash.delete(key));
  const remaining = hash.toString();
  url.hash = remaining ? `#${remaining}` : '';

  window.history.replaceState({}, document.title, url.toString());
}

function getSpotifyParamsFromUrl(): HashParams {
  const url = new URL(window.location.href);
  const expires_in = readUrlParam(url, 'expires_in');
  return {
    access_token: readUrlParam(url, 'access_token'),
    refresh_token: readUrlParam(url, 'refresh_token'),
    expires_at: expires_in
      ? Date.now() + Number(expires_in) * 1000
      : undefined,
  };
}

export function getHashParams(provider: string = 'spotify', isProduction?: boolean) {
  if (provider !== 'spotify') {
    return {};
  }

  // Credentials on the return URL mean the user JUST completed sign-in, so they
  // must win over anything already in localStorage. Reading storage first (the
  // previous behaviour) let an expired stored token shadow the fresh one, so
  // every Spotify call 401'd — including the Web Playback SDK's check_scope —
  // even though the sign-in itself had succeeded, and signing in again could
  // never recover because the stale token kept winning.
  const fromUrl = getSpotifyParamsFromUrl();

  if (fromUrl.access_token && fromUrl.refresh_token) {
    window.localStorage.setItem('spotify_hash_params', JSON.stringify(fromUrl));
    clearSpotifyTokensFromUrl();
    return fromUrl;
  }

  const stored = JSON.parse(
    window.localStorage.getItem('spotify_hash_params') ?? '{}'
  );
  if (stored.access_token && stored.refresh_token) {
    return stored;
  }

  return { access_token: '', refresh_token: '' };
}

// Persist refreshed Spotify credentials so they survive reloads and feed the
// next refresh cycle.
export function saveSpotifyHashParams(hashParams: HashParams) {
  window.localStorage.setItem('spotify_hash_params', JSON.stringify(hashParams));
}

// --- SoundCloud ---
// The backend hands SoundCloud tokens back as sc_* params (prefixed so they
// never collide with Spotify's). Mirror the Spotify plumbing: prefer stored
// creds, otherwise pick them up off the return URL and persist them.
export function getSoundcloudParams(isProduction?: boolean): HashParams {
  const stored = JSON.parse(
    window.localStorage.getItem('soundcloud_hash_params') ?? '{}'
  );
  if (stored.access_token && stored.refresh_token) {
    return stored;
  }
  const url = new URL(window.location.href);
  const access_token = readUrlParam(url, 'sc_access_token');
  const refresh_token = readUrlParam(url, 'sc_refresh_token');
  const expires_in = readUrlParam(url, 'sc_expires_in');
  const params: HashParams = {
    access_token,
    refresh_token,
    expires_at: expires_in
      ? Date.now() + Number(expires_in) * 1000
      : undefined,
  };
  if (access_token && refresh_token) {
    window.localStorage.setItem(
      'soundcloud_hash_params',
      JSON.stringify(params)
    );
  }
  return params;
}

// Persist refreshed SoundCloud creds (refresh tokens are single-use, so the
// rotated one must be saved every refresh).
export function saveSoundcloudParams(params: HashParams) {
  window.localStorage.setItem('soundcloud_hash_params', JSON.stringify(params));
}

export function clearSoundcloudParams() {
  window.localStorage.removeItem('soundcloud_hash_params');
}
