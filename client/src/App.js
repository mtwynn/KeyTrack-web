import React from 'react';
import Axios from 'axios';
import './App.css';

import Spotify from 'spotify-web-api-js';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Toolbar,
  Typography,
} from '@material-ui/core';
import { ThemeProvider } from '@material-ui/core/styles';

import {
  Brightness4,
  Brightness7,
  Build,
  ExitToApp,
  GraphicEq,
  LibraryMusic,
  Menu as MenuIcon,
  MusicNote,
  QueueMusic,
  Receipt,
  SettingsApplications,
  Tune,
  VisibilityOff,
} from '@material-ui/icons';
import FadeIn from 'react-fade-in';

import changelog from './changelog.js';
import CurrentSong from './components/CurrentSong/CurrentSong';
import PLLibrary from './components/PLLibrary/PLLibrary';
import SetBuilder from './components/PLLibrary/SetBuilder';
import KeyCalculator from './utils/KeyCalculator';
import SpotifyPlayer from 'react-spotify-web-playback';
import SpotifyIcon from './components/SpotifyIcon';
import { makeAppTheme, THEME_STORAGE_KEY } from './theme';

// Utils
import { getHashParams, saveSpotifyHashParams } from './utils/utils';

const spotifyWebApi = new Spotify();

let isProduction = process.env.NODE_ENV === 'production';

let spotifyLoginEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/spotify/login'
  : 'http://127.0.0.1:8888/spotify/login';

let refreshTokenEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/refresh_token'
  : 'http://127.0.0.1:8888/refresh_token';

// Refresh the access token this many ms before it actually expires, so API
// calls never hit a window where the token is dead.
const REFRESH_LEAD_MS = 5 * 60 * 1000;

// Brand wordmark with the "Key" in Spotify green.
const Wordmark = ({ variant, style }) => (
  <Typography variant={variant} style={{ fontWeight: 800, ...style }}>
    <span style={{ color: '#1ED760' }}>Key</span>Track
  </Typography>
);

// Stable style objects so the player isn't handed new props every render.
const PLAYER_WRAP_STYLE = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100vw',
  zIndex: 9999,
};
const PLAYER_STYLES = {
  activeColor: '#1ED760',
  loaderColor: '#1ED760',
  sliderColor: '#1ED760',
};

// Memoized so the Spotify Web Playback player only re-renders (and never
// reconnects) when its own props change — not on every unrelated App re-render
// like opening a drawer or dialog.
const BottomPlayer = React.memo(({ token, uris, play }) => (
  <div style={PLAYER_WRAP_STYLE}>
    <SpotifyPlayer
      token={token}
      uris={uris}
      styles={PLAYER_STYLES}
      play={play}
      showSaveIcon={true}
      magnifySliderOnHover={true}
    />
  </div>
));

class App extends React.Component {
  constructor(props) {
    super(props);

    // TODO move this to different component lifecycle
    const spotifyParams = getHashParams('spotify', isProduction);

    this.state = {
      openChangelog: false,
      showKeyCalculator: false,
      drawerOpen: false,
      loadingPlaylists: false,
      showHiddenCrates: false,
      // App-level set so it spans playlists. Entries are { item, key }.
      set: [],
      setOpen: false,
      themeMode:
        window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
          ? 'dark'
          : 'light',
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
      player: {
        uris: [],
        isPlaying: false,
      },
    };

    this.getUserPlaylists = this.getUserPlaylists.bind(this);
    this.openKeyCalculator = this.openKeyCalculator.bind(this);
    this.toggleTheme = this.toggleTheme.bind(this);
    this.addToSet = this.addToSet.bind(this);
    this.removeFromSet = this.removeFromSet.bind(this);
    this.reorderSet = this.reorderSet.bind(this);
    this.clearSet = this.clearSet.bind(this);
    this.openSet = this.openSet.bind(this);
    this.loadSet = this.loadSet.bind(this);
    this.openHiddenCrates = this.openHiddenCrates.bind(this);
    this.exitHidden = this.exitHidden.bind(this);
    this.updatePlayer = this.updatePlayer.bind(this);
    this.refreshAccessToken = this.refreshAccessToken.bind(this);
    this.scheduleTokenRefresh = this.scheduleTokenRefresh.bind(this);

    if (spotifyParams.access_token) {
      spotifyWebApi.setAccessToken(spotifyParams.access_token);

      Axios.get(
        `https://api.spotify.com/v1/me?access_token=${spotifyParams.access_token}`
      )
        .then((user) => {
          this.setState({
            user_id: user.data.id,
            access_token: spotifyParams.access_token,
            user_name: user.data.display_name,
          });
        })
        // A stale token here is expected on reload; componentDidMount will
        // refresh it and re-bootstrap the user, so swallow the 401 quietly.
        .catch(() => {});
    } else {
      console.error(
        'Could not get a spotify access token. Received spotify params from server: ',
        spotifyParams
      );
    }
  }

  componentDidMount() {
    if (this.state.spotify.loggedIn) {
      this.scheduleTokenRefresh();
    }
  }

  componentWillUnmount() {
    clearTimeout(this.refreshTimer);
  }

  // Schedule a background token refresh shortly before the current token
  // expires. Re-arms itself after every refresh so the session stays alive
  // indefinitely without the user ever logging in again.
  scheduleTokenRefresh() {
    const params = getHashParams('spotify', isProduction);
    const expiresAt = params.expires_at;

    clearTimeout(this.refreshTimer);

    // No expiry recorded (e.g. a session from before this feature shipped) or
    // already within the lead window: refresh right now.
    if (!expiresAt || expiresAt - Date.now() <= REFRESH_LEAD_MS) {
      this.refreshAccessToken();
      return;
    }

    this.refreshTimer = setTimeout(
      this.refreshAccessToken,
      expiresAt - Date.now() - REFRESH_LEAD_MS
    );
  }

  // Exchange the stored refresh token for a fresh access token, update the
  // Spotify client, player, and persisted credentials, then reschedule.
  async refreshAccessToken() {
    const params = getHashParams('spotify', isProduction);
    if (!params.refresh_token) {
      return;
    }

    try {
      const { data } = await Axios.get(refreshTokenEndpoint, {
        params: { refresh_token: params.refresh_token },
      });

      const access_token = data.access_token;
      const expires_in = data.expires_in || 3600;
      const updated = {
        access_token,
        // Spotify may rotate the refresh token; keep the old one otherwise.
        refresh_token: data.refresh_token || params.refresh_token,
        expires_at: Date.now() + expires_in * 1000,
      };
      saveSpotifyHashParams(updated);

      spotifyWebApi.setAccessToken(access_token);
      this.setState({ access_token, showSessionExpiryDialog: false });

      // Ensure the user is bootstrapped — covers the case where the initial
      // load happened with an already-expired token.
      if (!this.state.user_id) {
        const user = await Axios.get('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        this.setState({
          user_id: user.data.id,
          user_name: user.data.display_name,
        });
      }

      this.scheduleTokenRefresh();
    } catch (error) {
      // The refresh token itself was rejected (e.g. revoked). This is the only
      // case where the user genuinely needs to log in again.
      console.error('Spotify token refresh failed', error);
      this.setState({ showSessionExpiryDialog: true });
    }
  }

  async getUserPlaylists() {
    // Toggle closed if already open.
    if (this.state.showPlaylists) {
      this.setState({ showPlaylists: false });
      return;
    }

    this.setState({ loadingPlaylists: true });
    try {
      let allPlaylists = [];
      let offset = 50;
      let response = await spotifyWebApi.getUserPlaylists(this.state.user_id, {
        limit: 50,
        offset: 0,
      });
      allPlaylists = response.items;

      let next = response.next;
      while (next !== null) {
        let nextGroup = await spotifyWebApi.getUserPlaylists(
          this.state.user_id,
          {
            limit: 50,
            offset: offset,
          }
        );
        allPlaylists = allPlaylists.concat(nextGroup.items);
        next = nextGroup.next;
        offset += 50;
      }

      this.setState({
        showPlaylists: true,
        showHiddenCrates: false,
        pllibrary: allPlaylists,
      });
    } catch (error) {
      console.error('Failed to load playlists', error);
    } finally {
      this.setState({ loadingPlaylists: false });
    }
  }

  openKeyCalculator() {
    this.setState({
      showKeyCalculator: !this.state.showKeyCalculator,
    });
  }

  // --- App-level set builder (spans playlists) ---
  addToSet(item, key) {
    this.setState((state) =>
      state.set.some((e) => e.item.track.id === item.track.id)
        ? null
        : { set: [...state.set, { item, key }] }
    );
  }

  removeFromSet(index) {
    this.setState((state) => ({
      set: state.set.filter((_, i) => i !== index),
    }));
  }

  reorderSet(from, to) {
    this.setState((state) => {
      if (to < 0 || to >= state.set.length) return null;
      const next = [...state.set];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { set: next };
    });
  }

  clearSet() {
    this.setState({ set: [] });
  }

  openSet() {
    this.setState({ setOpen: true });
  }

  // Replace the current set with a loaded saved set.
  loadSet(entries) {
    this.setState({ set: entries, setOpen: true });
  }

  // Open the library showing only hidden crates (reached from the menu).
  async openHiddenCrates() {
    this.setState({ drawerOpen: false });
    if (!this.state.showPlaylists) {
      await this.getUserPlaylists();
    }
    this.setState({ showHiddenCrates: true });
  }

  exitHidden() {
    this.setState({ showHiddenCrates: false });
  }

  toggleTheme() {
    const themeMode = this.state.themeMode === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    this.setState({ themeMode });
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
  }

  // A small feature callout used on the landing hero.
  renderHighlight(icon, label, sub) {
    return (
      <Grid item xs={4}>
        {icon}
        <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {sub}
        </Typography>
      </Grid>
    );
  }

  // An action tile in the logged-in dashboard.
  renderTile(icon, label, sub, onClick, active, always, loading) {
    return (
      <Grid item xs={12} sm={4}>
        <Card
          elevation={active ? 6 : 1}
          style={{
            height: '100%',
            border: active ? '2px solid #1ED760' : '2px solid transparent',
          }}
        >
          <CardActionArea
            onClick={onClick}
            disabled={loading}
            style={{ padding: '22px 12px', textAlign: 'center', height: '100%' }}
          >
            {loading ? (
              <CircularProgress size={40} style={{ color: '#1ED760' }} />
            ) : (
              icon
            )}
            <Typography
              variant="subtitle1"
              style={{ fontWeight: 700, marginTop: 6 }}
            >
              {loading ? 'Loading…' : label}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {sub}
            </Typography>
            {always && (
              <div>
                <Chip
                  size="small"
                  label="No login needed"
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
          </CardActionArea>
        </Card>
      </Grid>
    );
  }

  renderFooter(version) {
    return (
      <Box style={{ textAlign: 'center', padding: '20px 0' }}>
        <Typography variant="overline" color="textSecondary">
          Powered by Spotify · Made by Tam Nguyen · {version}
        </Typography>
        <div>
          <Button
            size="small"
            color="primary"
            startIcon={<Receipt />}
            onClick={() => this.setState({ openChangelog: true })}
          >
            Changelog
          </Button>
        </div>
      </Box>
    );
  }

  // Logged-out landing: hero with value prop, login CTA, and the always-on
  // Key Calculator.
  renderLanding(themeToggle, version) {
    const iconStyle = { fontSize: 30, color: '#1ED760' };
    return (
      <>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {themeToggle}
        </div>
        <FadeIn transitionDuration={800}>
          <Container maxWidth="sm">
            <Box
              style={{
                minHeight: '86vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 22,
              }}
            >
              <Wordmark variant="h2" style={{ letterSpacing: '-1px' }} />
              <Typography
                variant="h6"
                color="textSecondary"
                style={{ maxWidth: 360 }}
              >
                Find keys &amp; BPMs, mix in harmony, and build your sets.
              </Typography>

              <Grid
                container
                spacing={2}
                style={{ maxWidth: 420, margin: '4px 0' }}
              >
                {this.renderHighlight(
                  <GraphicEq style={iconStyle} />,
                  'Harmonic mixing',
                  'Camelot-wheel matches'
                )}
                {this.renderHighlight(
                  <MusicNote style={iconStyle} />,
                  'Key & BPM',
                  'Instant track analysis'
                )}
                {this.renderHighlight(
                  <LibraryMusic style={iconStyle} />,
                  'Crate analysis',
                  'Sort & filter playlists'
                )}
              </Grid>

              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<SpotifyIcon />}
                style={{ borderRadius: 28, padding: '10px 28px', fontWeight: 700 }}
                onClick={() => {
                  window.location.href = spotifyLoginEndpoint;
                }}
              >
                Log in with Spotify
              </Button>
              <Button
                variant="outlined"
                size="large"
                style={{ borderRadius: 28 }}
                onClick={this.openKeyCalculator}
              >
                Open Key Calculator
              </Button>
              <Typography variant="caption" color="textSecondary">
                No account needed for the Key Calculator
              </Typography>
            </Box>
            {this.renderFooter(version)}
          </Container>
        </FadeIn>
      </>
    );
  }

  // Logged-in dashboard: a minimal top bar (wordmark + hamburger) and the
  // primary action tiles. Secondary controls + Current Song live in the drawer.
  renderHome(version) {
    const tileIcon = { fontSize: 40, color: '#1ED760' };
    return (
      <>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Wordmark variant="h6" style={{ flexGrow: 1 }} />
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={() => this.setState({ drawerOpen: true })}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container
          maxWidth={false}
          style={{
            paddingTop: 24,
            paddingBottom: 130,
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          <Grid container spacing={2} justify="center">
            {this.renderTile(
              <LibraryMusic style={tileIcon} />,
              this.state.showPlaylists ? 'Close Library' : 'Playlist Library',
              'Analyze your crates',
              this.getUserPlaylists,
              this.state.showPlaylists,
              false,
              this.state.loadingPlaylists
            )}
            {this.renderTile(
              <Tune style={tileIcon} />,
              'Key Calculator',
              'Convert any key',
              this.openKeyCalculator,
              false,
              true
            )}
          </Grid>

          {this.state.showPlaylists && (
            <Box style={{ marginTop: 24 }}>
              <FadeIn transitionDuration={600}>
                <PLLibrary
                  token={this.state.access_token}
                  pllibrary={this.state.pllibrary}
                  userId={this.state.user_id}
                  updatePlayer={this.updatePlayer}
                  onAddToSet={this.addToSet}
                  onOpenSet={this.openSet}
                  setCount={this.state.set.length}
                  showHidden={this.state.showHiddenCrates}
                  onExitHidden={this.exitHidden}
                />
              </FadeIn>
            </Box>
          )}
        </Container>
      </>
    );
  }

  // Right-side slide-out (hamburger) drawer. Holds the compact Current Song
  // widget plus the secondary controls (theme, changelog, logout) that would
  // otherwise clutter the top bar. Same on desktop and mobile.
  renderDrawer(isDark, version) {
    const close = () => this.setState({ drawerOpen: false });
    return (
      <Drawer anchor="right" open={this.state.drawerOpen} onClose={close}>
        <Box
          role="presentation"
          style={{
            width: 300,
            maxWidth: '85vw',
            padding: 16,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Avatar style={{ backgroundColor: '#1ED760' }}>
              {this.state.user_name
                ? this.state.user_name.charAt(0).toUpperCase()
                : '?'}
            </Avatar>
            <div>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                {this.state.user_name || 'Spotify user'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Connected to Spotify
              </Typography>
            </div>
          </Box>

          <Divider />

          <Box style={{ padding: '14px 0' }}>
            <CurrentSong token={this.state.access_token} />
          </Box>

          <Divider />

          <List>
            <ListItem
              button
              onClick={() =>
                this.setState({ setOpen: true, drawerOpen: false })
              }
            >
              <ListItemIcon>
                <QueueMusic />
              </ListItemIcon>
              <ListItemText
                primary="Set Builder"
                secondary={
                  this.state.set.length
                    ? `${this.state.set.length} track${
                        this.state.set.length > 1 ? 's' : ''
                      }`
                    : 'empty'
                }
              />
            </ListItem>
            <ListItem button onClick={this.openHiddenCrates}>
              <ListItemIcon>
                <VisibilityOff />
              </ListItemIcon>
              <ListItemText primary="Hidden crates" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                {isDark ? <Brightness7 /> : <Brightness4 />}
              </ListItemIcon>
              <ListItemText primary="Dark mode" />
              <Switch
                edge="end"
                color="primary"
                checked={isDark}
                onChange={this.toggleTheme}
              />
            </ListItem>
            <ListItem
              button
              onClick={() =>
                this.setState({ openChangelog: true, drawerOpen: false })
              }
            >
              <ListItemIcon>
                <Receipt />
              </ListItemIcon>
              <ListItemText primary="Changelog" secondary={version} />
            </ListItem>
          </List>

          <Divider />

          <List>
            <ListItem button onClick={this.handleLogout.bind(this)}>
              <ListItemIcon>
                <ExitToApp />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItem>
          </List>

          <Box style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 12 }}>
            <Typography variant="caption" color="textSecondary">
              Powered by Spotify · Made by Tam Nguyen
            </Typography>
          </Box>
        </Box>
      </Drawer>
    );
  }

  render() {
    const theme = makeAppTheme(this.state.themeMode);
    const isDark = this.state.themeMode === 'dark';
    const loggedIn = this.state.spotify.loggedIn;
    const version = 'v' + changelog[0].version;

    const themeToggle = (
      <IconButton
        onClick={this.toggleTheme}
        color="inherit"
        title="Toggle dark mode"
        aria-label="toggle theme"
      >
        {isDark ? <Brightness7 /> : <Brightness4 />}
      </IconButton>
    );

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="App">
          {loggedIn ? (
            <>
              {this.renderHome(version)}
              {this.renderDrawer(isDark, version)}
            </>
          ) : (
            this.renderLanding(themeToggle, version)
          )}

          {this.state.showKeyCalculator && (
            <KeyCalculator
              open={this.state.showKeyCalculator}
              onClose={this.openKeyCalculator}
            />
          )}

          <Dialog
            fullWidth={true}
            maxWidth="md"
            open={this.state.openChangelog}
            onClose={this.handleCloseChangelog.bind(this)}
          >
            <DialogTitle>Changelog</DialogTitle>
            <DialogContent>
              {changelog.map((entry) => {
                return (
                  <DialogContentText key={entry.version} component="div">
                    <div>
                      <Typography variant="h6">v{entry.version}</Typography>
                      <Typography variant="button" color="textSecondary">
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
                color="primary"
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog maxWidth="md" open={this.state.showSessionExpiryDialog}>
            <DialogTitle>Oops!</DialogTitle>
            <DialogContent>
              We couldn't automatically refresh your Spotify session. Please log
              in again to continue.
            </DialogContent>
            <DialogActions>
              <Button onClick={this.handleLogout.bind(this)} variant="outlined">
                Logout
              </Button>
              <Button
                onClick={() => {
                  window.location.href = spotifyLoginEndpoint;
                }}
                color="primary"
                variant="contained"
              >
                Login
              </Button>
            </DialogActions>
          </Dialog>

          {/* App-level set builder, reachable from any crate or the drawer */}
          <SetBuilder
            open={this.state.setOpen}
            onClose={() => this.setState({ setOpen: false })}
            set={this.state.set}
            onReorder={this.reorderSet}
            onRemove={this.removeFromSet}
            onClear={this.clearSet}
            userId={this.state.user_id}
            onLoadSet={this.loadSet}
          />

          {/* Spotify Player - always visible at bottom */}
          {loggedIn && (
            <BottomPlayer
              token={this.state.access_token}
              uris={this.state.player.uris}
              play={this.state.player.isPlaying}
            />
          )}
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
