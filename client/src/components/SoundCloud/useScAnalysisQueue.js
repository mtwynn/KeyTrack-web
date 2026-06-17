import React from "react";
import { getScAnalysis, getScAnalysisBulk, saveScAnalysis } from "../../utils/scAnalysis";
import { isLikelySet } from "../../utils/soundcloudCrates";

// A single-worker FIFO queue that lazily computes our key/BPM for SoundCloud
// tracks (SoundCloud has none). Enqueuing never blocks playback; results fill
// in live and cache to Firestore so a track is only ever analyzed once for the
// whole app. Shared by the standalone SoundCloud crate view and the combined
// multi-source browser.
//
// Returns:
//   analysis  { [urn]: {status:'loading'} | {isLikelySet} | {camelot,key,bpm} | {error} }
//   enqueue(track)      queue one track for analysis
//   enqueueAll(tracks)  queue many (e.g. "Analyze crate")
export function useScAnalysisQueue(scFetch) {
  const [analysis, setAnalysis] = React.useState({});
  const queueRef = React.useRef([]); // FIFO of tracks awaiting analysis
  const seenRef = React.useRef(new Set()); // urns already queued/done (dedupe)
  const processingRef = React.useRef(false);
  // For the global progress indicator: track metadata (urn -> {urn,title,
  // artist}) and a {done,total} counter for the CURRENT run, reset to 0/0 when
  // the queue drains so the next batch starts fresh (not a cumulative session
  // total).
  const metaRef = React.useRef({});
  const totalRef = React.useRef(0);
  const doneRef = React.useRef(0);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  const trackUrn = (t) => t.urn || String(t.id);

  const processQueue = React.useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    (async () => {
      while (queueRef.current.length) {
        const t = queueRef.current.shift();
        const urn = trackUrn(t);
        let result = await getScAnalysis(urn); // shared cache first
        if (!result) {
          try {
            const tid = t.id || t.urn;
            result = await scFetch(
              `/soundcloud/analyze?track_id=${encodeURIComponent(tid)}` +
                `&duration=${t.duration || 0}` +
                `&genre=${encodeURIComponent(t.genre || "")}`
            );
            // Cache successes AND terminal "unavailable" verdicts (a
            // SoundCloud-only track won't become analyzable) so we don't re-hit
            // the API for them.
            if (result && !result.isLikelySet && (result.camelot || result.unavailable)) {
              saveScAnalysis(urn, result);
            }
          } catch (e) {
            // A thrown error is now only a genuine/transient failure — the
            // backend returns 200 for expected "unavailable" tracks. Capture the
            // reason so the marker can show why.
            const data = e && e.response && e.response.data;
            const reason =
              (data && (data.reason || data.scMessage || data.error)) ||
              (e && e.message) ||
              null;
            result = { error: true, reason };
          }
        }
        setAnalysis((a) => ({ ...a, [urn]: result || { error: true } }));
        doneRef.current += 1;
        setProgress({ done: doneRef.current, total: totalRef.current });
        // Allow a retry only for genuine failures or an analyzed-but-no-key
        // result — NOT for terminal `unavailable` verdicts.
        if (
          !result ||
          result.error ||
          (!result.camelot && !result.isLikelySet && !result.unavailable)
        ) {
          seenRef.current.delete(urn);
        }
      }
      processingRef.current = false;
      // Run drained — reset the counter so the next batch starts at 0/0.
      totalRef.current = 0;
      doneRef.current = 0;
      setProgress({ done: 0, total: 0 });
    })();
  }, [scFetch]);

  const enqueue = React.useCallback(
    (t) => {
      const urn = trackUrn(t);
      if (seenRef.current.has(urn)) return; // already queued/done
      seenRef.current.add(urn);
      if (isLikelySet(t.duration)) {
        setAnalysis((a) => ({ ...a, [urn]: { isLikelySet: true } }));
        return;
      }
      metaRef.current[urn] = {
        urn,
        title: t.title || "",
        artist: (t.user && t.user.username) || "",
      };
      setAnalysis((a) => ({ ...a, [urn]: { status: "loading" } }));
      queueRef.current.push(t);
      totalRef.current += 1;
      setProgress({ done: doneRef.current, total: totalRef.current });
      processQueue();
    },
    [processQueue]
  );

  // Enqueue many tracks fast: bulk-read the shared cache in PARALLEL up front,
  // paint cache hits instantly, and only feed the cache MISSES into the
  // single-worker server queue. (Going through enqueue() one-by-one would do N
  // serial cache reads — slow for an already-analyzed crate.)
  const enqueueAll = React.useCallback(
    async (tracks) => {
      const fresh = [];
      (tracks || []).forEach((t) => {
        const urn = trackUrn(t);
        if (seenRef.current.has(urn)) return;
        seenRef.current.add(urn);
        if (isLikelySet(t.duration)) {
          setAnalysis((a) => ({ ...a, [urn]: { isLikelySet: true } }));
        } else {
          fresh.push(t);
        }
      });
      if (!fresh.length) return;

      const cached = await getScAnalysisBulk(fresh.map(trackUrn));
      const misses = [];
      const hitUpdates = {};
      fresh.forEach((t) => {
        const urn = trackUrn(t);
        if (cached[urn]) {
          hitUpdates[urn] = cached[urn];
        } else {
          misses.push(t);
          hitUpdates[urn] = { status: "loading" };
          metaRef.current[urn] = {
            urn,
            title: t.title || "",
            artist: (t.user && t.user.username) || "",
          };
        }
      });
      setAnalysis((a) => ({ ...a, ...hitUpdates }));

      if (misses.length) {
        misses.forEach((t) => queueRef.current.push(t));
        totalRef.current += misses.length;
        setProgress({ done: doneRef.current, total: totalRef.current });
        processQueue();
      }
    },
    [processQueue]
  );

  return { analysis, enqueue, enqueueAll, meta: metaRef.current, progress };
}
