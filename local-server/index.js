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

// Basic auth header for the SoundCloud token endpoint (client is confidential).
const soundcloudBasicAuth = () =>
  'Basic ' +
  Buffer.from(
    soundcloud_client_id + ':' + soundcloud_client_secret
  ).toString('base64');

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
    headers: { Authorization: soundcloudBasicAuth() },
    form: {
      grant_type: 'authorization_code',
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
    headers: { Authorization: soundcloudBasicAuth() },
    form: {
      grant_type: 'refresh_token',
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

console.log('Listening on 8888');
app.listen(process.env.PORT || 8888);
