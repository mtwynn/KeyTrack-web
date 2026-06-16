import React from "react";
import { Box, Typography, Chip } from "@material-ui/core";

import KeyMap from "../../utils/KeyMap";
import { camelotColor } from "../../utils/harmonic";

// A quick visual "DNA" of a crate: key distribution (Camelot bars) and a BPM
// histogram, plus a one-line summary. Computed over the whole crate's tracks.
//
// Two ways to read each track's harmonic data:
//   - getKey(id) -> { key, mode, bpm, energy, ... }   (Spotify Playlist usage)
//   - getCamelot(item) -> Camelot code directly       (combined/unified tracks)
// When `getCamelot` is supplied it takes precedence and we read Camelot/BPM/
// major-minor straight off the item (the unified shape carries .camelot/.bpm/
// .mode). When it's absent the component behaves exactly as before.
const CrateDNA = ({ items, getKey, getCamelot }) => {
  const data = React.useMemo(() => {
    const keyCounts = {};
    const bpms = [];
    let major = 0;
    let minor = 0;
    let energy = 0;
    let dance = 0;
    let valence = 0;
    let vibeN = 0;
    (items || []).forEach((item) => {
      if (getCamelot) {
        // Unified-track path: Camelot comes straight from the item.
        const code = getCamelot(item);
        if (!code) return;
        keyCounts[code] = (keyCounts[code] || 0) + 1;
        if (item && item.bpm != null) bpms.push(Math.round(item.bpm));
        // The trailing letter encodes mode: "B" = major, "A" = minor.
        if (String(code).slice(-1) === "B") major += 1;
        else minor += 1;
        if (item && item.energy != null) {
          energy += item.energy;
          vibeN += 1;
        }
        return;
      }
      const k = item && item.track && getKey(item.track.id);
      if (!k) return;
      const code = KeyMap[k.key].camelot[k.mode];
      keyCounts[code] = (keyCounts[code] || 0) + 1;
      bpms.push(Math.round(k.bpm));
      if (k.mode === 1) major += 1;
      else minor += 1;
      if (k.energy != null) {
        energy += k.energy;
        dance += k.danceability || 0;
        valence += k.valence || 0;
        vibeN += 1;
      }
    });
    return {
      keyCounts,
      bpms,
      major,
      minor,
      energy: vibeN ? energy / vibeN : null,
      dance: vibeN ? dance / vibeN : null,
      valence: vibeN ? valence / vibeN : null,
    };
  }, [items, getKey, getCamelot]);

  const total = data.major + data.minor;
  if (total === 0) {
    return (
      <Typography variant="body2" color="textSecondary" style={{ padding: 8 }}>
        No key/BPM data for this crate.
      </Typography>
    );
  }

  const keyEntries = Object.entries(data.keyCounts).sort((a, b) => {
    const na = parseInt(a[0], 10);
    const nb = parseInt(b[0], 10);
    if (na !== nb) return na - nb;
    return a[0].slice(-1).localeCompare(b[0].slice(-1));
  });
  const maxKeyCount = Math.max(...keyEntries.map((e) => e[1]));
  const dominant = keyEntries.reduce(
    (m, e) => (e[1] > m[1] ? e : m),
    keyEntries[0]
  );

  // BPMs can be empty in the unified path (a track with a Camelot but no BPM
  // yet); guard so we never render Infinity/NaN. The Spotify path always has a
  // BPM whenever it has a key, so it's unaffected.
  const hasBpm = data.bpms.length > 0;
  const bpmMin = hasBpm ? Math.min(...data.bpms) : null;
  const bpmMax = hasBpm ? Math.max(...data.bpms) : null;
  const bins = {};
  data.bpms.forEach((b) => {
    const k = Math.floor(b / 10) * 10;
    bins[k] = (bins[k] || 0) + 1;
  });
  const binEntries = Object.entries(bins)
    .map(([k, v]) => [parseInt(k, 10), v])
    .sort((a, b) => a[0] - b[0]);
  const maxBin = hasBpm ? Math.max(...binEntries.map((e) => e[1])) : 0;

  return (
    <Box style={{ padding: "8px 4px" }}>
      <Box style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Chip size="small" label={`${total} tracks`} />
        {hasBpm && <Chip size="small" label={`${bpmMin}–${bpmMax} BPM`} />}
        <Chip
          size="small"
          label={`Dominant ${dominant[0]}`}
          style={{
            backgroundColor: camelotColor(dominant[0]).bg,
            color: camelotColor(dominant[0]).text,
          }}
        />
        <Chip
          size="small"
          label={`${Math.round((data.major / total) * 100)}% maj · ${Math.round(
            (data.minor / total) * 100
          )}% min`}
        />
        {data.energy != null && (
          <Chip
            size="small"
            label={`Energy ${Math.round(data.energy * 100)}% · Dance ${Math.round(
              data.dance * 100
            )}% · Valence ${Math.round(data.valence * 100)}%`}
          />
        )}
      </Box>

      <Typography variant="overline" color="textSecondary">
        Key distribution
      </Typography>
      <Box style={{ marginBottom: 14 }}>
        {keyEntries.map(([code, count]) => {
          const c = camelotColor(code);
          return (
            <Box
              key={code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span style={{ width: 36, fontSize: 11, fontWeight: 600 }}>
                {code}
              </span>
              <Box
                style={{
                  flex: 1,
                  background: "rgba(128,128,128,0.12)",
                  borderRadius: 3,
                }}
              >
                <Box
                  style={{
                    width: `${(count / maxKeyCount) * 100}%`,
                    background: c.bg,
                    height: 14,
                    borderRadius: 3,
                    minWidth: 2,
                  }}
                />
              </Box>
              <span
                style={{
                  width: 24,
                  fontSize: 11,
                  textAlign: "right",
                  color: "#888",
                }}
              >
                {count}
              </span>
            </Box>
          );
        })}
      </Box>

      {hasBpm && (
        <>
          <Typography variant="overline" color="textSecondary">
            BPM distribution
          </Typography>
          <Box
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 3,
              height: 80,
              marginTop: 4,
            }}
          >
            {binEntries.map(([bin, count]) => (
              <Box
                key={bin}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
                title={`${bin}-${bin + 9} BPM: ${count}`}
              >
                <Box
                  style={{
                    width: "100%",
                    background: "#1ED760",
                    height: Math.max(2, Math.round((count / maxBin) * 64)),
                    borderRadius: "3px 3px 0 0",
                  }}
                />
                <span style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                  {bin}
                </span>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default CrateDNA;
