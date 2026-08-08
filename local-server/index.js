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

// A frontend may ask (via ?return_to=<origin> on /spotify/login) to have the
// tokens handed back to itself instead of the default above. That is what lets
// a client running on localhost:3000 authenticate through the DEPLOYED backend:
// the OAuth round-trip still uses this server's own registered redirect URI, so
// nothing changes in the Spotify dashboard — only the final hop comes back to
// the dev machine. Credentials ride on that final redirect, so honouring an
// arbitrary origin would be an open redirect that leaks access tokens; the
// origin must match this allowlist exactly.
//
// The value is the separator each frontend expects its params on: the deployed
// Netlify build reads them from the query string, a CRA dev server from the
// hash. (The client tolerates either, but we still send the idiomatic one.)
const RETURN_TARGETS = {
  'https://key-track.netlify.app': '/?',
  'http://localhost:3000': '/#',
  'http://127.0.0.1:3000': '/#',
};

const SPOTIFY_RETURN_KEY = 'spotify_return_to';
const SOUNDCLOUD_RETURN_KEY = 'soundcloud_return_to';

// Normalise an untrusted ?return_to into a bare allowlisted origin, or null.
const validReturnOrigin = (raw) => {
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    return Object.prototype.hasOwnProperty.call(RETURN_TARGETS, origin)
      ? origin
      : null;
  } catch (e) {
    return null;
  }
};

// Re-validated on the way out too, so a tampered cookie can't redirect anywhere
// outside the allowlist.
const buildReturnTarget = (origin) => {
  const valid = validReturnOrigin(origin);
  return valid ? valid + RETURN_TARGETS[valid] : null;
};

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

// Unset credentials are not a silent condition: an empty client_id makes
// Spotify's /authorize reject the request, and an empty Basic header makes the
// token exchange fail with `invalid_client`. Both surface to the frontend as an
// opaque 401, so detect the misconfiguration up front and say so explicitly.
// The `.env.example` placeholders count as missing — copying the file without
// editing it is the common half-finished setup.
const isPlaceholder = (value) => !value || /^your_/.test(value);
const spotifyCredentialsMissing = () =>
  isPlaceholder(spotify_client_id) || isPlaceholder(spotify_client_secret);

const SPOTIFY_SETUP_HELP =
  'Spotify credentials are not configured. Copy local-server/.env.example to ' +
  'local-server/.env and set SPOTIFY_ID and SPOTIFY_SECRET from ' +
  'https://developer.spotify.com/dashboard, then restart this server. Also ' +
  'make sure ' +
  redirect_uri +
  ' is registered as a Redirect URI on that Spotify app.';

if (spotifyCredentialsMissing()) {
  console.warn('[keytrack] WARNING: ' + SPOTIFY_SETUP_HELP);
}

const app = express();

app
  .use(express.static(__dirname + '/public'))
  .use(cors())
  .use(express.json({ limit: '1mb' }))
  .use(cookieParser());

// express.json()'s default error path renders an HTML stack trace, which leaks
// absolute server paths. These are JSON APIs, so answer malformed bodies with
// JSON and nothing else.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).send({ error: 'invalid_json' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).send({ error: 'payload_too_large' });
  }
  return next(err);
});

app.get('/spotify/login', function (req, res) {
  if (spotifyCredentialsMissing()) {
    return res.status(500).send({ error: 'spotify_not_configured', error_description: SPOTIFY_SETUP_HELP });
  }

  const state = generateRandomString(16);
  res.cookie(SPOTIFY_STATE_KEY, state);

  // Remember where to hand the tokens back, so the callback can return them to
  // the origin that actually started the sign-in.
  const returnOrigin = validReturnOrigin(req.query.return_to);
  if (returnOrigin) {
    res.cookie(SPOTIFY_RETURN_KEY, returnOrigin);
  } else {
    res.clearCookie(SPOTIFY_RETURN_KEY);
  }

  // your application requests authorization
  const scope =
    'user-read-private user-read-email user-library-read user-read-playback-state playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private streaming';

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

  // Resolved up front so the failure branches can report back to the frontend
  // that started the sign-in, instead of dead-ending on the backend's own
  // origin where nothing is listening.
  const spotifyReturn =
    buildReturnTarget(req.cookies && req.cookies[SPOTIFY_RETURN_KEY]) ||
    frontend_return;

  if (state === null || state !== spotifyStoredState) {
    res.clearCookie(SPOTIFY_RETURN_KEY);
    res.redirect(
      spotifyReturn +
        querystring.stringify({
          error: 'state_mismatch',
        })
    );
  } else if (spotifyStoredState) {
    // Spotify Flow
    console.log('SPOTIFY FLOW');
    res.clearCookie(SPOTIFY_STATE_KEY);
    res.clearCookie(SPOTIFY_RETURN_KEY);
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
          spotifyReturn +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
              expires_in: expires_in,
            })
        );
      } else {
        res.redirect(
          spotifyReturn +
            querystring.stringify({
              error: 'invalid_token',
            })
        );
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {
  if (spotifyCredentialsMissing()) {
    return res.status(500).send({ error: 'spotify_not_configured', error_description: SPOTIFY_SETUP_HELP });
  }

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
      //
      // Forward Spotify's own error code. Per Spotify's 2026 policy, user
      // refresh tokens expire after six months; spending an expired one returns
      // `invalid_grant`. Passing that through (instead of masking it as a
      // generic error) lets the client distinguish a permanently dead token —
      // which it must DISCARD and re-auth — from a transient 5xx/network blip.
      res
        .status(response && response.statusCode ? response.statusCode : 500)
        .send({
          error: (body && body.error) || 'could_not_refresh_token',
          error_description: body && body.error_description,
        });
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

  // Same allowlisted hand-back as the Spotify flow, so a locally-run client can
  // connect SoundCloud through the deployed backend too.
  const returnOrigin = validReturnOrigin(req.query.return_to);
  if (returnOrigin) {
    res.cookie(SOUNDCLOUD_RETURN_KEY, returnOrigin);
  } else {
    res.clearCookie(SOUNDCLOUD_RETURN_KEY);
  }

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

  const scReturn =
    buildReturnTarget(req.cookies && req.cookies[SOUNDCLOUD_RETURN_KEY]) ||
    frontend_return;

  if (state === null || state !== storedState) {
    res.clearCookie(SOUNDCLOUD_RETURN_KEY);
    return res.redirect(
      scReturn + querystring.stringify({ error: 'sc_state_mismatch' })
    );
  }
  res.clearCookie(SOUNDCLOUD_STATE_KEY);
  res.clearCookie(SOUNDCLOUD_VERIFIER_KEY);
  res.clearCookie(SOUNDCLOUD_RETURN_KEY);

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
        scReturn +
          querystring.stringify({
            sc_access_token: body.access_token,
            sc_refresh_token: body.refresh_token,
            sc_expires_in: body.expires_in,
          })
      );
    } else {
      console.error('SoundCloud token exchange failed', body);
      res.redirect(
        scReturn + querystring.stringify({ error: 'sc_invalid_token' })
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
          return res.status(502).send({
            error: 'stream_lookup_failed',
            reason: (err && err.message) || 'no_response',
          });
        }
        // SoundCloud returns a JSON ERROR envelope (code/message/errors) on a
        // non-2xx — e.g. 403 for tracks not streamable via the API, 404 for
        // removed/region-locked tracks. Detect it instead of treating the
        // envelope as a (streamless) streams object and mislabeling no_stream.
        const scStatus = r && r.statusCode;
        if (
          (scStatus && scStatus >= 400) ||
          streams.errors ||
          streams.error ||
          streams.code != null
        ) {
          const scMessage = streams.message || streams.error || null;
          // 403/404 = SoundCloud won't stream this track to our API token at all
          // (monetized / "only available on SoundCloud" / removed). That's an
          // EXPECTED "can't analyze" outcome, not a server error — return 200
          // with an `unavailable` flag (so it doesn't spam the console with red
          // 502s and gets cached), reserving 502 for genuine/transient errors.
          if (scStatus === 403 || scStatus === 404) {
            return res.send({ unavailable: true, scStatus, scMessage });
          }
          console.error('sc streams error', scStatus, scMessage, 'track', trackId);
          return res.status(502).send({
            error: 'stream_lookup_failed',
            scStatus: scStatus || null,
            scMessage,
          });
        }
        // Prefer a progressive MP3 (a simple download); otherwise fall back to
        // ANY HLS variant the API exposes (mp3/aac/opus, or any other hls_*_url)
        // and let the analysis service decode the playlist with ffmpeg.
        // Previously we only checked http_mp3_128_url || hls_aac_160_url, so
        // HLS-only tracks (which usually expose hls_mp3_128_url) returned
        // no_stream — the bulk of the "couldn't analyze" failures.
        const progressive = streams.http_mp3_128_url || null;
        let hlsUrl = null;
        if (!progressive) {
          hlsUrl =
            streams.hls_mp3_128_url ||
            streams.hls_aac_160_url ||
            streams.hls_opus_64_url ||
            null;
          if (!hlsUrl) {
            const anyHls = Object.keys(streams).find(
              (k) => /^hls_.*url$/i.test(k) && streams[k]
            );
            if (anyHls) hlsUrl = streams[anyHls];
          }
        }
        // Last resort: a 30s preview clip. Some tracks expose only
        // preview_mp3_128_url to the API; analyze that and mark the result
        // preview-based (approximate) rather than giving up.
        const previewUrl =
          !progressive && !hlsUrl ? streams.preview_mp3_128_url || null : null;
        const audioUrl = progressive || hlsUrl || previewUrl;
        const isHls = !progressive && !!hlsUrl;
        const isPreview = !progressive && !hlsUrl && !!previewUrl;
        if (!audioUrl) {
          // No usable stream at all (not even a preview) — also an expected
          // "can't analyze" outcome, not an error. 200 + unavailable; `available`
          // lists the stream keys SoundCloud returned, for debugging.
          return res.send({
            unavailable: true,
            reason: 'no_stream',
            available: Object.keys(streams || {}),
          });
        }
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
              isHls,
            },
            timeout: 60000,
          },
          function (e2, r2, result) {
            if (e2 || !r2 || r2.statusCode !== 200) {
              // Pass the service's specific reason through so the UI/logs can
              // show WHY (download_failed / decode_failed / …), not just a
              // generic failure.
              const reason =
                (result && result.error) ||
                (e2 && e2.message) ||
                'analysis_failed';
              console.error('analysis service error', reason, r2 && r2.statusCode);
              return res.status(502).send({ error: 'analysis_failed', reason });
            }
            // Flag preview-derived results so the client can mark them approximate.
            res.send(
              isPreview && result && !result.error
                ? { ...result, preview: true }
                : result
            );
          }
        );
      }
    );
  })
);

// ---------------------------------------------------------------------------
// Artwork Explorer — Gemini vision tagging + text embeddings
//
// Tier 2 of the artwork "vibe" engine. Tier 1 (colour/mood maths) runs entirely
// in the browser for free; this adds what pixels alone can't give you: what the
// image is OF. Gemini returns structured tags/topics/style/mood plus a short
// description, and that description is then embedded so the client can do
// semantic free-text search ("dreamy pastel portrait") and find-similar.
//
// The API key lives HERE, never in the React bundle — anything shipped to the
// client is world-readable. Set GEMINI_API_KEY as a Heroku config var.
//
// Analysis is keyed by album on the client, so each unique cover is only ever
// sent once; repeat listens and duplicate tracks cost nothing.
// ---------------------------------------------------------------------------
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Auto-updating alias rather than a pinned version: Google retires specific
// versions for new API keys (2.5-flash-lite already 404s for accounts created
// after its cutoff), and a hard-coded model silently breaks the whole feature.
// The alias currently resolves to gemini-3.5-flash-lite.
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-flash-lite-latest';
const GEMINI_EMBED_MODEL = 'gemini-embedding-001';
// Matryoshka truncation: 768 dims keeps semantic quality while making the
// client-side vector store ~4x smaller than the 3072 default.
const EMBED_DIMS = 768;

// Gemini enforces requests-per-minute PER PROJECT PER MODEL, and the free tier
// is only 15/min (confirmed from a live 429: quotaValue 15 for
// gemini-3.5-flash-lite). Firing a batch in parallel blows straight through
// that, so every call goes through one global pacer. Raise GEMINI_RPM once
// billing is enabled — that's the single knob that makes a full library run
// take minutes instead of hours.
const GEMINI_RPM = Math.max(1, Number(process.env.GEMINI_RPM || 15));
// 5% headroom: the server's minute and Google's don't line up exactly, and
// landing right on the boundary is what produces sporadic 429s.
const GEMINI_MIN_GAP_MS = Math.ceil((60000 / GEMINI_RPM) * 1.05);

let geminiNextSlot = 0;
function geminiSlot() {
  const now = Date.now();
  const slot = Math.max(now, geminiNextSlot);
  geminiNextSlot = slot + GEMINI_MIN_GAP_MS;
  const wait = slot - now;
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

// Heroku kills a request at 30s, so the batch must fit inside that INCLUDING
// the pacing gaps. With calls overlapping, the pacer's spacing is the dominant
// cost, so size the batch against it and keep a hard cap: smaller requests mean
// less work lost if one fails, and progress persists more often.
const MAX_BATCH = Math.max(
  1,
  Math.min(8, Math.floor(24000 / GEMINI_MIN_GAP_MS))
);

const VISION_PROMPT = [
  'You are cataloguing album cover artwork for a musician building a visual',
  'reference library. Describe ONLY what is visible in the image.',
  'Return strict JSON. Be specific and concrete: prefer "neon-lit rainy street"',
  'over "cool image". Do not mention the album, artist, or any text you cannot',
  'clearly read.',
].join(' ');

// Structured output — guarantees parseable JSON instead of prose we'd have to
// regex, and keeps the tag vocabulary consistent across the whole library.
const VISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING' },
    subjects: { type: 'ARRAY', items: { type: 'STRING' } },
    topics: { type: 'ARRAY', items: { type: 'STRING' } },
    style: { type: 'ARRAY', items: { type: 'STRING' } },
    mood: { type: 'ARRAY', items: { type: 'STRING' } },
    hasFace: { type: 'BOOLEAN' },
    hasText: { type: 'BOOLEAN' },
    medium: { type: 'STRING' },
  },
  required: ['description', 'subjects', 'topics', 'style', 'mood', 'medium'],
};

const geminiConfigured = () => !!GEMINI_KEY;
const GEMINI_HELP =
  'Gemini is not configured. Set GEMINI_API_KEY (from https://aistudio.google.com/apikey) ' +
  'on this server and restart. Artwork Explorer still works without it — colour/mood ' +
  'analysis runs in the browser — but semantic tags and search are disabled.';

if (!geminiConfigured()) {
  console.warn('[keytrack] NOTE: ' + GEMINI_HELP);
}

async function geminiJson(url, payload) {
  await geminiSlot();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((body && body.error && body.error.message) || 'gemini_error');
    err.status = res.status;
    err.body = body;
    // Gemini reports exactly how long to wait in a RetryInfo detail. Honouring
    // it beats guessing at a backoff, and lets the client show a real countdown
    // instead of failing the run.
    const details = (body && body.error && body.error.details) || [];
    const retryInfo = details.find(
      (d) => d && d['@type'] && d['@type'].includes('RetryInfo')
    );
    if (retryInfo && retryInfo.retryDelay) {
      err.retryAfterSec = Math.ceil(parseFloat(retryInfo.retryDelay)) || 30;
    }
    const quota = details.find(
      (d) => d && d['@type'] && d['@type'].includes('QuotaFailure')
    );
    if (quota && quota.violations && quota.violations[0]) {
      err.quotaValue = Number(quota.violations[0].quotaValue) || null;
    }
    throw err;
  }
  return body;
}

// Fetch the cover and inline it as base64. Only Spotify's CDN is allowed —
// otherwise this endpoint would be an open proxy that fetches arbitrary URLs
// on our behalf (SSRF).
const ALLOWED_IMAGE_HOSTS = /(^|\.)(scdn\.co|spotifycdn\.com)$/;

async function fetchImageBase64(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.test(parsed.hostname)) {
    throw new Error('image_host_not_allowed');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('image_fetch_failed');
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    mime: res.headers.get('content-type') || 'image/jpeg',
    data: buf.toString('base64'),
  };
}

async function analyzeOneImage(url) {
  const img = await fetchImageBase64(url);
  const payload = {
    contents: [
      {
        parts: [
          { text: VISION_PROMPT },
          { inline_data: { mime_type: img.mime, data: img.data } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: VISION_SCHEMA,
      temperature: 0.1,
    },
  };

  // Gemini intermittently answers a perfectly valid JPEG with 503 "Unable to
  // process input image". It's transient — the identical request succeeds on a
  // retry — so treating the first failure as permanent would leave random holes
  // in the library. 429 is NOT retried here: that's quota, and the caller stops
  // the whole run instead of hammering.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await geminiJson(
        `${GEMINI_BASE}/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_KEY}`,
        payload
      );
      const parts =
        (body &&
          body.candidates &&
          body.candidates[0] &&
          body.candidates[0].content &&
          body.candidates[0].content.parts) ||
        [];
      // Thinking-capable models can return reasoning parts alongside the
      // answer, so take the first part that actually carries text, not [0].
      const part = parts.find((p) => p && typeof p.text === 'string' && p.text.trim());
      if (!part) throw new Error('gemini_empty_response');
      return JSON.parse(part.text);
    } catch (e) {
      lastErr = e;
      // Never retry a 429 here — quota is not transient, and each extra call
      // pushes the reset window further out. Bubble it up so the caller pauses.
      const retryable = e.status !== 429 && (!e.status || e.status >= 500);
      if (!retryable || attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw lastErr;
}

// POST { images: [{ albumId, url }] } -> { results: [{ albumId, ok, ...tags }] }
// Per-image failures are reported inline rather than failing the batch, so one
// bad cover never wastes the whole request.
app.post('/artwork/analyze', async (req, res) => {
  if (!geminiConfigured()) {
    return res.status(503).send({ error: 'gemini_not_configured', error_description: GEMINI_HELP });
  }
  const images = Array.isArray(req.body && req.body.images) ? req.body.images : [];
  if (!images.length) return res.status(400).send({ error: 'images_required' });
  if (images.length > MAX_BATCH) {
    return res.status(400).send({ error: 'batch_too_large', max: MAX_BATCH });
  }

  // The pacer enforces the RPM quota, so overlapping calls only fills the gap
  // left by Gemini's own ~1-2s latency — without it a batch runs at the speed
  // of one request at a time (~50/min) no matter how high the quota is.
  // Bounded so a burst can't outrun the pacer's queue.
  const CONCURRENCY = Math.min(4, images.length);
  const results = new Array(images.length);
  let retryAfterSec = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < images.length) {
      const idx = cursor++;
      const img = images[idx];
      if (!img || !img.albumId || !img.url) {
        results[idx] = { albumId: img && img.albumId, ok: false, error: 'bad_request' };
        continue;
      }
      // Once quota is hit, stop immediately — every further call is a
      // guaranteed 429 that only pushes the reset further out.
      if (retryAfterSec) {
        results[idx] = { albumId: img.albumId, ok: false, error: 'rate_limited', status: 429 };
        continue;
      }
      try {
        const data = await analyzeOneImage(img.url);
        results[idx] = { albumId: img.albumId, ok: true, ...data };
      } catch (e) {
        if (e.status === 429) retryAfterSec = Math.max(retryAfterSec, e.retryAfterSec || 30);
        results[idx] = {
          albumId: img.albumId,
          ok: false,
          error: e.message || 'analyze_failed',
          status: e.status,
        };
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  res.send({
    results,
    rateLimited: retryAfterSec > 0,
    retryAfterSec,
  });
});

// POST { texts: [...] } -> { embeddings: [[...]] }
// Embeds Gemini's descriptions so the client can rank by meaning.
app.post('/artwork/embed', async (req, res) => {
  if (!geminiConfigured()) {
    return res.status(503).send({ error: 'gemini_not_configured', error_description: GEMINI_HELP });
  }
  const texts = Array.isArray(req.body && req.body.texts) ? req.body.texts : [];
  if (!texts.length) return res.status(400).send({ error: 'texts_required' });
  if (texts.length > 100) return res.status(400).send({ error: 'batch_too_large', max: 100 });

  try {
    const body = await geminiJson(
      `${GEMINI_BASE}/${GEMINI_EMBED_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
      {
        requests: texts.map((t) => ({
          model: `models/${GEMINI_EMBED_MODEL}`,
          content: { parts: [{ text: String(t).slice(0, 4000) }] },
          outputDimensionality: EMBED_DIMS,
        })),
      }
    );
    res.send({
      embeddings: (body.embeddings || []).map((e) => e.values || []),
      dims: EMBED_DIMS,
    });
  } catch (e) {
    res
      .status(e.status || 500)
      .send({ error: e.message || 'embed_failed' });
  }
});

// Lets the client show semantic features as available/unavailable without
// having to fire a real request and interpret the failure.
app.get('/artwork/status', (req, res) => {
  res.send({
    semanticAvailable: geminiConfigured(),
    visionModel: GEMINI_VISION_MODEL,
    // The client sizes its batches from these so it never sends more than one
    // request can pace through inside Heroku's 30s limit.
    maxBatch: MAX_BATCH,
    rpm: GEMINI_RPM,
  });
});

console.log('Listening on 8888');
app.listen(process.env.PORT || 8888);
