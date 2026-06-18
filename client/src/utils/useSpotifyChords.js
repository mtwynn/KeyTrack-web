import React from "react";
import { getSpotifyChordsBulk, saveSpotifyChords } from "./spotifyChordStore";
import { chordsFromAnalysis } from "./spotifyChords";
import { breakerWaitMs, note429, noteSuccess, throttleSlot } from "./spotifyLimiter";

// Chord loops for the Spotify tracks in a view. Bulk-reads the shared cache up
// front, then computes the MISSES one at a time from /audio-analysis — paced by
// the same throttle + circuit breaker as the rest of our Spotify calls so it
// can't stampede the rate limit — and caches each result (cross-device). Pure
// client-side: no analysis service, no Eco dyno. Returns { [trackId]: chords }.
export function useSpotifyChords(items, token) {
  const [chordsById, setChordsById] = React.useState({});
  const seenRef = React.useRef(new Set()); // ids already cached/queued
  const queueRef = React.useRef([]);
  const processingRef = React.useRef(false);

  // Spotify track ids only (skip SoundCloud rows in the combined view).
  const ids = React.useMemo(
    () =>
      (items || [])
        .filter((it) => it && it.track && it.track.id && it.__source !== "soundcloud")
        .map((it) => it.track.id),
    [items]
  );

  const fetchAnalysis = React.useCallback(
    async (id) => {
      const wait = breakerWaitMs();
      if (wait) await new Promise((r) => setTimeout(r, wait));
      await throttleSlot();
      const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) {
        note429();
        const e = new Error("429");
        e.retry = true;
        throw e;
      }
      if (!res.ok) throw new Error("http " + res.status); // terminal (e.g. 403/404)
      noteSuccess();
      return res.json();
    },
    [token]
  );

  const processQueue = React.useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    (async () => {
      while (queueRef.current.length) {
        const id = queueRef.current.shift();
        try {
          const chords = chordsFromAnalysis(await fetchAnalysis(id));
          saveSpotifyChords(id, chords, "chroma"); // caches null too (no re-try)
          if (chords) setChordsById((m) => ({ ...m, [id]: chords }));
        } catch (e) {
          if (e && e.retry) {
            // rate-limited → let it be re-queued on a later pass, and pause
            seenRef.current.delete(id);
            await new Promise((r) => setTimeout(r, 1200));
          }
          // terminal errors fall through: no chords, not re-queued
        }
      }
      processingRef.current = false;
    })();
  }, [fetchAnalysis]);

  React.useEffect(() => {
    if (!token || !ids.length) return;
    let cancelled = false;
    (async () => {
      const fresh = ids.filter((id) => !seenRef.current.has(id));
      fresh.forEach((id) => seenRef.current.add(id));
      if (!fresh.length) return;
      const cached = await getSpotifyChordsBulk(fresh); // parallel bulk read
      if (cancelled) return;
      const hits = {};
      const misses = [];
      fresh.forEach((id) => {
        if (cached[id]) {
          if (cached[id].chords) hits[id] = cached[id].chords;
        } else {
          misses.push(id);
        }
      });
      if (Object.keys(hits).length) setChordsById((m) => ({ ...m, ...hits }));
      if (misses.length) {
        misses.forEach((id) => queueRef.current.push(id));
        processQueue();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, token, processQueue]);

  return chordsById;
}
