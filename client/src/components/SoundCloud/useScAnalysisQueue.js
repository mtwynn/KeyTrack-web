import React from "react";
import { getScAnalysis, saveScAnalysis } from "../../utils/scAnalysis";
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
      setAnalysis((a) => ({ ...a, [urn]: { status: "loading" } }));
      queueRef.current.push(t);
      processQueue();
    },
    [processQueue]
  );

  const enqueueAll = React.useCallback(
    (tracks) => (tracks || []).forEach(enqueue),
    [enqueue]
  );

  return { analysis, enqueue, enqueueAll };
}
