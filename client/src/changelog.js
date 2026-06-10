const changelog = [
  {
    version: "1.17.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Select specific crates (checkbox on each) to scope the cross-search \u2014 the 'Search all crates' button becomes 'Search selected (N)' and only searches those. With none selected it still searches all (non-hidden) crates.",
      },
    ],
  },
  {
    version: "1.16.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Each track now shows its release month/year, with a new 'Released' column. Sort a playlist by newest/oldest release, and filter by a release-year range.",
      },
    ],
  },
  {
    version: "1.15.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Folders: organize your crates into your own folders. Toggle the Folders view to see collapsible folders plus an 'Unfiled' root for crates you haven't filed. Create, rename, and delete folders, and assign a crate to a folder from its organize menu.",
      },
    ],
  },
  {
    version: "1.14.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Tag crates with your own labels and assign genres (multiple per crate), shown as chips on each crate. Filter the library by any tag or genre.",
      },
    ],
  },
  {
    version: "1.13.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Favorite crates (★) to pin them to the top of your library, and Hide crates to tuck them away — hidden crates don't appear in the library or in 'Search all crates', and are managed from a new 'Hidden crates' item in the menu.",
      },
    ],
  },
  {
    version: "1.12.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "The crate library now sorts (by name, track count, or owner) and paginates, so large libraries render a page at a time instead of all at once.",
      },
    ],
  },
  {
    version: "1.11.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Search all crates: load every playlist's tracks into one view and search/filter across your whole library by key, BPM, and text — then add any result straight to your set. (Loads with a progress indicator.)",
      },
    ],
  },
  {
    version: "1.10.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Save, load, update, and delete your sets — name a set and it's stored to your account, so you can pick up a build later. Saved sets keep each track's key/BPM, so loading one doesn't need to refetch from Spotify.",
      },
    ],
  },
  {
    version: "1.9.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "The Set Builder now spans playlists — add tracks from any crate into one shared set and reach it from the menu (or the Set button in a playlist). Each track keeps its own key/BPM, so transitions still validate across playlists.",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Set Builder: add tracks to an ordered set with the + on each row, then reorder them (drag on desktop, up/down on mobile). Each transition is checked for harmonic key compatibility and BPM jump, with clashes flagged.",
      },
      {
        type: "feature",
        desc: "Set Builder lets you set the BPM-jump threshold that counts as a rough transition, and shows a running count of clashes.",
      },
    ],
  },
  {
    version: "1.7.1",
    date: "06/09/26",
    changes: [
      {
        type: "bugfix",
        desc: "Performance: playlist rows are now memoized, so the big track table no longer re-renders when unrelated things change (e.g. opening a dialog) — the app feels snappier on large crates.",
      },
    ],
  },
  {
    version: "1.7.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "New key filter as a mobile-friendly bottom sheet: a piano for Musical notation (pick notes + Major/Minor), an interactive Camelot wheel for Camelot, and an Open-key wheel for Open — with the familiar Mixed In Key colors.",
      },
      {
        type: "feature",
        desc: "Added a 'Combined wheel' picker style (a setting) showing Camelot codes and musical keys together on one wheel.",
      },
      {
        type: "feature",
        desc: "Key selections now carry across notations — pick D Major on the piano and it stays selected as 10B on the wheel; switching notation no longer clears your filter.",
      },
      {
        type: "feature",
        desc: "Collapsed the Musical / Camelot / Open key columns into a single Key column whose notation follows the Notation selector, for a cleaner, less cluttered table.",
      },
      {
        type: "feature",
        desc: "Removed the redundant Quality filter — major/minor is now built into every key picker.",
      },
      {
        type: "bugfix",
        desc: "Opening a playlist crate now shows a clear 'Loading crate…' indicator (plus a spinner on the card you clicked), and never gets stuck if a request fails.",
      },
      {
        type: "bugfix",
        desc: "Opening the Playlist Library now shows a loading spinner on the tile while your playlists are fetched.",
      },
      {
        type: "feature",
        desc: "Revamped the Key Calculator into an interactive Camelot wheel — tap any key to see it in all three notations (Musical / Camelot / Open) at once, plus its harmonic matches.",
      },
    ],
  },
  {
    version: "1.6.0",
    date: "06/09/26",
    changes: [
      {
        type: "feature",
        desc: "Redesigned the app: a proper landing page with a clear 'Log in with Spotify' button and feature highlights, and a clean dashboard with action tiles once you're in.",
      },
      {
        type: "feature",
        desc: "Added a light/dark theme toggle (your choice is remembered).",
      },
      {
        type: "feature",
        desc: "Tucked the secondary controls into a slide-out menu (theme, changelog, logout) to keep the top bar clean on desktop and mobile.",
      },
      {
        type: "feature",
        desc: "Current Song is now a compact widget in the slide-out menu — quick to reach without taking over the screen.",
      },
      {
        type: "feature",
        desc: "The Key Calculator is now available without logging in; Current Song and Playlist Library are clearly gated behind Spotify login.",
      },
    ],
  },
  {
    version: "1.5.1",
    date: "06/09/26",
    changes: [
      {
        type: "bugfix",
        desc: "Fixed local-development Spotify login — Spotify now rejects http://localhost as an insecure redirect URI, so local auth uses the 127.0.0.1 loopback address.",
      },
      {
        type: "bugfix",
        desc: "Developer experience: the local backend now loads Spotify credentials from a gitignored .env file, so they no longer need to be passed on every start.",
      },
    ],
  },
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
