import React from "react";
import { getOverridesBulk, saveOverride } from "./overrideStore";

// Loads the key/chord overrides for the tracks in a view (bulk read, then
// merged into local state) and exposes setOverride to apply + persist one.
// Optimistic: the local map updates immediately so the row re-renders, and the
// write goes to Firestore in the background (cross-device + permanent).
export function useOverrides(ids) {
  const [overridesById, setOverridesById] = React.useState({});
  const seenRef = React.useRef(new Set());

  React.useEffect(() => {
    const fresh = (ids || []).filter((id) => id && !seenRef.current.has(id));
    fresh.forEach((id) => seenRef.current.add(id));
    if (!fresh.length) return;
    let cancelled = false;
    getOverridesBulk(fresh).then((res) => {
      if (!cancelled && Object.keys(res).length) {
        setOverridesById((m) => ({ ...m, ...res }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const setOverride = React.useCallback((id, patch) => {
    setOverridesById((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
    saveOverride(id, patch);
  }, []);

  return { overridesById, setOverride };
}
