import { createMuiTheme } from "@material-ui/core/styles";

// Spotify green, used as the primary accent across both themes.
const GREEN = "#1ED760";
const GREEN_DARK = "#1DB954";

const fontFamily = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(",");

// Build a Material-UI theme for the given mode ("light" | "dark"). The shell
// (hero, tiles, app bar, dialogs) reads from these palette values so flipping
// the toggle restyles the whole app.
export const makeAppTheme = (mode) =>
  createMuiTheme({
    palette: {
      type: mode,
      primary: { main: GREEN, dark: GREEN_DARK, contrastText: "#ffffff" },
      ...(mode === "dark"
        ? {
            background: { default: "#121212", paper: "#1c1c1c" },
            text: { primary: "#f5f5f5", secondary: "#a8a8a8" },
          }
        : {
            background: { default: "#fafafa", paper: "#ffffff" },
            text: { primary: "#191414", secondary: "#6b7280" },
          }),
    },
    typography: { fontFamily },
    shape: { borderRadius: 12 },
  });

export const THEME_STORAGE_KEY = "keytrack_theme";
