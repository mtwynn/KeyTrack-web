import React from 'react';
import Axios from 'axios';
import './App.css';

import Spotify from 'spotify-web-api-js';
import {
  Button,
  Chip,
  Grid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  withStyles,
} from '@material-ui/core';

import { Build, Receipt, SettingsApplications } from '@material-ui/icons';
import FadeIn from 'react-fade-in';

import changelog from './changelog.js';
import CurrentSong from './components/CurrentSong/CurrentSong';
import PLLibrary from './components/PLLibrary/PLLibrary';
import KeyCalculator from './utils/KeyCalculator';
import SpotifyPlayer from 'react-spotify-web-playback';

// Utils
import { getHashParams } from './utils/utils';

// Assets
import { ReactComponent as SpotifyLogo } from '../src/assets/login/spotify.svg';
import { ReactComponent as SoundcloudLogo } from '../src/assets/login/soundcloud.svg';

const spotifyWebApi = new Spotify();

let isProduction = process.env.NODE_ENV === 'production';

let spotifyLoginEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/spotify/login'
  : 'http://localhost:8888/spotify/login';

let soundcloudLoginEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/soundcloud/login'
  : 'http://localhost:8888/soundcloud/login';

class App extends React.Component {
  constructor(props) {
    super(props);

    // TODO move this to different component lifecycle
    const spotifyParams = getHashParams('spotify', isProduction);
    const soundcloudParams = getHashParams('soundcloud', isProduction);

    this.state = {
      openChangelog: false,
      showKeyCalculator: false,
      spotify: {
        loggedIn: spotifyParams.access_token ? true : false,
        nowPlaying: {
          name: 'Nothing currently playing',
          image: null,
        },
        user_id: '',
        access_token: '',
        user_name: '',
        showPlaylists: false,
        pllibrary: null,
        showSessionExpiryDialog: false,
      },
      soundcloud: {
        loggedIn: soundcloudParams.access_token ? true : false,
      },
      player: {
        uris: [],
        isPlaying: false,
      },
    };

    this.getUserPlaylists = this.getUserPlaylists.bind(this);
    this.openKeyCalculator = this.openKeyCalculator.bind(this);
    this.updatePlayer = this.updatePlayer.bind(this);

    if (spotifyParams.access_token) {
      spotifyWebApi.setAccessToken(spotifyParams.access_token);

      Axios.get(
        `https://api.spotify.com/v1/me?access_token=${spotifyParams.access_token}`
      ).then((user) => {
        this.setState({
          user_id: user.data.id,
          access_token: spotifyParams.access_token,
          user_name: user.data.display_name,
        });
      });
    } else {
      console.error(
        'Could not get a spotify access token. Received spotify params from server: ',
        spotifyParams
      );
    }

    // TODO: Move all the Axios.get calls to a utils function for API endpoints
    if (soundcloudParams.access_token) {
      Axios.get('https://api.soundcloud.com/me', {
        headers: {
          Accept: 'application/json; charset=utf-8',
          Authorization: `OAuth ${soundcloudParams.access_token}`,
        },
      })
        .then((response) => {
          // TODO: Do something with this response
          console.log(response);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }

  componentDidMount() {
    if (this.state.spotify.loggedIn) {
      setTimeout(() => {
        this.setState({
          showSessionExpiryDialog: true,
        });
      }, 3600 * 1000);
    }
  }

  async getUserPlaylists() {
    let allPlaylists = [];
    let offset = 50;
    let response = await spotifyWebApi.getUserPlaylists(this.state.user_id, {
      limit: 50,
      offset: 0,
    });
    allPlaylists = response.items;

    let next = response.next;
    while (next !== null) {
      let nextGroup = await spotifyWebApi.getUserPlaylists(this.state.user_id, {
        limit: 50,
        offset: offset,
      });
      allPlaylists = allPlaylists.concat(nextGroup.items);
      next = nextGroup.next;
      offset += 50;
    }

    this.setState({
      showPlaylists: !this.state.showPlaylists,
      pllibrary: allPlaylists,
    });
  }

  openKeyCalculator() {
    this.setState({
      showKeyCalculator: !this.state.showKeyCalculator,
    });
  }

  updatePlayer(uris, isPlaying) {
    this.setState({
      player: {
        uris: uris,
        isPlaying: isPlaying,
      },
    });
  }

  handleCloseChangelog() {
    this.setState({
      openChangelog: false,
    });
  }

  handleCloseSessionExpiryDialog() {
    this.setState({
      showSessionExpiryDialog: false,
    });
  }

  handleLogout() {
    this.setState({
      spotify: {
        loggedIn: false,
        nowPlaying: {
          name: 'Nothing currently playing',
          image: null,
        },
        user_id: '',
        access_token: '',
        user_name: '',
        showPlaylists: false,
        pllibrary: null,
      },
      showKeyCalculator: false,
    });

    window.location.href = window.location.origin;
    localStorage.removeItem('spotify_hash_params');
    localStorage.removeItem('soundcloud_hash_params');
  }

  render() {
    return (
      <div className='App m-div'>
        <FadeIn transitionDuration={1000}>
          <div className='login'>
            {this.state.spotify.loggedIn ? (
              <SpotifyLogo
                className='logo-spotify'
                onClick={this.handleLogout.bind(this)}
              />
            ) : (
              <SpotifyLogo
                className='logo'
                onClick={() => {
                  if (!this.state.spotify.loggedIn) {
                    window.location.href = spotifyLoginEndpoint;
                  }
                }}
              />
            )}

            {this.state.soundcloud.loggedIn ? (
              <SoundcloudLogo
                className='logo-soundcloud'
                onClick={this.handleLogout.bind(this)}
              />
            ) : (
              <SoundcloudLogo
                className='logo'
                onClick={() => {
                  if (!this.state.soundcloud.loggedIn) {
                    window.location.href = soundcloudLoginEndpoint;
                  }
                }}
              />
            )}
          </div>

          <Grid container spacing={2}>
            <Grid item xs={this.state.showPlaylists ? 4 : 12}>
              <div className='current-song m-div'>
                <CurrentSong token={this.state.access_token} />
              </div>
              <div className='m-div'>
                <Button
                  variant='contained'
                  onClick={this.getUserPlaylists}
                  disabled={!this.state.spotify.loggedIn}
                >
                  {this.state.showPlaylists
                    ? 'Close Playlist Library'
                    : 'Open Playlist Library'}
                </Button>
              </div>

              <div className='m-div'>
                <Button variant='contained' onClick={this.openKeyCalculator}>
                  Key Calculator
                </Button>
              </div>
            </Grid>

            {this.state.showPlaylists ? (
              <Grid item xs={8}>
                <FadeIn transitionDuration={1000}>
                  <PLLibrary
                    token={this.state.access_token}
                    pllibrary={this.state.pllibrary}
                    userId={this.state.user_id}
                    updatePlayer={this.updatePlayer}
                  />
                </FadeIn>
              </Grid>
            ) : null}
          </Grid>
          {this.state.showKeyCalculator ? (
            <FadeIn transitionDuration={1000}>
              <KeyCalculator
                open={this.state.showKeyCalculator}
                onClose={this.openKeyCalculator}
              />
            </FadeIn>
          ) : null}
          <div className='m-div'>
            <Typography variant='overline'>Powered by Spotify</Typography>
          </div>
          <div className='m-div'>
            <Typography variant='caption'>Made by Tam Nguyen</Typography>
          </div>
          {this.state.showPlaylists && (
            <>
              <Chip
                label={'v' + changelog[0].version}
                className='version-label'
              />

              <Chip
                className='changelog'
                style={{ padding: '0.3rem' }}
                icon={<Receipt />}
                label='Changelog'
                onClick={() => {
                  this.setState({
                    openChangelog: true,
                  });
                }}
              />
            </>
          )}
        </FadeIn>

        {!this.state.showPlaylists && (
          <>
            <Chip
              label={'v' + changelog[0].version}
              className='version-label'
            />

            <Chip
              className='changelog'
              style={{ padding: '0.3rem' }}
              icon={<Receipt />}
              label='Changelog'
              onClick={() => {
                this.setState({
                  openChangelog: true,
                });
              }}
            />
          </>
        )}
        <Dialog
          fullWidth={true}
          maxWidth='md'
          open={this.state.openChangelog}
          onClose={this.handleCloseChangelog.bind(this)}
        >
          <DialogTitle>Changelog</DialogTitle>
          <DialogContent>
            {changelog.map((entry) => {
              return (
                <DialogContentText key={entry.version}>
                  <div>
                    <Typography className='changelog-entry-header' variant='h6'>
                      v{entry.version}
                    </Typography>
                    <Typography
                      className='changelog-entry-header'
                      variant='button'
                    >
                      {entry.date}
                    </Typography>
                  </div>
                  <List dense={true}>
                    {entry.changes.map((element, idx) => {
                      return (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            {element.type === 'bugfix' ? (
                              <Build />
                            ) : (
                              <SettingsApplications />
                            )}
                          </ListItemIcon>
                          <ListItemText primary={element.desc} />
                        </ListItem>
                      );
                    })}
                  </List>
                </DialogContentText>
              );
            })}
          </DialogContent>

          <DialogActions>
            <Button
              onClick={this.handleCloseChangelog.bind(this)}
              color='primary'
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog maxWidth='md' open={this.state.showSessionExpiryDialog}>
          <DialogTitle>Oops!</DialogTitle>
          <DialogContent>
            Your Spotify session has expired. You can refresh your session for
            another hour by logging in again.
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleLogout.bind(this)} variant='outlined'>
              Logout
            </Button>
            <Button
              onClick={() => {
                window.location.href = spotifyLoginEndpoint;
              }}
              style={{
                backgroundColor: '#1ED760',
              }}
              color='primary'
              variant='contained'
            >
              Login
            </Button>
          </DialogActions>
        </Dialog>

        {/* Spotify Player - always visible at bottom */}
        {this.state.spotify.loggedIn && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100vw', zIndex: 9999 }}>
            <SpotifyPlayer
              token={this.state.access_token}
              uris={this.state.player.uris}
              styles={{
                activeColor: '#1ED760',
                loaderColor: '#1ED760',
                sliderColor: '#1ED760',
              }}
              play={this.state.player.isPlaying}
              showSaveIcon={true}
              magnifySliderOnHover={true}
            />
          </div>
        )}
      </div>
    );
  }
}

export default App;
