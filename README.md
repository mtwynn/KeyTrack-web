<div align="center">

# 🎧 KeyTrack

**Harmonic mixing intelligence for your Spotify crates.**

KeyTrack reads the key, BPM, and energy of every track in your Spotify playlists and turns them into a DJ-friendly workspace — Camelot colors, harmonic-match highlighting, set building, and crate organization, all in the browser.

![Version](https://img.shields.io/badge/version-1.26.0-1ED760.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20MUI-61dafb.svg)
![Spotify](https://img.shields.io/badge/powered%20by-Spotify-1ED760.svg)

</div>

---

> **📸 Screenshots:** the placeholders below point at `docs/screenshots/`. Drop matching PNGs in that folder (see [`docs/screenshots/README.md`](docs/screenshots/README.md)) and they'll render here.

![KeyTrack home — sidebar nav and cover-art crate tiles](docs/screenshots/home.png)

---

## ✨ What it does

### 🎹 Key, BPM & notation
- **Automatic key + BPM detection** from Spotify's audio features for every track.
- **Three key notations** — switch any column between **Musical** (C, A♭m…), **Camelot** (8B, 5A…), and **Open Key**.
- **Interactive Camelot wheel / Key Calculator** — tap a key to see all three notations and its harmonic matches at once. No login required.

![Key Calculator — interactive Camelot wheel](docs/screenshots/key-calculator.png)

### 🎚️ Harmonic mixing
- **Camelot-colored keys** across the whole library so compatible tracks read at a glance.
- **Anchor a track** to highlight every harmonic match (same key, ±1, relative major/minor) and dim the clashes.
- **Energy meter** per track, plus sortable **Energy / Danceability / Valence**.

![Harmonic highlighting in a crate](docs/screenshots/harmonic-mixing.png)

### 🗂️ Crate library
- **Cover-art crate tiles** in a responsive, full-width grid.
- **Crates / Folders tabs**, plus **sort, filter, search, and pagination**.
- **Tags + genres**, **favorite / hide**, and **true KeyTrack folders** (stored per user).
- **Liked Songs** surfaced as a virtual crate.
- **Tap to select** crates (or *Select all*) → **Open (N)** to dig across many crates at once; cancel anytime.

![Crate library — tiles, tabs and controls](docs/screenshots/library.png)

### 🧬 Crate analysis
- **Crate DNA** — key distribution (Camelot bars), a BPM histogram, and a summary (track count, BPM range, dominant key, major/minor split, average energy/dance/valence).
- **Release-date** column with sort + filter.
- **Smart recommendations** — suggestions ranked by **harmonic + BPM compatibility** to your anchored key (or a random seed for discovery), not a random grab-bag.

![Crate DNA visualization](docs/screenshots/crate-dna.png)

### 🧰 Set building
- **Set Builder** — assemble an ordered set across *any* playlists, with **key + BPM transition validation** flagging rough cuts.
- **Save, load & rename** named sets (persisted to Firestore).

![Set Builder with transition validation](docs/screenshots/set-builder.png)

### 🎵 Playback & UX
- **In-browser Spotify playback** (Web Playback SDK) with a **slim Now Playing** control in the top bar.
- **Light / dark theme**, a **left sidebar** on desktop and a **hamburger drawer** on mobile.
- Sleek micro-animations and an in-app **changelog**.

---

## 🤖 How this app was built — a transparency note

KeyTrack grew through three waves of authorship. Every commit is on the record, so here's who — or what — wrote it, computed from the merged PR history.

| Author | PRs | Share | What they shipped |
|---|---:|---:|---|
| ✍️ **Tam Nguyen** — by hand | 6 | 16% | The original app: table filters, chord progressions, logout, SoundCloud, changelog |
| ⚡ **Cursor** — AI pair-programming | 7 | 18% | Recommendations v1, a mobile pass, collapsible filters, musical-key UI, UI fixes |
| 🤖 **Claude Code** — AI agent | 26 | 66% | Everything from v1.3.0 → v1.26.0, plus this README |

**Visual share of the 39 feature PRs:**

```
✍️  Tam Nguyen   ███░░░░░░░░░░░░░░░░░░   16%   (6 PRs)
⚡  Cursor       ████░░░░░░░░░░░░░░░░░   18%   (7 PRs)
🤖  Claude Code  █████████████░░░░░░░░   66%   (26 PRs)
```

Claude Code authored everything from **#30 onward** — seamless token refresh, harmonic mixing, the Camelot wheel, the Set Builder, the full crate-management suite (sort/filter/favorite/hide/tags/genres/folders), Liked Songs, Crate DNA, energy/vibe, smarter recommendations, sortable columns, and the complete library redesign. Each of those PRs carries a `🤖 Generated with Claude Code` footer. (One additional PR, #1, was an automated Dependabot bump.)

> The point of this project wasn't to hand everything to an AI — it's a human-built app whose taste and direction stayed with its author while AI did the heavy lifting. KeyTrack is what that collaboration looks like in the open.

---

## 🚀 Local development

### Prerequisites
- **Node.js** v16+
- A **Spotify Developer** account, and **Spotify Premium** (required by the Web Playback SDK)

### 1. Register a Spotify app
At the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app and add this **Redirect URI**:

```
http://127.0.0.1:8888/callback
```

> ⚠️ Spotify rejects `http://localhost` as an "insecure" redirect — use `127.0.0.1`.

Note your **Client ID** and **Client Secret**.

### 2. Configure the backend
```bash
cd local-server
cp .env.example .env        # then fill in SPOTIFY_ID and SPOTIFY_SECRET
npm install                 # first time only
npm start                   # serves on http://127.0.0.1:8888
```

### 3. Start the frontend
In a **new** terminal:
```bash
cd client
npm install                 # first time only
npm start                   # serves on http://localhost:3000
```

### 4. Use it
1. Open `http://localhost:3000`
2. Click **Log in with Spotify** (the **Key Calculator** works without logging in)
3. Open your **Library**, dig through crates by key / BPM / energy, build sets, and play tracks in-browser

---

## 🛠️ Tech stack

**Frontend** — React (Create React App), Material-UI v4, `spotify-web-api-js`, `react-spotify-web-playback`, Firebase / Firestore (saved sets + crate metadata), deployed to **Netlify**.

**Backend** — Node.js + Express handling the Spotify OAuth flow, deployed to **Heroku** (auto-deploys on merge to `master`).

---

## 🌐 Deployment

**Frontend (Netlify)** — continuous deployment from `master` via [`client/netlify.toml`](client/netlify.toml). Manual deploy:
```bash
cd client && npm run build && netlify deploy --prod   # publish dir: ./build
```

**Backend (Heroku)** — auto-deploys when `master` updates. For production set `SPOTIFY_ID`, `SPOTIFY_SECRET`, and `NODE_ENV=production`, and register the production `https://<your-app>/callback` redirect URI in the Spotify dashboard.

---

## 📄 License

MIT — see [`LICENSE`](local-server/LICENSE). Use it, fork it, mix with it.

## 👤 Author

**Tam Nguyen** · built with Spotify 🎵, Cursor ⚡, and Claude Code 🤖

---

<div align="center"><b>Happy mixing! 🎧✨</b></div>
