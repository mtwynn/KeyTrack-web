import React from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Typography,
} from "@material-ui/core";
import { Close } from "@material-ui/icons";

import CamelotWheel from "./CamelotWheel";
import PianoSelector from "./PianoSelector";
import { camelotColor, camelotInfo, musicalLabel } from "../../utils/harmonic";

// Bottom-sheet key-filter picker. Works on desktop and mobile: slides up from
// the bottom, scrolls if needed, and never blocks the whole screen.
//
// Two styles, chosen by `filterMode` (a saved user setting):
//   - "notation": the input follows the Notation selector — Piano for Musical,
//     Camelot wheel for Camelot, Open-labelled wheel for Open.
//   - "combined": one wheel showing Camelot + musical key together (always).
//
// Selections are Camelot codes, shared across every style, so switching the
// notation or style never clears the filter.

const chipLabel = (code, notation) => {
  if (notation === "Open") return camelotInfo(code) ? camelotInfo(code).open : code;
  if (notation === "Musical") return musicalLabel(code);
  return code;
};

const KeyFilterPicker = ({
  open,
  onClose,
  notation,
  selected,
  onToggle,
  onClear,
  filterMode,
  onChangeFilterMode,
}) => {
  let surface;
  if (filterMode === "combined") {
    surface = (
      <CamelotWheel selected={selected} onToggle={onToggle} labelMode="combined" />
    );
  } else if (notation === "Musical") {
    surface = <PianoSelector selected={selected} onToggle={onToggle} />;
  } else if (notation === "Open") {
    surface = (
      <CamelotWheel selected={selected} onToggle={onToggle} labelMode="open" />
    );
  } else {
    surface = (
      <CamelotWheel selected={selected} onToggle={onToggle} labelMode="camelot" />
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      disableEnforceFocus
      disableScrollLock
      PaperProps={{
        style: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "88vh",
        },
      }}
    >
      <Box style={{ padding: 16, overflowY: "auto" }}>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Typography variant="h6">Filter by key</Typography>
          <IconButton size="small" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
        </Box>

        <Box
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="caption" color="textSecondary">
            Picker style:
          </Typography>
          {[
            { key: "notation", label: "By notation" },
            { key: "combined", label: "Combined wheel" },
          ].map((m) => (
            <Button
              key={m.key}
              size="small"
              variant={filterMode === m.key ? "contained" : "outlined"}
              color={filterMode === m.key ? "primary" : "default"}
              onClick={() => onChangeFilterMode(m.key)}
              style={{ textTransform: "none" }}
            >
              {m.label}
            </Button>
          ))}
        </Box>

        <Box style={{ display: "flex", justifyContent: "center" }}>{surface}</Box>

        <Box style={{ marginTop: 16 }}>
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <Typography variant="caption" color="textSecondary">
              {selected.length
                ? `${selected.length} key${selected.length > 1 ? "s" : ""} selected`
                : "No keys selected"}
            </Typography>
            <Button
              size="small"
              onClick={onClear}
              disabled={selected.length === 0}
            >
              Clear
            </Button>
          </Box>
          <Box style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.map((code) => {
              const c = camelotColor(code);
              return (
                <Chip
                  key={code}
                  size="small"
                  label={chipLabel(code, notation)}
                  onDelete={() => onToggle(code)}
                  style={c ? { backgroundColor: c.bg, color: c.text } : {}}
                />
              );
            })}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default KeyFilterPicker;
