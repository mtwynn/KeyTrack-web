const changelog = [
  {
    version: "1.5.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Harmonic mixing: click any track's key to highlight every harmonically compatible track in the playlist (same key, adjacent on the Camelot wheel, or relative major/minor) and dim the rest.",
      },
      {
        type: "feature",
        desc: "Color-coded keys — each key is now shown as a colored Camelot-wheel chip for faster at-a-glance scanning.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Removed the unfinished SoundCloud integration to streamline the app around Spotify.",
      },
      {
        type: "bugfix",
        desc: "Removed exposed SoundCloud API credentials that were hardcoded in the client bundle.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Spotify sessions now refresh automatically in the background — no more hourly 'session expired' interruptions or forced re-logins.",
      },
      {
        type: "bugfix",
        desc: "Wired up the previously-unused token refresh flow: access tokens renew ~5 minutes before expiry and on app load if stale, and the player keeps working seamlessly across refreshes.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "11/15/25",
    changes: [
      {
        type: "feature",
        desc: "Added persistent Spotify player at app level - player now remains visible and functional across playlist changes",
      },
      {
        type: "bugfix",
        desc: "Fixed 'Device not found' error when switching between playlists by moving player to app component level",
      },
      {
        type: "feature",
        desc: "Upgraded to React 18 and react-scripts 5 for improved performance and modern JavaScript support",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "10/14/22",
    changes: [
      {
        type: "feature",
        desc: "Added search functionality to playlists library",
      },
      {
        type: "bugfix",
        desc: "Fixed handling undefined playlist image url when rendering playlist library",
      },
    ],
  },
  {
    version: "1.0.9",
    date: "03/10/22",
    changes: [
      {
        type: "feature",
        desc: "Added magnify slider on hover for Spotify Web player",
      },
      {
        type: "bugfix",
        desc: "Re-wrote logic to fetch all user playlists when fetching, not just the first 50",
      },
    ],
  },
  {
    version: "1.0.8",
    date: "01/14/22",
    changes: [
      {
        type: "feature",
        desc: "Added ability to save user-inputted chord progressions on Playlist songs",
      },
      {
        type: "bugfix",
        desc: "Fixed logout not behaving like a logout, and added session expiry dialog to make clear that session has expired",
      },
    ],
  },
  {
    version: "1.0.7",
    date: "12/15/21",
    changes: [
      {
        type: "feature",
        desc: "Added filtering by key, quality, and BPM to Playlist",
      },
      {
        type: "bugfix",
        desc: "Fixed positioning of changelog and version chips",
      },
    ],
  },
  {
    version: "1.0.6",
    date: "01/05/21",
    changes: [
      {
        type: "feature",
        desc: "Added version numbering and changelog.",
      },
    ],
  },
  {
    version: "1.0.5",
    date: "12/14/20",
    changes: [
      {
        type: "bugfix",
        desc: "Changed fullscreen display of playlist to stretch for XL (1920w) screens.",
      },
      {
        type: "bugfix",
        desc: "Fixed layout of player in relation to table.",
      },
      {
        type: "feature",
        desc: "Added Spotify web player so individual tracks can be played.",
      },
    ],
  },
  {
    version: "1.0.4",
    date: "10/25/20",
    changes: [
      {
        type: "bugfix",
        desc: "Fixed bug where null tracks in playlist would crash application.",
      },
    ],
  },
];

export default changelog;
