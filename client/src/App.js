import React from 'react';
import Axios from 'axios';
import './App.css';

import Spotify from 'spotify-web-api-js';
import {
  AppBar,
  Avatar,
  Badge,
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
  Hidden,
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
  ListSubheader,
  Paper,
  Switch,
  Toolbar,
  Typography,
} from '@material-ui/core';
import { ThemeProvider } from '@material-ui/core/styles';

import {
  Brightness4,
  Brightness7,
  Build,
  Close,
  Cloud,
  ExitToApp,
  GraphicEq,
  LibraryMusic,
  Menu as MenuIcon,
  MusicNote,
  QueueMusic,
  Receipt,
  SettingsApplications,
  Star,
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
import { scWidgetSrc } from './utils/soundcloudCrates';
import { makeAppTheme, THEME_STORAGE_KEY } from './theme';

// Utils
import {
  getHashParams,
  saveSpotifyHashParams,
  getSoundcloudParams,
  saveSoundcloudParams,
  clearSoundcloudParams,
} from './utils/utils';

const spotifyWebApi = new Spotify();

let isProduction = process.env.NODE_ENV === 'production';

let spotifyLoginEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/spotify/login'
  : 'http://127.0.0.1:8888/spotify/login';

let refreshTokenEndpoint = isProduction
  ? 'https://key-track2.herokuapp.com/refresh_token'
  : 'http://127.0.0.1:8888/refresh_token';

// Backend base for the SoundCloud OAuth + proxy routes.
let soundcloudBackend = isProduction
  ? 'https://key-track2.herokuapp.com'
  : 'http://127.0.0.1:8888';
let soundcloudLoginEndpoint = soundcloudBackend + '/soundcloud/login';

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

// SoundCloud playback reuses the same bottom player-bar slot: the sanctioned
// SoundCloud Widget (iframe), keyed by track so it reloads + autoplays when the
// track changes. Shown instead of the Spotify player while a SC track is active
// (one source plays at a time).
const ScBottomPlayer = React.memo(({ track, onClose }) => (
  <div style={PLAYER_WRAP_STYLE}>
    <div style={{ position: 'relative', backgroundColor: '#111', lineHeight: 0 }}>
      <iframe
        key={track.urn || track.id}
        title="SoundCloud player"
        width="100%"
        height="120"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={scWidgetSrc(track)}
      />
      <IconButton
        size="small"
        onClick={onClose}
        title="Close SoundCloud player"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <Close fontSize="small" />
      </IconButton>
    </div>
  </div>
));

class App extends React.Component {
  constructor(props) {
    super(props);

    // TODO move this to different component lifecycle
    const spotifyParams = getHashParams('spotify', isProduction);
    const soundcloudParams = getSoundcloudParams(isProduction);

    this.state = {
      openChangelog: false,
      showKeyCalculator: false,
      drawerOpen: false,
      navDrawerOpen: false,
      loadingPlaylists: false,
      showHiddenCrates: false,
      // Library view filter driven by the "Favorites" sidebar item.
      favoritesOnly: false,
      // KeyTrack setting: hide likely DJ sets/mixes (>~6min) from SoundCloud
      // crate views. Persisted; default off.
      disableScSets:
        window.localStorage.getItem('keytrack_disable_sc_sets') === 'true',
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
      // The SoundCloud track currently in the bottom player bar (null = the
      // Spotify player owns the bar instead). One source plays at a time.
      scNowPlaying: null,
      // SoundCloud connection (separate source; tokens managed like Spotify's).
      soundcloud: {
        connected: !!soundcloudParams.access_token,
        access_token: soundcloudParams.access_token || '',
        refresh_token: soundcloudParams.refresh_token || '',
        expires_at: soundcloudParams.expires_at || null,
      },
    };

    this.connectSoundcloud = this.connectSoundcloud.bind(this);
    this.disconnectSoundcloud = this.disconnectSoundcloud.bind(this);
    this.refreshSoundcloudToken = this.refreshSoundcloudToken.bind(this);
    this.scheduleSoundcloudRefresh = this.scheduleSoundcloudRefresh.bind(this);
    this.toggleDisableScSets = this.toggleDisableScSets.bind(this);
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
    this.openLibrary = this.openLibrary.bind(this);
    this.openFavorites = this.openFavorites.bind(this);
    this.updatePlayer = this.updatePlayer.bind(this);
    this.playSoundcloudTrack = this.playSoundcloudTrack.bind(this);
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
    // SoundCloud access tokens expire (~1h) and its refresh tokens are
    // single-use, so keep the session alive proactively instead of waiting for
    // a 401 (by which point a parallel-request 401 storm can burn the token).
    if (this.state.soundcloud.connected) {
      this.scheduleSoundcloudRefresh();
    }
  }

  componentWillUnmount() {
    clearTimeout(this.refreshTimer);
    clearTimeout(this.scRefreshTimer);
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
        favoritesOnly: false,
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
    if (!this.state.pllibrary) {
      await this.getUserPlaylists();
    }
    this.setState({
      showHiddenCrates: true,
      favoritesOnly: false,
    });
  }

  exitHidden() {
    this.setState({ showHiddenCrates: false });
  }

  // --- SoundCloud connection ---
  // Kick off the OAuth round-trip. Because SoundCloud allows a single redirect
  // URI (registered to the backend), the handshake goes through the backend and
  // returns here with sc_* params, which getSoundcloudParams() picks up on load.
  connectSoundcloud() {
    window.location.href = soundcloudLoginEndpoint;
  }

  disconnectSoundcloud() {
    clearTimeout(this.scRefreshTimer);
    clearSoundcloudParams();
    this.setState({
      soundcloud: {
        connected: false,
        access_token: '',
        refresh_token: '',
        expires_at: null,
      },
    });
  }

  // Schedule a background SoundCloud token refresh shortly before the current
  // token expires, re-arming after each refresh so the session stays alive
  // without the user reconnecting (mirrors scheduleTokenRefresh for Spotify).
  // Reads from localStorage rather than state so it sees the freshly-saved
  // token right after a refresh, before setState has flushed.
  scheduleSoundcloudRefresh() {
    const params = getSoundcloudParams(isProduction);
    clearTimeout(this.scRefreshTimer);
    if (!params.refresh_token) return; // nothing to refresh with

    const expiresAt = params.expires_at;
    // No expiry recorded (older session) or already within the lead window:
    // refresh right now.
    if (!expiresAt || expiresAt - Date.now() <= REFRESH_LEAD_MS) {
      this.refreshSoundcloudToken();
      return;
    }
    this.scRefreshTimer = setTimeout(
      this.refreshSoundcloudToken,
      expiresAt - Date.now() - REFRESH_LEAD_MS
    );
  }

  // Exchange the (single-use) refresh token for a fresh access token, persist
  // the rotated refresh token, and return the new access token (or null).
  //
  // Single-flight: SoundCloud refresh tokens rotate — spending one invalidates
  // the previous, and reusing a spent token can invalidate the whole token
  // family (forcing a reconnect). The library load fires several requests in
  // parallel, so an expired access token makes them all 401 at once; without
  // this guard each would POST the SAME single-use refresh token and all but
  // one would fail. Concurrent callers share one in-flight refresh instead.
  refreshSoundcloudToken() {
    if (this.scRefreshPromise) return this.scRefreshPromise;
    this.scRefreshPromise = this.doRefreshSoundcloudToken().finally(() => {
      this.scRefreshPromise = null;
    });
    return this.scRefreshPromise;
  }

  async doRefreshSoundcloudToken() {
    const { refresh_token } = this.state.soundcloud;
    if (!refresh_token) return null;
    try {
      const res = await Axios.get(
        soundcloudBackend +
          '/soundcloud/refresh_token?refresh_token=' +
          encodeURIComponent(refresh_token)
      );
      const next = {
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token || refresh_token,
        expires_at: res.data.expires_in
          ? Date.now() + Number(res.data.expires_in) * 1000
          : null,
      };
      saveSoundcloudParams(next);
      this.setState({ soundcloud: { connected: true, ...next } });
      this.scheduleSoundcloudRefresh(); // re-arm before the new token expires
      return next.access_token;
    } catch (e) {
      console.error('SoundCloud token refresh failed', e);
      return null;
    }
  }

  // KeyTrack setting: hide likely DJ sets/mixes from SoundCloud crate views.
  toggleDisableScSets() {
    this.setState((s) => {
      const next = !s.disableScSets;
      window.localStorage.setItem(
        'keytrack_disable_sc_sets',
        next ? 'true' : 'false'
      );
      return { disableScSets: next };
    });
  }

  // Sidebar "Library": always lands on the full crate list (loading on first
  // open). Unlike the old toggle tile, navigating here never closes the view.
  async openLibrary() {
    this.setState({ drawerOpen: false });
    if (!this.state.pllibrary) {
      await this.getUserPlaylists();
    }
    this.setState({
      showPlaylists: true,
      favoritesOnly: false,
      showHiddenCrates: false,
    });
  }

  // Sidebar "Favorites": the library scoped to favorited crates.
  async openFavorites() {
    this.setState({ drawerOpen: false });
    if (!this.state.pllibrary) {
      await this.getUserPlaylists();
    }
    this.setState({
      showPlaylists: true,
      favoritesOnly: true,
      showHiddenCrates: false,
    });
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
      // Playing a Spotify track hands the bottom bar back to the Spotify player.
      scNowPlaying: null,
    });
  }

  // Play a SoundCloud track in the shared bottom bar (swaps out the Spotify
  // player, which stops it — one source at a time). Also mark Spotify paused so
  // closing the SC player returns to a paused Spotify bar, not an auto-resume.
  playSoundcloudTrack(track) {
    this.setState((s) => ({
      scNowPlaying: track,
      player: { ...s.player, isPlaying: false },
    }));
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

  // Logged-in dashboard: a top bar (wordmark left + quick actions right) and a
  // left sidebar that navigates between Library, Key Calculator, Sets,
  // Favorites and Hidden crates. Account/Current Song still live in the drawer.
  renderHome(version) {
    const userInitial = this.state.user_name
      ? this.state.user_name.charAt(0).toUpperCase()
      : '?';

    const navItems = [
      {
        key: 'library',
        icon: <LibraryMusic />,
        label: 'Library',
        onClick: this.openLibrary,
        active:
          this.state.showPlaylists &&
          !this.state.favoritesOnly &&
          !this.state.showHiddenCrates,
      },
      {
        key: 'keycalc',
        icon: <Tune />,
        label: 'Key Calculator',
        onClick: this.openKeyCalculator,
        active: this.state.showKeyCalculator,
      },
      {
        key: 'sets',
        icon: <QueueMusic />,
        label: 'Sets',
        onClick: this.openSet,
        badge: this.state.set.length || null,
      },
      {
        key: 'favorites',
        icon: <Star />,
        label: 'Favorites',
        onClick: this.openFavorites,
        active: this.state.showPlaylists && this.state.favoritesOnly,
      },
      {
        key: 'hidden',
        icon: <VisibilityOff />,
        label: 'Hidden crates',
        onClick: this.openHiddenCrates,
        active: this.state.showHiddenCrates,
      },
    ];

    // Shared between the persistent desktop sidebar and the mobile nav drawer.
    // `afterClick` lets the mobile drawer close itself once an item is tapped.
    const renderNavList = (afterClick) => (
      <List component="nav" style={{ padding: 4 }}>
        {navItems.map((it) => (
          <ListItem
            button
            key={it.key}
            selected={!!it.active}
            onClick={() => {
              it.onClick();
              if (afterClick) afterClick();
            }}
            style={{ borderRadius: 8, marginBottom: 2 }}
          >
            <ListItemIcon
              style={{ minWidth: 40, color: it.active ? '#1ED760' : 'inherit' }}
            >
              {it.badge ? (
                <Badge badgeContent={it.badge} color="primary">
                  {it.icon}
                </Badge>
              ) : (
                it.icon
              )}
            </ListItemIcon>
            <ListItemText
              primary={it.label}
              primaryTypographyProps={{
                style: { fontWeight: it.active ? 700 : 500 },
              }}
            />
          </ListItem>
        ))}
        <Divider style={{ margin: '8px 0' }} />
        <ListItem
          button
          onClick={() => {
            this.setState({ openChangelog: true });
            if (afterClick) afterClick();
          }}
          style={{ borderRadius: 8 }}
        >
          <ListItemIcon style={{ minWidth: 40 }}>
            <Receipt />
          </ListItemIcon>
          <ListItemText primary="Changelog" secondary={version} />
        </ListItem>
      </List>
    );

    return (
      <>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <Hidden mdUp>
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => this.setState({ navDrawerOpen: true })}
                title="Menu"
                aria-label="open navigation"
                style={{ marginRight: 4 }}
              >
                <MenuIcon />
              </IconButton>
            </Hidden>
            <Wordmark variant="h6" />
            <Box style={{ flexGrow: 1 }} />
            <Hidden smDown>
              <CurrentSong token={this.state.access_token} compact />
            </Hidden>
            <IconButton
              edge="end"
              onClick={() => this.setState({ drawerOpen: true })}
              title="Account"
              aria-label="account"
              style={{ marginLeft: 8 }}
            >
              <Avatar
                style={{
                  width: 32,
                  height: 32,
                  fontSize: 15,
                  backgroundColor: '#1ED760',
                  color: '#fff',
                }}
              >
                {userInitial}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            maxWidth: 1500,
            margin: '0 auto',
            padding: '16px 16px 130px',
          }}
        >
          <Hidden smDown>
            <Paper
              variant="outlined"
              style={{
                width: 220,
                flex: 'none',
                borderRadius: 12,
                position: 'sticky',
                top: 16,
              }}
            >
              {renderNavList()}
            </Paper>
          </Hidden>

          {/* Mobile: nav lives in a slide-out drawer (hamburger in the bar). */}
          <Drawer
            anchor="left"
            open={this.state.navDrawerOpen}
            onClose={() => this.setState({ navDrawerOpen: false })}
          >
            <Box
              style={{
                width: 270,
                paddingTop: 8,
                // Clear the fixed bottom Spotify player so Now Playing isn't
                // hidden behind it on mobile.
                paddingBottom: 110,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
              role="presentation"
            >
              <Box style={{ padding: '4px 16px 8px' }}>
                <Wordmark variant="h6" />
              </Box>
              <Divider />
              {renderNavList(() => this.setState({ navDrawerOpen: false }))}
              <Box style={{ marginTop: 'auto' }}>
                <Divider />
                <Box style={{ padding: 16 }}>
                  <CurrentSong token={this.state.access_token} />
                </Box>
              </Box>
            </Box>
          </Drawer>

          <Box style={{ flex: 1, minWidth: 0 }}>
            {this.state.showPlaylists ? (
              <FadeIn transitionDuration={400}>
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
                  favoritesOnly={this.state.favoritesOnly}
                  soundcloud={this.state.soundcloud}
                  soundcloudBackend={soundcloudBackend}
                  onRefreshSoundcloud={this.refreshSoundcloudToken}
                  hideSets={this.state.disableScSets}
                  onPlaySoundcloud={this.playSoundcloudTrack}
                />
              </FadeIn>
            ) : (
              <Box style={{ textAlign: 'center', padding: '72px 20px' }}>
                <LibraryMusic style={{ fontSize: 56, color: '#1ED760' }} />
                <Typography
                  variant="h6"
                  style={{ marginTop: 12, fontWeight: 700 }}
                >
                  Welcome to KeyTrack
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ maxWidth: 440, margin: '8px auto 20px' }}
                >
                  Open your Library to analyze crates by key, BPM and energy — or
                  jump straight into the Key Calculator.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<LibraryMusic />}
                  onClick={this.openLibrary}
                  disabled={this.state.loadingPlaylists}
                  style={{
                    borderRadius: 24,
                    textTransform: 'none',
                    fontWeight: 700,
                    marginRight: 8,
                  }}
                >
                  {this.state.loadingPlaylists ? 'Loading…' : 'Open Library'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Tune />}
                  onClick={this.openKeyCalculator}
                  style={{ borderRadius: 24, textTransform: 'none' }}
                >
                  Key Calculator
                </Button>
              </Box>
            )}
          </Box>
        </Box>
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

          <List>
            <ListItem
              button
              onClick={
                this.state.soundcloud.connected
                  ? this.disconnectSoundcloud
                  : this.connectSoundcloud
              }
            >
              <ListItemIcon>
                <Cloud style={{ color: '#ff5500' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  this.state.soundcloud.connected
                    ? 'SoundCloud connected'
                    : 'Connect SoundCloud'
                }
                secondary={
                  this.state.soundcloud.connected ? 'Tap to disconnect' : null
                }
              />
            </ListItem>
            {this.state.soundcloud.connected && (
              <>
                <ListSubheader disableSticky>KeyTrack settings</ListSubheader>
                <ListItem>
                  <ListItemIcon>
                    <GraphicEq />
                  </ListItemIcon>
                  <ListItemText
                    primary="Disable Sets (SoundCloud)"
                    secondary="Hide long DJ sets/mixes from crates"
                  />
                  <Switch
                    edge="end"
                    color="primary"
                    checked={this.state.disableScSets}
                    onChange={this.toggleDisableScSets}
                  />
                </ListItem>
              </>
            )}
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

          {/* Bottom player bar — the SoundCloud Widget while a SC track is
              active, otherwise the Spotify Web Playback player. */}
          {this.state.scNowPlaying ? (
            <ScBottomPlayer
              track={this.state.scNowPlaying}
              onClose={() => this.setState({ scNowPlaying: null })}
            />
          ) : (
            loggedIn && (
              <BottomPlayer
                token={this.state.access_token}
                uris={this.state.player.uris}
                play={this.state.player.isPlaying}
              />
            )
          )}
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
