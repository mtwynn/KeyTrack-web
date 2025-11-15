import Axios from 'axios';

type HashParams = {
  access_token: string,
  refresh_token: string
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
    console.log(e[1])
    console.log(decodeURIComponent(e[2]));
    hashParams[e[1]] = decodeURIComponent(e[2]);
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

  document.cookie = `a_token=${a_token}`;
  document.cookie = `r_token=${r_token}`;
  return { access_token: a_token, refresh_token: r_token };
}

async function getAndSetSoundcloudHashParamsFromUrl(): Promise<HashParams> {
  const hashParams: HashParams = {
    access_token: '',
    refresh_token: ''
  }
  const urlString = window.location.href;
  const url = new URL(urlString);
  const code = new URLSearchParams(url.search).get('code') ?? '';

  const postData = {
    grant_type: 'authorization_code',
    client_id: 'iCyQg0vibTPEFK5kZNgdbWhvsZ8iV6Qx',
    client_secret: 'R9TSEyiI6agFeG6TujyCT6SAgj4F3SWr',
    code: code,
    redirect_uri: 'https://key-track.netlify.app/',
    refresh_token: ''
  };

  return await Axios.post('https://api.soundcloud.com/oauth2/token',
    new URLSearchParams(postData),
    {
      headers: {
        'Accept': 'application/json; charset=utf-8',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
    .then(response => {
      hashParams.access_token = response.data.access_token;
      hashParams.refresh_token = response.data.refresh_token;

      window.localStorage.setItem('soundcloud_hash_params', JSON.stringify(hashParams));

      return hashParams;
    })
    .catch(error => {
      console.error(error);
      return { access_token: '', refresh_token: '' };
    });
}
