/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const spotify_client_id = process.env.SPOTIFY_ID; // Your client id
const spotify_client_secret = process.env.SPOTIFY_SECRET; // Your secret
const soundcloud_client_id = process.env.SOUNDCLOUD_ID;
const soundcloud_secret = process.env.SOUNDCLOUD_SECRET;

const isProduction = process.env.NODE_ENV === 'production';
const redirect_uri = isProduction
  ? 'https://key-track2.herokuapp.com/callback/'
  : 'http://localhost:8888/callback';

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
          refresh_token = body.refresh_token;

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
  } else {
    // Soundcloud flow
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
      const access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

app.get('/soundcloud/login', function (req, res) {
  const state = generateRandomString(16);

  // https://api.soundcloud.com/connect?client_id=iCyQg0vibTPEFK5kZNgdbWhvsZ8iV6Qx&redirect_uri=https://key-track.netlify.app/&response_type=code
  res.redirect(
    'https://api.soundcloud.com/connect?' +
      querystring.stringify({
        client_id: soundcloud_client_id,
        redirect_uri: 'https://key-track.netlify.app/',
        state: state,
        response_type: 'code',
      })
  );
});

console.log('Listening on 8888');
app.listen(process.env.PORT || 8888);

// . iCyQg0vibTPEFK5kZNgdbWhvsZ8iV6Qx
// . R9TSEyiI6agFeG6TujyCT6SAgj4F3SWr
//   https://key-track.netlify.app/
