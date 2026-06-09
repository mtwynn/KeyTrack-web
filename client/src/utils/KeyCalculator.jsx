import React from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import CamelotWheel from "../components/PLLibrary/CamelotWheel";
import { camelotColor, camelotInfo, compatibleCamelot } from "./harmonic";

// Interactive key calculator: tap a key on the Camelot wheel to see it in all
// three notations (Musical / Camelot / Open) at once, plus its harmonic matches.
let KeyCalculator = (props) => {
  const { onClose, open } = props;
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));

  // Default to C Major (8B).
  const [code, setCode] = React.useState("8B");
  const info = camelotInfo(code);
  const color = camelotColor(code);
  const compatible = [...compatibleCamelot(code)].filter((c) => c !== code);

  const notations = info
    ? [
        { label: "Musical", value: `${info.musical} ${info.quality}` },
        { label: "Camelot", value: code },
        { label: "Open Key", value: info.open },
      ]
    : [];

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="xs">
      <DialogTitle>Key Calculator</DialogTitle>
      <DialogContent>
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ display: "block", textAlign: "center", marginBottom: 4 }}
        >
          Tap a key on the wheel to convert between notations
        </Typography>

        <Box style={{ display: "flex", justifyContent: "center" }}>
          <CamelotWheel
            selected={[code]}
            onToggle={(c) => setCode(c)}
            labelMode="combined"
          />
        </Box>

        {info && (
          <>
            <Box
              style={{
                backgroundColor: color.bg,
                color: color.text,
                padding: 12,
                borderRadius: 10,
                textAlign: "center",
                margin: "8px 0 16px",
              }}
            >
              <Typography variant="h5" style={{ fontWeight: 700 }}>
                {info.musical} {info.quality}
              </Typography>
            </Box>

            <Box style={{ display: "flex", gap: 8 }}>
              {notations.map((n) => (
                <Box
                  key={n.label}
                  style={{
                    flex: 1,
                    padding: "10px 6px",
                    borderRadius: 8,
                    border: `1px solid ${theme.palette.divider}`,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="overline" color="textSecondary">
                    {n.label}
                  </Typography>
                  <Typography variant="h6">{n.value}</Typography>
                </Box>
              ))}
            </Box>

            <Typography
              variant="overline"
              color="textSecondary"
              style={{ display: "block", marginTop: 16 }}
            >
              Mixes harmonically with
            </Typography>
            <Box style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {compatible.map((c) => {
                const cc = camelotColor(c);
                const ci = camelotInfo(c);
                return (
                  <Chip
                    key={c}
                    size="small"
                    label={ci ? `${c} · ${ci.musical} ${ci.quality === "Major" ? "Maj" : "Min"}` : c}
                    onClick={() => setCode(c)}
                    style={cc ? { backgroundColor: cc.bg, color: cc.text } : {}}
                  />
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KeyCalculator;
