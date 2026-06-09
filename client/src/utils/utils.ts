type HashParams = {
  access_token: string,
  refresh_token: string,
  // Absolute epoch-ms timestamp at which access_token expires. Derived from
  // Spotify's expires_in (seconds) so the app can refresh proactively.
  expires_at?: number
}

export function getHashParams(provider: string = 'spotify', isProduction: boolean) {
  const hashParams = JSON.parse(window.localStorage.getItem(`${provider}_hash_params`) ?? '{}');
  if (Object.entries(hashParams).length !== 0 && hashParams.access_token && hashParams.refresh_token) {
    return hashParams;
  } else {
    if (provider == 'spotify') {
      let hashParams: HashParams = {
        access_token: '',
        refresh_token: ''
      }
      if (isProduction) {
        hashParams = getAndSetSpotifyHashParamsFromUrlProd();
      } else {
        hashParams = getAndSetSpotifyHashParamsFromUrlLocal();
      }

      window.localStorage.setItem('spotify_hash_params', JSON.stringify(hashParams));
      return hashParams;
    } else {
      return {};
    }
  }
}

// Persist refreshed Spotify credentials so they survive reloads and feed the
// next refresh cycle.
export function saveSpotifyHashParams(hashParams: HashParams) {
  window.localStorage.setItem('spotify_hash_params', JSON.stringify(hashParams));
}

function getAndSetSpotifyHashParamsFromUrlLocal() {
  let hashParams: any = {
    access_token: '',
    refresh_token: ''
  };
  // For use in local server
  let e: RegExpExecArray | null,
    r = /([^&;=]+)=?([^&;]*)/g,
    q = window.location.hash.substring(1);
  while ((e = r.exec(q))) {
    hashParams[e[1]] = decodeURIComponent(e[2]);
  }

  if (hashParams.expires_in) {
    hashParams.expires_at = Date.now() + Number(hashParams.expires_in) * 1000;
  }

  document.cookie = `access_token=${hashParams.access_token}`;
  document.cookie = `refresh_token=${hashParams.refresh_token}`;
  return hashParams;
}

function getAndSetSpotifyHashParamsFromUrlProd(): HashParams {
  var urlString = window.location.href;
  var url = new URL(urlString);
  var a_token = new URLSearchParams(url.search).get('access_token') ?? '';
  var r_token = new URLSearchParams(url.search).get('refresh_token') ?? '';
  var expires_in = new URLSearchParams(url.search).get('expires_in');

  document.cookie = `a_token=${a_token}`;
  document.cookie = `r_token=${r_token}`;
  return {
    access_token: a_token,
    refresh_token: r_token,
    expires_at: expires_in ? Date.now() + Number(expires_in) * 1000 : undefined,
  };
}
