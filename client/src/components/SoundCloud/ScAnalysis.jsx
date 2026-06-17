import React from "react";

import { buildScFetch } from "../../utils/soundcloudCrates";
import { useScAnalysisQueue } from "./useScAnalysisQueue";
import ScAnalysisIndicator from "./ScAnalysisIndicator";

// A single, app-level SoundCloud analysis queue shared by every view (the
// combined browser, the standalone crate, analyze-on-play) via context. Because
// the provider lives high in the tree (App) and stays mounted, analysis KEEPS
// RUNNING after a crate is closed, and the floating indicator persists. The
// `children` element is the same reference across the provider's own state
// updates, so React bails out of re-rendering the app tree on each analysis
// tick — only the indicator and the components that actually read this context
// re-render.
const ScAnalysisContext = React.createContext({
  analysis: {},
  enqueue: () => {},
  enqueueAll: () => {},
});

export function useScAnalysis() {
  return React.useContext(ScAnalysisContext);
}

export function ScAnalysisProvider({
  token,
  connected,
  backend,
  onRefreshToken,
  playerInset,
  children,
}) {
  // One SoundCloud fetcher for the whole queue; rebuilds only when the token
  // rotates (rare) — its 401 handler self-refreshes in between.
  const scFetch = React.useMemo(
    () =>
      connected && token
        ? buildScFetch({ token, backend, onRefreshToken })
        : null,
    [connected, token, backend, onRefreshToken]
  );

  const { analysis, enqueue, enqueueAll, setBpmOverride, meta, progress } =
    useScAnalysisQueue(scFetch);

  // Only the enqueue API + analysis map go through context; identities are
  // stable, so consumers only re-render when `analysis` actually changes.
  const value = React.useMemo(
    () => ({ analysis, enqueue, enqueueAll, setBpmOverride }),
    [analysis, enqueue, enqueueAll, setBpmOverride]
  );

  return (
    <ScAnalysisContext.Provider value={value}>
      {children}
      <ScAnalysisIndicator
        analysis={analysis}
        meta={meta}
        progress={progress}
        playerInset={playerInset}
      />
    </ScAnalysisContext.Provider>
  );
}
