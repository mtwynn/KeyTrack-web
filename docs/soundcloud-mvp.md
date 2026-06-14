# KeyTrack × SoundCloud — MVP Spec (Phase 0 + Phase 1)

> Companion to [`soundcloud-ideas.md`](./soundcloud-ideas.md). This scopes the **first buildable slice**: connect SoundCloud, browse your crates, play via the embed Widget, and — the headline — **analyze key/BPM ourselves** with harmonic highlighting. Everything else (unified library, reposts feed, waveforms, creator-side, etc.) is explicitly **out of scope** here and lives in later phases.

## MVP goal (one sentence)
Connect a SoundCloud account, see your likes/playlists/reposts as source-badged crates, play tracks via the embedded Widget, and get **KeyTrack-computed key + BPM** (with Camelot + harmonic highlighting) that fills in **as you play** or via **Analyze Crate**, cached so it's only ever computed once.

---

## Architecture at a glance

```
React (CRA)  ──►  Express backend (Heroku)  ──►  SoundCloud API
   │                   │   ├─ OAuth 2.1 + PKCE (login/callback/refresh)
   │                   │   ├─ API proxy (hide secret, refresh tokens, attribution)
   │                   │   └─ Analysis worker:  /streams ─► ffmpeg decode ─► libKeyFinder (key) + JS BPM
   │                   ▼
   └──────────────►  Firestore
                        ├─ Users/{uid}/connections/soundcloud   (refresh token, sc user id)
                        └─ scAnalysis/{trackUrn}                  (shared derived key/BPM cache)
```

**Two new things in the backend:** the SoundCloud OAuth+proxy layer, and the analysis worker. **Frontend** gets a SoundCloud *source* alongside Spotify (kept visually separate — unification is a later phase).

---

## Prerequisites (before any code runs)
1. **SoundCloud app credentials** (you have Artist Pro) → `SOUNDCLOUD_ID` / `SOUNDCLOUD_SECRET` in `local-server/.env` (+ `.env.example`), redirect URI `http://127.0.0.1:8888/soundcloud/callback` (local) and the prod equivalent registered in the SoundCloud app.
2. **Decide the analysis host.** libKeyFinder is C++ (needs FFTW). Spike whether it builds on Heroku via a buildpack; if painful, stand up a small **Fly.io/Render container** (ffmpeg + libKeyFinder baked in) as the analysis service. *This is the #1 technical risk — spike it first.*
3. **ffmpeg available** on the analysis host.

---

## Phase 0 — Connect & browse (no analysis yet)

### Auth (mirror the existing Spotify flow)
- `GET /soundcloud/login` → build authorize URL with **PKCE** (`code_challenge`, `S256`), redirect to `https://secure.soundcloud.com/authorize`.
- `GET /soundcloud/callback` → exchange `code` + verifier at `https://secure.soundcloud.com/oauth/token`; **persist the refresh token** (single-use → store the rotated one every refresh) in `Users/{uid}/connections/soundcloud`; redirect back to the app.
- `POST /soundcloud/refresh` → refresh-token rotation; backend keeps SC access tokens (~1h) fresh transparently.

### API proxy (backend attaches token, handles refresh, adds attribution)
- `GET /soundcloud/me`
- `GET /soundcloud/crates` → the user's **playlists + likes + reposts**, normalized to KeyTrack's crate shape with `source: 'soundcloud'`.
- `GET /soundcloud/crates/:urn/tracks`
- `GET /soundcloud/search?q=&bpm_from=&bpm_to=&genres=&tags=` (SoundCloud's native BPM filter)
- `GET /soundcloud/resolve?url=` (paste a permalink / secret link)

### Frontend
- **"Connect SoundCloud"** entry (sidebar/account); a **source switch** so the library shows Spotify *or* SoundCloud (kept separate for MVP).
- Reuse **crate tiles** + **track table**, with a **SoundCloud source badge** (orange) on every crate and track.
- Track table shows **artist-entered** `bpm`/`key_signature` where present, badged "artist-tagged" (often blank — that's expected; Phase 1 fills the rest).
- **Embedded Widget player** for SoundCloud tracks (iframe + JS Widget API), with **mandatory attribution**: uploader credit + SoundCloud logo + backlink to `permalink_url`.

**Phase 0 done =** I can connect SoundCloud and browse/play my crates, clearly marked as SoundCloud, with whatever key/BPM the artist happened to enter.

---

## Phase 1 — The headline: our own key/BPM analysis

### Firestore: shared analysis cache
```
scAnalysis/{trackUrn} = {
  bpm, key, mode, camelot, confidence,
  source: 'analyzed' | 'artist',
  engineVersion,            // bump to force re-analysis if we improve the engine
  analyzedAt
}
```
Top-level, **shared across users** (it's analysis of public tracks). Check here before ever spending compute or a stream fetch.

### The analysis worker (single FIFO queue)
Per track:
0. **Skip likely DJ sets/mixes.** A single track's key/BPM is meaningful; a 60-minute mix's isn't (it wanders across many keys/tempos). So **exclude tracks longer than ~6 minutes** (`LIKELY_SET_MS = 6 * 60 * 1000`) from analysis — never auto-analyze them, skip them in "Analyze Crate," and flag them in the UI as a **"Set"** instead of showing a (meaningless) detected key/BPM. (~6 min is a heuristic; keep the threshold a single constant so it's easy to tune.)
1. **Cache hit?** `scAnalysis/{urn}` exists → return it. Done.
2. `GET /tracks/{urn}/streams` → HLS/AAC URL (counts as 1 "play" — fine at personal scale).
3. **ffmpeg decode** → mono PCM, downsampled (≈22 kHz is plenty for key/BPM). *Optimization: analyze a representative ~60–90s segment (skip intro/outro) for speed.*
4. **libKeyFinder** → key; **JS BPM lib** (web-audio-beat-detector / realtime-bpm-analyzer) → BPM.
5. **Normalize**: key → Camelot (reuse `utils/harmonic.js` mapping); BPM range-constrain + half/double-time correct.
6. **Write** `scAnalysis/{urn}` and return.

- **Concurrency = 1** for MVP; subsequent requests queue. (Matches your spec: finish the current, queue the next.)
- **Async, never blocks**: HTTP returns `queued` immediately; frontend polls. (Heroku 30s request cap → the queue runs off the request cycle.)

### Backend endpoints
- `POST /soundcloud/analyze` `{ trackUrn }` → `{ status: 'cached'|'queued', analysis? }`
- `GET  /soundcloud/analyze/:trackUrn` → `{ status: 'queued'|'running'|'done'|'error', analysis? }`
- `POST /soundcloud/analyze-crate` `{ crateUrn }` → enqueue all un-analyzed tracks → `{ jobId }`
- `GET  /soundcloud/analyze-crate/:jobId` → `{ done, total, results }` (powers the progress UI)

### Frontend UX (per your spec)
- **Analyze-on-play:** pressing play enqueues that track's analysis; **playback is never blocked**. The key/BPM cells show a **loading state**; on completion they **fill in live**. Play another track first → the first still completes, the new one queues behind it.
- **Per-track "Analyze"** action for on-demand single tracks.
- **"Analyze Crate"** button → batch + cancelable progress (reuse the existing "Loading all crates…" loader pattern).
- **Artist vs. detected:** show both when an artist value exists, with a **mismatch flag** ("artist: 128 · detected: 126").
- **Harmonic highlighting / anchor-a-track** works as soon as a crate is analyzed — it just needs key/BPM per row, which the cache now provides. **Reuses the existing Camelot wheel + highlighting** unchanged.

**Phase 1 done =** open a SoundCloud crate, hit Analyze Crate (or just start playing), and watch real key/BPM/Camelot fill in and light up harmonic matches — for music that has no analysis anywhere else.

---

## Explicitly OUT of scope for the MVP
Unified Spotify+SoundCloud library & cross-platform Set Builder · reposts-as-discovery feed · waveform display & comment-density "drop" hints · free-download finder · buy links · edits/bootlegs finder · creator-side upload analysis/write-back · paid-engine fallback. → Phases 2–5 in the plan doc.

---

## Risks / things to validate early
1. **libKeyFinder native build** (FFTW) on Heroku — may force the container host sooner. **Spike before committing the rest of Phase 1.**
2. **HLS fetch with short-lived auth'd URLs** — confirm ffmpeg can pull the playlist with the token, or whether we fetch segments in Node and pipe to ffmpeg.
3. **Per-track analysis time** on a small dyno — measure; the segment-only optimization is the mitigation.
4. **Refresh-token rotation** — must persist the new refresh token on every refresh or we get locked out.
5. **Two playback systems** (Spotify Web Playback vs. SoundCloud Widget) — manage which is active by track source.

---

## Build order (ticket-sized, each its own branch/PR)
**Phase 0**
1. SC OAuth backend (login/callback/refresh) + token storage in Firestore.
2. SC API proxy endpoints (me, crates, crate tracks, search, resolve) + attribution helper.
3. Frontend: Connect SoundCloud + source switch + SC crates/track table (badged; artist-entered values shown).
4. Embedded Widget playback + attribution.

**Phase 1**
5. **Spike:** libKeyFinder + ffmpeg build on the chosen host (decide Heroku vs. container).
6. Analysis worker (stream → decode → libKeyFinder + JS BPM → Camelot normalize → cache).
7. `/analyze` + poll endpoints + FIFO queue.
8. Frontend: analyze-on-play (loading states, live fill) + per-track Analyze.
9. Analyze Crate batch + progress UI.
10. Harmonic highlighting/anchor on SC crates + artist-vs-detected mismatch UI.

---

*Scoped during planning. Build starts at ticket #1 once SoundCloud credentials are in `.env` and the analysis-host spike (#5) direction is chosen.*
