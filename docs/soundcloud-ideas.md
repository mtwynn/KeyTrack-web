# KeyTrack × SoundCloud — Planning Doc

> **Status:** Exploration / not yet scoped for build. Key decisions are now made (see §6 — scale, engine, playback, UX, infra); next step is to scope the MVP. This captures the research, decisions, and the full idea backlog so we can pick up later.

---

## 1. The strategic framing

SoundCloud has **no audio-analysis API** (no Spotify-style key/BPM/energy). For most tracks `bpm`/`key_signature` are blank artist-entered fields. **That gap is exactly KeyTrack's superpower** — we already compute key + BPM, so the SoundCloud section's headline value is:

> **Harmonic intelligence for the music Spotify doesn't have** — analyze SoundCloud tracks ourselves (key, BPM, Camelot), organize them, and dig harmonically through the edits/bootlegs/unreleased/underground catalog that only lives on SoundCloud.

Don't try to out-stream SoundCloud (ToS + rate caps forbid it). **Out-analyze it.** Position the experience as analysis + organization + crate-digging + linking out, with embedded playback.

---

## 2. Hard constraints (the API reality — verified June 2026)

| Constraint | Detail | Implication |
|---|---|---|
| **API access** | Reopened May 2026, self-serve **but requires a paid Artist Pro subscription** (the developer's). OAuth 2.1 + PKCE, secret required, **no public `client_id`-only tier**. | Need our existing **backend**. One app credential covers the app; users OAuth-connect their own accounts. |
| **🔴 No audio analysis** | No `audio-features` equivalent. `bpm`/`key_signature`/`genre`/`tag_list` exist on the track object but are optional, artist-typed, usually `null`. ([issue #547](https://github.com/soundcloud/api/issues/547), [#262](https://github.com/soundcloud/api/issues/262)) | **We must compute key/BPM ourselves.** This is the core feature, not a nice-to-have. |
| **Streaming = HLS/AAC only** | Progressive MP3 removed end-2025 (`/tracks/{id}/streams` → HLS AAC). Short-lived, auth-required URLs. CDN segments often CORS-tainted. | Audio analysis must be **server-side** (decode HLS → PCM via ffmpeg). Browser Web Audio can't reliably read the samples. |
| **15,000 plays / 24h / app** | Any stream fetch (incl. for analysis) counts as a "play," **shared across ALL users of the app.** Undocumented sub-limits → 429s well below 15k. | Hard ceiling on analysis throughput. Must **analyze-once + persist + share** results. Throttle/queue. |
| **ToS (eff. Mar 2024)** | No downloading/ripping/offline; **session-only caching of their content**; no modifying/derivative works (DJ *mixing* is legally fraught); **no "alternative on-demand aggregation service"**; mandatory attribution + backlink; no ads around content. | Stay on the **analysis/discovery/linking** side. Playback via official embed. Persist only *derived* data, never audio. |
| **Sanctioned playback** | oEmbed + HTML5 Widget (iframe, no OAuth). | **Embed for playback**; don't build a custom multi-uploader streaming player (brushes the "alternative service" line). |

Sources: developers.soundcloud.com (guide, rate-limits, ToS, OpenAPI spec, dev blog), `soundcloud/api` GitHub issues (#547, #262, #441, #550), HN threads.

---

## 3. The headline: key/BPM analysis of SoundCloud tracks

This is the larger value item. Design:

### How it works (no playback required)
1. User connects SoundCloud → we read their crates (likes/playlists/reposts).
2. For a track without analysis: backend calls `/tracks/{id}/streams` → fetches HLS/AAC segments → decodes to PCM (ffmpeg) → runs **key + BPM detection** → stores **only the derived numbers**.
3. **The user does NOT have to be playing the track.** Playback is independent of analysis.

### Two modes
- **Analyze-as-you-go** — analyze a track lazily when it first appears / is opened.
- **"Analyze Crate"** — a **backend background/queue job** that analyzes all un-analyzed tracks in a crate, with progress UI (like the existing "Loading all crates…" but cancelable). Feasible, but it **consumes the shared 15k/day play budget**, so it must be throttled, prioritized, and cached.

### Showing artist data vs. our analysis
- If the artist entered `bpm`/`key_signature`, **show it** (badged "artist-tagged").
- **Still analyze independently**, and **flag mismatches** ("artist: 128 · detected: 126").
- Normalize free-text `key_signature` ("Am", "A min", "8A") into our Camelot system.

### Caching → DB, not just session (decision)
Two tiers:
- **SoundCloud content** (audio, metadata) → **transient / session-only** (ToS). Never store audio.
- **Our derived analysis** → **persist in Firestore, keyed by SoundCloud track URN, shared across all users**:
  ```
  scAnalysis/{trackUrn} = {
    bpm, key, camelot, mode, confidence,
    source: 'analyzed' | 'artist',
    analyzedAt
  }
  ```
  **Why DB:** analysis is CPU-heavy *and* burns the precious play quota. A shared cache means a track is only ever analyzed once for the whole app — user B reuses user A's result for free, without re-spending quota. This is the key mitigation for the rate cap.
- **ToS note:** derived BPM/key numbers are *our computed output*, not a copy of their audio/content — defensible vs. the "session-only caching" clause (which targets *their* content). Worth a careful read before shipping; conservative fallback is to store derived data + minimal identifiers only.

### Open feasibility questions (see §6)
Where analysis runs (Heroku worker vs. managed service vs. on-demand only), which engine (WASM keyfinder/essentia vs. ffmpeg+native vs. 3rd-party API), and the multi-user quota math.

---

## 4. Unified library — strict source separation (decision)

If we merge Spotify + SoundCloud into one library, **provenance must always be visible. No silent mixing.**

- **Source badge** on every track *and* crate (Spotify green / SoundCloud orange icon).
- **Source filter / sections** — view all, or scope to one source.
- Provenance stays visible **even inside a cross-platform Set Builder** (each row shows its source).
- **Unified harmonic language** (Camelot / BPM / energy where available) is the *only* thing merged — the data model keeps `source` on every item.
- Guardrails so a Spotify action never silently targets a SoundCloud item or vice-versa.

The goal: one cohesive experience, two clearly distinct sources.

---

## 5. Feature backlog (all approved)

Tags: ✅ straightforward · ⚠️ needs our analysis engine · 🔶 ToS/architecture-sensitive · 🌟 SoundCloud-only · 🧪 experimental

### A. Spotify-parity (read / organize)
1. ✅ **Connect SoundCloud** (OAuth 2.1/PKCE) as a second source.
2. ✅ **Library as crates** — playlists/sets, likes, reposts → crates, same tile UI.
3. ✅ **Track table** — title, artist, genre, tags, duration, plays, likes, reposts, artist-entered BPM/key (badged).
4. ✅ **Search** — tracks/playlists/users, with SoundCloud's native `bpm[from/to]` + genre/tag filters in our UI.
5. ✅ **Reuse** favorite/hide, tags & genres, folders, sortable columns, Crate DNA, Set Builder, saved sets, Camelot wheel.
6. ⚠️ **Recommendations** via `/tracks/{id}/related`, re-ranked by our harmonic + BPM compatibility.

### B. Harmonic-analysis layer (the differentiator)
7. ⚠️ **Compute key + BPM ourselves** (server-side; see §3).
8. ⚠️ **Fill gaps + verify + mismatch flags** (artist vs. detected).
9. ✅ **Normalize `key_signature`** free-text → Camelot.
10. ⚠️ **Harmonic highlighting / anchor-a-track** across a SoundCloud crate.
11. 🔶 **Persisted shared analysis cache** keyed by URN (see §3 decision).

### C. SoundCloud-native (no Spotify equivalent) 🌟
12. 🌟 **Waveform display** (`waveform_url` PNG or `.json` peaks) as the scrubber.
13. 🌟🧪 **Comment-density "drop" hints** — timestamped comments → activity heatmap on the waveform. *Noisy data (emojis, @mentions); treat as crowd-signal hint, not real section detection. Later, not MVP.*
14. 🌟 **Reposts-as-discovery feed** — a crate from what followed labels/curators repost.
15. 🌟 **Browse + (optionally) follow labels/curators** — read their public tracks/reposts; optional KeyTrack-side "watched" list so we don't have to touch the real SC social graph.
16. 🌟🔶 **Free-download finder** — filter to download-enabled tracks; **link out**, never host/rip.
17. 🌟 **Buy-link surfacing** — SoundCloud `purchase_url` natively; **for Spotify (no buy links in API) offer a constructed "Find on Bandcamp / Beatport" external-search button.** Make this affordance platform-agnostic.
18. 🌟 **Private/secret promo import** — paste secret share links, analyze like any crate (digital dubplate workflow).
19. 🌟 **Per-track social stats** — plays/likes/reposts/comments as a curation "heat" signal.

### D. Crate-digging (SoundCloud's moat) 🌟
20. 🌟⚠️ **"Edits & bootlegs of ___" finder** — search remixes/edits/flips, ranked by harmonic fit to the set.
21. 🌟 **Unreleased/promo crate + genre/tag deep-dives** into the underground.
22. 🌟⚠️ **"Find harmonically compatible tracks across SoundCloud"** — anchor a key/BPM, search + analyze candidates, return clean transitions. The killer feature SoundCloud can't do itself.

### E. Cross-platform unification
23. ⚠️ **Unified library** — Spotify + SoundCloud side by side, one harmonic language, **strict source separation** (see §4).
24. ⚠️ **Cross-platform Set Builder** — sequence from both catalogs with transition validation; source shown per row.
25. ⚠️ **Spotify ⇄ SoundCloud bridge** — "this Spotify track has a bootleg/edit on SoundCloud," and the reverse ("find the official release").

### F. Creator-side (Artist Pro is required anyway) 🌟
26. 🌟⚠️ **Analyze your own uploads** + **auto-suggest BPM/key/tags** to fill in (write back via API) — improving SoundCloud's own metadata.
27. 🌟 **Set-prep export** from your SoundCloud sets.

---

## 6. Resolved decisions (round 2)

All the round-1 open questions are now answered:

1. **Scale = personal (1 user, maybe up to ~5).** Possible future scaling is a *very* far-off conversation. → The **15k plays/24h cap is a non-issue** solo (even Analyze-Crate on the biggest ~882-track crate = ~882 plays). Persisting derived analysis is fine.
2. **Analysis engine = self-hosted Essentia** (pipeline: `ffmpeg` decodes the HLS/AAC stream → **Essentia** computes key + BPM). **Free** (compute only), does both, no external dependency, no per-track cost. Accuracy to expect: **BPM ~90–98%** on 4/4 dance (main failure = half/double-time → constrain range + auto-correct); **Key ~70–85% exact** ("sometimes off by a relative or a fifth" — hence the artist-vs-detected + confidence + mismatch UX). Optional later: a paid API (Cyanite.ai / Music.ai) if we want energy/mood/chords/stems on the SC side too.

   | Engine | Cost | Key | BPM | Notes |
   |---|---|---|---|---|
   | **Essentia (self-host)** ⭐ | Free | ✅ | ✅ | Open-source gold standard; chosen |
   | libKeyFinder + JS BPM | Free | ✅ great | ✅ good | Two libs to wire |
   | aubio | Free | ⚠️ weak | ✅ strong | Skip for key |
   | Cyanite.ai | Paid (small free tier) | ✅ | ✅ +mood/energy | External; "vibe" extras |
   | Music.ai (Moises) | Paid/min | ✅ | ✅ +chords/stems | If we want stems later |
   | GetSongBPM / Tunebat | Free (attribution) | lookup | lookup | DB lookup, poor underground coverage |

3. **Playback = official embed Widget for now** (sidesteps streaming licensing + the play cap + HLS complexity). Native in-app player is a *later* workshop item; its caveats: each play hits `/streams` (counts against 15k/day), in-browser HLS handling, short-lived auth'd URLs (backend-refreshed), and `access`-gated tracks (`preview`/`blocked` by geo/rights). **Note: analysis still needs `/streams`** regardless of playback choice.
4. **Persisting derived analysis: confirmed yes** (solo app; it's our computed data, not their audio).
5. **Artist Pro: non-issue.** Pro is only needed to *register the API app / get credentials* (the developer). End users who OAuth-connect don't need it. Owner is developer + sole user + already on Artist Pro → fully covered.

## 6b. Analysis UX (decided)

A **single-worker FIFO queue**, two entry points:
- **Auto-analyze on play** — playing a track enqueues its analysis; **never blocks playback**. Show a **loading state** on that track's key/BPM info; **fill it in live** + persist on completion. If the user plays another track before the first finishes, the first **still completes** and the new one **queues behind it**.
- **"Analyze Crate"** — the same queue fed a whole crate as a batch, with progress + cancel (like the existing "Loading all crates…" loader).

One analysis at a time keeps it simple and is plenty for a solo user.

## 6c. Infrastructure note (Heroku)

- The backend's **`heroku-22` stack is deprecated** (builds start failing Nov 2026, escalating through 2027). **Immediate fix, independent of SoundCloud:** `heroku stack:set heroku-24 -a key-track2` then redeploy.
- The audio analysis is CPU/RAM-heavy and Heroku has a **30s web-request timeout** + small dynos — fine **because analysis runs as an async background job** (HTTP returns "queued" instantly; frontend polls). If the dyno strains, move analysis to a small **containerized service (Fly.io / Render)** with `ffmpeg` + Essentia baked into the image (cleaner than native libs on Heroku buildpacks; cheap/free tiers). Not needed for MVP.

---

## 7. Rough phasing (draft — not committed)

- **Phase 0 — Foundation:** SoundCloud OAuth + backend proxy; read likes/playlists/reposts as crates; source badges; embed-Widget playback. *(No analysis yet — display artist-entered data where present.)*
- **Phase 1 — The headline:** server-side key/BPM analysis (on-demand single track) + persisted shared cache + Camelot normalization + harmonic highlighting. Likely the true **MVP**.
- **Phase 2 — Analyze Crate:** background/queue job + progress UI + throttling against the quota.
- **Phase 3 — Native + digging:** waveform, reposts feed, free-download/buy links, edits/bootlegs finder, cross-SoundCloud harmonic search.
- **Phase 4 — Unification:** unified library + cross-platform Set Builder + Spotify⇄SoundCloud bridge.
- **Phase 5 — Creator-side + experimental:** upload analysis/write-back, comment-density drop hints.

---

*Last updated during planning (round 2: decisions in §6 resolved). Next: scope the MVP — likely Phase 0 + Phase 1.*
