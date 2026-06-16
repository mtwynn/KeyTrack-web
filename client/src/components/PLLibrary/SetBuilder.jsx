import React from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Slider,
  TextField,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import {
  ArrowUpward,
  ArrowDownward,
  Close,
  Delete,
  DragIndicator,
  Save,
} from "@material-ui/icons";

import KeyMap from "../../utils/KeyMap";
import {
  camelotColor,
  compatibleCamelot,
  camelotToKeyMode,
} from "../../utils/harmonic";
import { getScAnalysis } from "../../utils/scAnalysis";
import { SpotifyIcon, SoundcloudIcon } from "../BrandIcons";
import {
  fetchSets,
  saveSet,
  updateSet,
  deleteSet,
  deserializeTracks,
} from "../../utils/sets";

// Guard KeyMap: a Spotify key can be -1 (no key) so KeyMap[k.key] may be
// undefined — return null instead of crashing the whole panel.
const codeOf = (k) => (k && KeyMap[k.key] ? KeyMap[k.key].camelot[k.mode] : null);

// The ordered set, shown in a slide-out panel (bottom sheet on mobile, right
// drawer on desktop). Each entry is { item, key } so the set is self-contained
// and can hold tracks from multiple playlists. Each transition between
// consecutive tracks is validated for harmonic key compatibility and BPM jump.
const SetBuilder = ({
  open,
  onClose,
  set,
  onReorder,
  onRemove,
  onClear,
  userId,
  onLoadSet,
  updatePlayer,
  onPlaySoundcloud,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [dragIndex, setDragIndex] = React.useState(null);
  // Local so dragging the slider only re-renders this panel, never the whole app.
  const [bpmThreshold, setBpmThreshold] = React.useState(6);

  // Saved-set persistence (Firestore).
  const [savedSets, setSavedSets] = React.useState([]);
  const [setName, setSetName] = React.useState("");
  const [loadedSetId, setLoadedSetId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const refreshSaved = React.useCallback(async () => {
    if (!userId) return;
    try {
      setSavedSets(await fetchSets(userId));
    } catch (e) {
      console.error("Failed to load saved sets", e);
    }
  }, [userId]);

  React.useEffect(() => {
    if (open) refreshSaved();
  }, [open, refreshSaved]);

  const handleSave = async (asNew) => {
    if (!userId || !setName.trim() || set.length === 0) return;
    setBusy(true);
    try {
      if (!asNew && loadedSetId) {
        await updateSet(userId, loadedSetId, {
          name: setName.trim(),
          bpmThreshold,
          set,
        });
      } else {
        const ref = await saveSet(userId, {
          name: setName.trim(),
          bpmThreshold,
          set,
        });
        setLoadedSetId(ref.id);
      }
      await refreshSaved();
    } catch (e) {
      console.error("Failed to save set", e);
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = (s) => {
    if (onLoadSet) onLoadSet(deserializeTracks(s.tracks));
    setLoadedSetId(s.id);
    setSetName(s.name || "");
    if (typeof s.bpmThreshold === "number") setBpmThreshold(s.bpmThreshold);
  };

  const handleDeleteSaved = async (s) => {
    if (!userId) return;
    try {
      await deleteSet(userId, s.id);
      if (loadedSetId === s.id) setLoadedSetId(null);
      await refreshSaved();
    } catch (e) {
      console.error("Failed to delete set", e);
    }
  };

  // Backfill key/BPM for SoundCloud entries added before analysis finished (or
  // loaded from a saved set without a key) — look them up in the shared
  // analysis cache. Keyed by the entry's track id (= the SC urn). Non-blocking:
  // already-analyzed tracks resolve instantly, others stay "analyzing…".
  const [scKeys, setScKeys] = React.useState({});
  React.useEffect(() => {
    let cancelled = false;
    (set || []).forEach((entry) => {
      const it = entry.item;
      if (!it || it.__source !== "soundcloud") return;
      if (entry.key && KeyMap[entry.key.key]) return; // already has a usable key
      const urn = it.track.id;
      if (!urn || scKeys[urn]) return;
      getScAnalysis(urn).then((a) => {
        if (cancelled || !a || !a.camelot) return;
        const km = camelotToKeyMode(a.camelot);
        if (!km) return;
        setScKeys((m) =>
          m[urn] ? m : { ...m, [urn]: { key: km.key, mode: km.mode, bpm: a.bpm } }
        );
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set]);

  // Play a set entry through the right source: SoundCloud → the Widget bottom
  // bar; Spotify → Web Playback.
  const playEntry = (item) => {
    if (item.__source === "soundcloud") {
      if (onPlaySoundcloud && item.__scRaw) onPlaySoundcloud(item.__scRaw);
    } else if (updatePlayer && item.track.uri) {
      updatePlayer([item.track.uri], true);
    }
  };

  const rows = set.map((entry) => {
    let k = entry.key && KeyMap[entry.key.key] ? entry.key : null;
    if (!k && entry.item.__source === "soundcloud") {
      k = scKeys[entry.item.track.id] || null;
    }
    return {
      item: entry.item,
      code: codeOf(k),
      bpm: k && k.bpm != null ? Math.round(k.bpm) : null,
    };
  });

  const transition = (a, b) => {
    if (!a.code || !b.code || a.bpm == null || b.bpm == null) return null;
    const keyCompatible = compatibleCamelot(a.code).has(b.code);
    const sameKey = a.code === b.code;
    const bpmDelta = b.bpm - a.bpm;
    const bpmPct = a.bpm ? (Math.abs(bpmDelta) / a.bpm) * 100 : 0;
    const bpmClash = bpmPct > bpmThreshold;
    return {
      keyCompatible,
      sameKey,
      bpmDelta,
      bpmPct,
      bpmClash,
      clash: !keyCompatible || bpmClash,
    };
  };

  const clashCount = rows.reduce((n, r, i) => {
    if (i === 0) return n;
    const t = transition(rows[i - 1], r);
    return n + (t && t.clash ? 1 : 0);
  }, 0);

  const handleDrop = (to) => {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to);
    setDragIndex(null);
  };

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      disableEnforceFocus
      disableScrollLock
      PaperProps={{
        style: {
          width: isMobile ? "100%" : 380,
          maxWidth: "100%",
          maxHeight: isMobile ? "85vh" : "100%",
          borderTopLeftRadius: isMobile ? 16 : 0,
          borderTopRightRadius: isMobile ? 16 : 0,
        },
      }}
    >
      <Box
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflowY: "auto",
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">Your Set ({set.length})</Typography>
          <IconButton size="small" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
        </Box>

        <Box style={{ margin: "8px 0 12px" }}>
          <Typography variant="caption" color="textSecondary">
            Flag BPM jumps over {bpmThreshold}%
          </Typography>
          <Slider
            value={bpmThreshold}
            min={1}
            max={20}
            step={1}
            valueLabelDisplay="auto"
            onChange={(e, v) => setBpmThreshold(v)}
          />
        </Box>

        {set.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            Add tracks with the + on each row to start building a set. Transitions
            are checked for key compatibility and BPM jumps as you go.
          </Typography>
        ) : (
          <>
            <Typography
              variant="caption"
              style={{
                color: clashCount ? "#c0392b" : "#2e7d32",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {clashCount
                ? `${clashCount} rough transition${clashCount > 1 ? "s" : ""}`
                : "All transitions smooth ✓"}
            </Typography>

            <Box>
              {rows.map((r, i) => (
                <React.Fragment key={`${r.item.track.id}-${i}`}>
                  <Box
                    draggable={!isMobile}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid rgba(128,128,128,0.25)",
                      opacity: dragIndex === i ? 0.5 : 1,
                    }}
                  >
                    {!isMobile && (
                      <DragIndicator
                        style={{ cursor: "grab", color: "#999", fontSize: 18 }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      style={{ width: 16, color: "#999" }}
                    >
                      {i + 1}
                    </Typography>
                    {r.code && (
                      <Chip
                        size="small"
                        label={r.code}
                        style={{
                          backgroundColor: camelotColor(r.code).bg,
                          color: camelotColor(r.code).text,
                        }}
                      />
                    )}
                    <Box
                      style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                      onClick={() => playEntry(r.item)}
                      title="Play"
                    >
                      <Typography
                        variant="body2"
                        style={{
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          overflow: "hidden",
                        }}
                      >
                        <span style={{ flexShrink: 0, display: "inline-flex" }}>
                          {r.item.__source === "soundcloud" ? (
                            <SoundcloudIcon size={13} color="#ff5500" />
                          ) : (
                            <SpotifyIcon size={13} color="#1ED760" />
                          )}
                        </span>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.item.track.name}
                        </span>
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {r.item.track.artists.map((a) => a.name).join(", ")}
                        {r.bpm != null ? ` · ${r.bpm} BPM` : " · analyzing…"}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      disabled={i === 0}
                      onClick={() => onReorder(i, i - 1)}
                      aria-label="move up"
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === rows.length - 1}
                      onClick={() => onReorder(i, i + 1)}
                      aria-label="move down"
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onRemove(i)}
                      aria-label="remove"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>

                  {i < rows.length - 1 &&
                    (() => {
                      const t = transition(rows[i], rows[i + 1]);
                      if (!t) return null;
                      return (
                        <Box
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 14px",
                            fontSize: 12,
                            color: t.clash ? "#c0392b" : "#2e7d32",
                          }}
                        >
                          <span>{t.clash ? "⚠" : "✓"}</span>
                          <span>
                            {t.sameKey
                              ? "same key"
                              : t.keyCompatible
                              ? "key compatible"
                              : "key clash"}
                          </span>
                          <span>
                            · {t.bpmDelta >= 0 ? "+" : ""}
                            {t.bpmDelta} BPM ({Math.round(t.bpmPct)}%)
                            {t.bpmClash ? " ⚠" : ""}
                          </span>
                        </Box>
                      );
                    })()}
                </React.Fragment>
              ))}
            </Box>

            <Button
              size="small"
              startIcon={<Delete />}
              onClick={onClear}
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              Clear set
            </Button>
          </>
        )}

        {/* Save the current set */}
        {set.length > 0 && userId && (
          <Box style={{ marginTop: 16 }}>
            <Divider style={{ marginBottom: 12 }} />
            <Box style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TextField
                size="small"
                variant="outlined"
                placeholder="Set name"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                style={{ flex: 1 }}
              />
              {loadedSetId ? (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={busy || !setName.trim()}
                    onClick={() => handleSave(false)}
                  >
                    Update
                  </Button>
                  <Button
                    size="small"
                    disabled={busy || !setName.trim()}
                    onClick={() => handleSave(true)}
                  >
                    Save new
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<Save />}
                  disabled={busy || !setName.trim()}
                  onClick={() => handleSave(true)}
                >
                  Save
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* Saved sets */}
        {userId && savedSets.length > 0 && (
          <Box style={{ marginTop: 20 }}>
            <Typography variant="overline" color="textSecondary">
              Saved sets
            </Typography>
            {savedSets.map((s) => (
              <Box
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                }}
              >
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    style={{
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                    {loadedSetId === s.id ? " (loaded)" : ""}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {(s.tracks || []).length} tracks
                  </Typography>
                </Box>
                <Button size="small" onClick={() => handleLoad(s)}>
                  Load
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteSaved(s)}
                  aria-label="delete saved set"
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default SetBuilder;
