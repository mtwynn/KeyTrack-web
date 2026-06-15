# KeyTrack Analysis Service

A tiny HTTP microservice that computes a track's **musical key (Camelot)** and **BPM** from audio, for KeyTrack's SoundCloud integration (SoundCloud exposes no audio analysis, so we do it ourselves).

It runs **separately** from the main Heroku backend because it needs native audio tools (`ffmpeg`, `bpm-tools`, and `keyfinder-cli`/`libKeyFinder`) that don't install on Heroku buildpacks — they're baked into this service's container instead. The main app calls it over HTTP.

## Engine
- **Key** — [`keyfinder-cli`](https://github.com/evanpurkhiser/keyfinder-cli) over [`libKeyFinder`](https://github.com/mixxxdj/libkeyfinder) (the Mixxx library), output directly as Camelot.
- **BPM** — [`bpm-tools`](https://www.pogo.org.uk/~mark/bpm-tools/) on a steady ~90s mid-segment, then **octave-folded** into the octave that fits the track's SoundCloud genre tag (see `bpm.js`).
- Both are GPL CLIs invoked as **separate processes**, so this service and KeyTrack stay MIT.
- Tracks longer than ~6 min are treated as DJ sets and skipped (`isLikelySet`).

Benchmarked against Spotify audio-features on 110 same-recording tracks: **BPM 97% correct** (allowing octave; 0.1% median error), **Key 90% harmonically compatible** (55% exact).

## API
```
GET  /health                     → { ok: true }
POST /analyze                    → { isLikelySet, camelot, key, bpm }
  body: {
    audioUrl:   string,          // a downloadable audio URL (e.g. SoundCloud http_mp3_128_url)
    authHeader?: string,         // e.g. "OAuth <token>" for SoundCloud streams
    durationMs?: number,         // used for the set-exclusion + segment start
    genre?:     string           // SoundCloud genre tag, used for BPM octave-folding
  }
```

## Run locally
Requires `ffmpeg`, `bpm` (bpm-tools), and a `keyfinder-cli` binary on PATH (or set `KEYFINDER_CLI`, `BPM_BIN`, `FFMPEG`).
```bash
npm install
node server.js          # listens on :8899
```

## Run with Docker (recommended — bundles all the native tools)
```bash
docker build -t keytrack-analysis .
docker run -p 8899:8899 keytrack-analysis
```

## Deploy
Any container host — **Fly.io** (`fly launch` / `fly deploy`) or **Render** (Docker web service). Point the main backend's `ANALYSIS_SERVICE_URL` at it.
