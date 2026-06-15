/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

// Load local dev credentials from local-server/.env if present. Resolve the
// path from __dirname so it works no matter which directory node is started
// from. On Heroku the real env vars are already set, so this is a no-op there.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const cors = require('cors');
const crypto = require('crypto'); // PKCE for SoundCloud OAuth 2.1
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const spotify_client_id = process.env.SPOTIFY_ID; // Your client id
const spotify_client_secret = process.env.SPOTIFY_SECRET; // Your secret

const soundcloud_client_id = process.env.SOUNDCLOUD_ID;
const soundcloud_client_secret = process.env.SOUNDCLOUD_SECRET;

const isProduction = process.env.NODE_ENV === 'production';
const redirect_uri = isProduction
  ? 'https://key-track2.herokuapp.com/callback/'
  // Spotify rejects http://localhost as an "Insecure" redirect URI; the
  // explicit loopback IP is required for local development.
  : 'http://127.0.0.1:8888/callback';

// SoundCloud uses its own callback path so it never collides with Spotify's
// /callback. Only ONE redirect URI can be registered on the SoundCloud app at
// a time, so we flip the registered value between these when deploying.
const soundcloud_redirect_uri = isProduction
  ? 'https://key-track2.herokuapp.com/soundcloud/callback'
  : 'http://127.0.0.1:8888/soundcloud/callback';

// Where to hand the tokens back to the frontend after the OAuth round-trip.
const frontend_return = isProduction
  ? 'https://key-track.netlify.app/?'
  : 'http://localhost:3000/#';

/**
 * Generates a random string containing numbers and letters,
 * acting as a random nonce for CSRF protection
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = function (length) {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const SPOTIFY_STATE_KEY = 'spotify_auth_state';

const app = express();

app
  .use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/spotify/login', function (req, res) {
  const state = generateRandomString(16);
  res.cookie(SPOTIFY_STATE_KEY, state);

  // your application requests authorization
  const scope =
    'user-read-private user-read-email user-library-read user-read-playback-state playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private streaming';

  console.log(spotify_client_id)
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: spotify_client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
        show_dialog: true,
      })
  );
});

app.get('/callback', function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  const code = req.query.code || null;
  const state = req.query.state || null;
  const spotifyStoredState = req.cookies
    ? req.cookies[SPOTIFY_STATE_KEY]
    : null;

  if (state === null || state !== spotifyStoredState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch',
        })
    );
  } else if (spotifyStoredState) {
    // Spotify Flow
    console.log('SPOTIFY FLOW');
    res.clearCookie(SPOTIFY_STATE_KEY);
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      },
      headers: {
        Authorization:
          'Basic ' +
          new Buffer(spotify_client_id + ':' + spotify_client_secret).toString(
            'base64'
          ),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        const access_token = body.access_token,
          refresh_token = body.refresh_token,
          expires_in = body.expires_in;

        const options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + access_token },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log(body);
        });

        const creds = {
          access_token: access_token,
          refresh_token: refresh_token,
        };

        res.cookie('creds', creds);

        res.redirect(
          302,
          (isProduction
            ? 'https://key-track.netlify.app/?'
            : 'http://localhost:3000/#') +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
              expires_in: expires_in,
            })
        );
      } else {
        res.redirect(
          '/#' +
            querystring.stringify({
              error: 'invalid_token',
            })
        );
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {
  // requesting access token from refresh token
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization:
        'Basic ' +
        new Buffer(spotify_client_id + ':' + spotify_client_secret).toString(
          'base64'
        ),
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      // Spotify returns a fresh access_token and expires_in (seconds). It may
      // also return a new refresh_token, which the client should persist.
      res.send({
        access_token: body.access_token,
        expires_in: body.expires_in,
        refresh_token: body.refresh_token,
      });
    } else {
      // Previously this branch was missing, so a failed refresh (e.g. revoked
      // token) would hang the request forever. Respond so the client can fall
      // back to a re-login prompt.
      res
        .status(response && response.statusCode ? response.statusCode : 500)
        .send({ error: 'could_not_refresh_token' });
    }
  });
});

// ---------------------------------------------------------------------------
// SoundCloud OAuth 2.1 (Authorization Code + PKCE)
//
// Unlike Spotify, SoundCloud requires PKCE: we generate a random code_verifier,
// send its SHA-256 challenge on /authorize, then send the verifier back on the
// token exchange. Access tokens last ~1h and refresh tokens are SINGLE-USE
// (each refresh returns a new one), so the client must persist the rotated
// refresh token every time. Token host is secure.soundcloud.com.
// ---------------------------------------------------------------------------
const SOUNDCLOUD_STATE_KEY = 'soundcloud_auth_state';
const SOUNDCLOUD_VERIFIER_KEY = 'soundcloud_code_verifier';
const SOUNDCLOUD_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';

const base64url = (buf) =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const generateCodeVerifier = () => base64url(crypto.randomBytes(64));
const codeChallengeFromVerifier = (verifier) =>
  base64url(crypto.createHash('sha256').update(verifier).digest());

// Headers for the SoundCloud token endpoint. For the authorization_code and
// refresh_token grants, SoundCloud expects client_id + client_secret in the
// request BODY (Basic auth is only for the client_credentials grant), so we
// just ask for a JSON response here.
const soundcloudTokenHeaders = { accept: 'application/json; charset=utf-8' };

app.get('/soundcloud/login', function (req, res) {
  const state = generateRandomString(16);
  const codeVerifier = generateCodeVerifier();
  res.cookie(SOUNDCLOUD_STATE_KEY, state);
  res.cookie(SOUNDCLOUD_VERIFIER_KEY, codeVerifier);

  res.redirect(
    'https://secure.soundcloud.com/authorize?' +
      querystring.stringify({
        client_id: soundcloud_client_id,
        redirect_uri: soundcloud_redirect_uri,
        response_type: 'code',
        code_challenge: codeChallengeFromVerifier(codeVerifier),
        code_challenge_method: 'S256',
        state: state,
      })
  );
});

app.get('/soundcloud/callback', function (req, res) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[SOUNDCLOUD_STATE_KEY] : null;
  const codeVerifier = req.cookies
    ? req.cookies[SOUNDCLOUD_VERIFIER_KEY]
    : null;

  if (state === null || state !== storedState) {
    return res.redirect(
      frontend_return + querystring.stringify({ error: 'sc_state_mismatch' })
    );
  }
  res.clearCookie(SOUNDCLOUD_STATE_KEY);
  res.clearCookie(SOUNDCLOUD_VERIFIER_KEY);

  const authOptions = {
    url: SOUNDCLOUD_TOKEN_URL,
    headers: soundcloudTokenHeaders,
    form: {
      grant_type: 'authorization_code',
      client_id: soundcloud_client_id,
      client_secret: soundcloud_client_secret,
      redirect_uri: soundcloud_redirect_uri,
      code_verifier: codeVerifier,
      code: code,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      res.redirect(
        302,
        frontend_return +
          querystring.stringify({
            sc_access_token: body.access_token,
            sc_refresh_token: body.refresh_token,
            sc_expires_in: body.expires_in,
          })
      );
    } else {
      console.error('SoundCloud token exchange failed', body);
      res.redirect(
        frontend_return +
          querystring.stringify({ error: 'sc_invalid_token' })
      );
    }
  });
});

app.get('/soundcloud/refresh_token', function (req, res) {
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: SOUNDCLOUD_TOKEN_URL,
    headers: soundcloudTokenHeaders,
    form: {
      grant_type: 'refresh_token',
      client_id: soundcloud_client_id,
      client_secret: soundcloud_client_secret,
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      // Refresh tokens are single-use — the client MUST persist the new one.
      res.send({
        access_token: body.access_token,
        expires_in: body.expires_in,
        refresh_token: body.refresh_token,
      });
    } else {
      res
        .status(response && response.statusCode ? response.statusCode : 500)
        .send({ error: 'could_not_refresh_soundcloud_token' });
    }
  });
});

// ---------------------------------------------------------------------------
// SoundCloud API proxy
//
// The frontend never calls api.soundcloud.com directly — it goes through here
// so the backend can attach the user's token (SoundCloud uses the unusual
// `Authorization: OAuth <token>` header, not Bearer), keep the secret server
// side, and add CORS. Pass the access token as an `access_token` query param
// or an `Authorization` header. ToS attribution (uploader + SoundCloud +
// permalink backlink) is the frontend's job when it renders this data.
// ---------------------------------------------------------------------------
const SC_API = 'https://api.soundcloud.com';

const scToken = (req) => {
  const h = req.headers.authorization;
  if (h && h.indexOf('OAuth ') === 0) return h.slice(6);
  if (h && h.indexOf('Bearer ') === 0) return h.slice(7);
  return req.query.access_token || null;
};

// Forward a GET to the SoundCloud API with the user's token + linked
// partitioning, and relay the JSON response (status + body) straight back.
const scApiGet = (res, token, path, query) => {
  request.get(
    {
      url: SC_API + path,
      qs: Object.assign({ linked_partitioning: 1, limit: 50 }, query || {}),
      headers: {
        Authorization: 'OAuth ' + token,
        accept: 'application/json; charset=utf-8',
      },
      json: true,
    },
    function (error, response, body) {
      if (error) {
        console.error('SoundCloud proxy error', path, error);
        return res.status(502).send({ error: 'soundcloud_proxy_error' });
      }
      res.status(response.statusCode).send(body);
    }
  );
};

// Wrap a proxy route so every one shares the same missing-token guard.
const scRoute = (build) => (req, res) => {
  const token = scToken(req);
  if (!token) return res.status(401).send({ error: 'missing_access_token' });
  build(req, res, token);
};

// The signed-in user + their crates (sets / liked tracks / reposts).
app.get('/soundcloud/me', scRoute((req, res, t) => scApiGet(res, t, '/me')));
app.get(
  '/soundcloud/me/playlists',
  scRoute((req, res, t) => scApiGet(res, t, '/me/playlists'))
);
app.get(
  '/soundcloud/me/likes/tracks',
  scRoute((req, res, t) => scApiGet(res, t, '/me/likes/tracks'))
);
app.get(
  '/soundcloud/me/reposts',
  scRoute((req, res, t) => scApiGet(res, t, '/me/reposts/tracks'))
);

// Tracks inside one playlist/set.
app.get(
  '/soundcloud/playlists/:urn/tracks',
  scRoute((req, res, t) =>
    scApiGet(res, t, '/playlists/' + req.params.urn + '/tracks')
  )
);

// Search tracks (q + SoundCloud's native bpm/genre/tag filters).
app.get(
  '/soundcloud/search',
  scRoute((req, res, t) => {
    const q = {};
    if (req.query.q) q.q = req.query.q;
    if (req.query.genres) q.genres = req.query.genres;
    if (req.query.tags) q.tags = req.query.tags;
    if (req.query.bpm_from) q['bpm[from]'] = req.query.bpm_from;
    if (req.query.bpm_to) q['bpm[to]'] = req.query.bpm_to;
    scApiGet(res, t, '/tracks', q);
  })
);

// Resolve a permalink / secret share link to its API resource.
app.get(
  '/soundcloud/resolve',
  scRoute((req, res, t) => scApiGet(res, t, '/resolve', { url: req.query.url }))
);

// Follow a `next_href` from a linked-partitioning response (pagination).
// Only api.soundcloud.com URLs are allowed.
app.get(
  '/soundcloud/next',
  scRoute((req, res, t) => {
    const href = req.query.href || '';
    if (href.indexOf(SC_API) !== 0) {
      return res.status(400).send({ error: 'invalid_next_href' });
    }
    request.get(
      {
        url: href,
        headers: {
          Authorization: 'OAuth ' + t,
          accept: 'application/json; charset=utf-8',
        },
        json: true,
      },
      function (error, response, body) {
        if (error) return res.status(502).send({ error: 'soundcloud_proxy_error' });
        res.status(response.statusCode).send(body);
      }
    );
  })
);

// ---------------------------------------------------------------------------
// SoundCloud key/BPM analysis
//
// SoundCloud has no audio-analysis API, so we compute it ourselves: resolve the
// track's stream URL, then hand it (with the user's token) to the analysis
// microservice, which downloads + decodes + runs keyfinder-cli + bpm-tools.
// The service is a separate container; in dev it runs on localhost:8899.
// ---------------------------------------------------------------------------
const ANALYSIS_SERVICE_URL =
  process.env.ANALYSIS_SERVICE_URL || 'http://127.0.0.1:8899';
// Shared secret so only this backend can call the (public) analysis service.
const ANALYSIS_SECRET = process.env.ANALYSIS_SECRET || '';
const LIKELY_SET_MS = 6 * 60 * 1000;

app.get(
  '/soundcloud/analyze',
  scRoute((req, res, token) => {
    const trackId = req.query.track_id || req.query.urn;
    const durationMs = req.query.duration ? Number(req.query.duration) : 0;
    const genre = req.query.genre || '';
    if (!trackId) return res.status(400).send({ error: 'track_id required' });
    // Skip likely DJ sets without touching the stream/quota.
    if (durationMs && durationMs > LIKELY_SET_MS) {
      return res.send({ isLikelySet: true });
    }
    // 1) resolve the playable stream URL
    request.get(
      {
        url: SC_API + '/tracks/' + encodeURIComponent(trackId) + '/streams',
        headers: { Authorization: 'OAuth ' + token, accept: 'application/json' },
        json: true,
      },
      function (err, r, streams) {
        if (err || !streams) {
          return res.status(502).send({ error: 'stream_lookup_failed' });
        }
        const audioUrl =
          streams.http_mp3_128_url || streams.hls_aac_160_url || null;
        if (!audioUrl) return res.status(422).send({ error: 'no_stream' });
        // 2) hand it to the analysis service
        request.post(
          {
            url: ANALYSIS_SERVICE_URL + '/analyze',
            headers: { 'x-analysis-secret': ANALYSIS_SECRET },
            json: {
              audioUrl,
              authHeader: 'OAuth ' + token,
              durationMs,
              genre,
            },
            timeout: 60000,
          },
          function (e2, r2, result) {
            if (e2 || !r2 || r2.statusCode !== 200) {
              console.error('analysis service error', e2 && e2.message, r2 && r2.statusCode);
              return res.status(502).send({ error: 'analysis_failed' });
            }
            res.send(result);
          }
        );
      }
    );
  })
);

console.log('Listening on 8888');
app.listen(process.env.PORT || 8888);
