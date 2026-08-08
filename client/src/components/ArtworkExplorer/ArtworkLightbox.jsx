// Full-view lightbox: the enlarged artwork plus everything that makes it useful
// as a design reference — palette with copy-to-clipboard hex, vibe tags,
// Gemini's read of the image, genres, and find-similar.
//
// 640px is Spotify's maximum artwork size; there is no higher-resolution
// source available through the API.

import React from "react";
import {
  Box,
  Chip,
  Dialog,
  IconButton,
  Tooltip,
  Typography,
} from "@material-ui/core";
import {
  ChevronLeft,
  ChevronRight,
  Close,
  CollectionsBookmark,
  DeleteOutline,
  FindReplace,
  OpenInNew,
  ZoomOutMap,
} from "@material-ui/icons";

function PaletteStrip({ palette }) {
  const [copied, setCopied] = React.useState(null);

  const copy = (hex) => {
    // Clipboard API needs a secure context; fall back to a temp input so this
    // still works over plain http on a LAN dev box.
    const done = () => {
      setCopied(hex);
      setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(hex).then(done).catch(() => {});
      return;
    }
    const el = document.createElement("input");
    el.value = hex;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
      done();
    } finally {
      document.body.removeChild(el);
    }
  };

  if (!palette || !palette.length) return null;

  return (
    <Box>
      <Typography variant="overline" color="textSecondary">
        Palette — click to copy
      </Typography>
      <Box style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {palette.map((c) => (
          <Tooltip key={c.hex} title={copied === c.hex ? "Copied!" : c.hex}>
            <button
              type="button"
              onClick={() => copy(c.hex)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.35)",
                background: c.hex,
                cursor: "pointer",
                padding: 0,
              }}
              aria-label={`Copy ${c.hex}`}
            />
          </Tooltip>
        ))}
      </Box>
      <Typography
        variant="caption"
        color="textSecondary"
        style={{ display: "block", marginTop: 6, fontFamily: "monospace" }}
      >
        {palette.map((c) => c.hex).join("  ")}
      </Typography>
    </Box>
  );
}

export default function ArtworkLightbox({
  tiles,
  index,
  onClose,
  onNavigate,
  vibe,
  semantic,
  genresFor,
  onFindSimilar,
  onSaveToBoard,
  onRemoveFromBoard,
  savedBoardNames,
}) {
  const tile = tiles[index];

  // Arrow keys page through the gallery; Escape closes. Bound at document level
  // so it works regardless of which element inside the dialog has focus.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") onNavigate(1);
      else if (e.key === "ArrowLeft") onNavigate(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNavigate]);

  if (!tile) return null;

  const v = vibe ? vibe.get(tile.albumId) : null;
  const s = semantic ? semantic.get(tile.albumId) : null;
  const genres = genresFor ? genresFor(tile) : [];

  return (
    <Dialog open fullWidth maxWidth="xl" onClose={onClose}>
      <Box style={{ display: "flex", flexWrap: "wrap", position: "relative" }}>
        <IconButton
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
          aria-label="Close"
        >
          <Close />
        </IconButton>

        {/* Image side */}
        <Box
          style={{
            flex: "1 1 560px",
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            // A fixed pane height gives the image something to fill. Without
            // it the <img> only ever gets its natural size, which is why a
            // 640px cover used to sit tiny in the middle of a huge black box.
            height: "min(82vh, 860px)",
            minHeight: 360,
            padding: 8,
            boxSizing: "border-box",
          }}
        >
          <IconButton
            onClick={() => onNavigate(-1)}
            style={{ position: "absolute", left: 4, color: "#fff", zIndex: 2 }}
            aria-label="Previous artwork"
          >
            <ChevronLeft fontSize="large" />
          </IconButton>
          <img
            src={tile.url640}
            alt={tile.albumName}
            style={{
              // width/height 100% + contain scales UP to fill the pane while
              // preserving the square aspect; max-* alone never upscales.
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
          <IconButton
            onClick={() => onNavigate(1)}
            style={{ position: "absolute", right: 4, color: "#fff", zIndex: 2 }}
            aria-label="Next artwork"
          >
            <ChevronRight fontSize="large" />
          </IconButton>
        </Box>

        {/* Metadata side */}
        <Box
          style={{
            flex: "1 1 340px",
            padding: 20,
            maxWidth: 440,
            maxHeight: "min(82vh, 860px)",
            overflowY: "auto",
          }}
        >
          <Typography variant="h6">{tile.albumName}</Typography>
          <Typography variant="body2" color="textSecondary">
            {tile.artistNames.join(", ")}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {tile.releaseYear ? `${tile.releaseYear} · ` : ""}
            {tile.trackCount || 0} track{tile.trackCount === 1 ? "" : "s"} saved
            {tile.playlistNames && tile.playlistNames.length
              ? ` · ${tile.playlistNames.slice(0, 3).join(", ")}${
                  tile.playlistNames.length > 3
                    ? ` +${tile.playlistNames.length - 3}`
                    : ""
                }`
              : ""}
          </Typography>
          {tile.trackNames && tile.trackNames.length > 0 && (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "block", marginTop: 4, fontStyle: "italic" }}
            >
              {tile.trackNames.slice(0, 4).join(" · ")}
              {tile.trackNames.length > 4 ? " …" : ""}
            </Typography>
          )}

          <Box style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <Tooltip title="Open in Spotify">
              <IconButton
                size="small"
                onClick={() => window.open(tile.uri, "_blank")}
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open the full-size image file (640×640 — Spotify's maximum)">
              <IconButton
                size="small"
                onClick={() => window.open(tile.url640, "_blank", "noopener")}
              >
                <ZoomOutMap fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Find visually similar artwork">
              <span>
                <IconButton
                  size="small"
                  onClick={() => onFindSimilar(tile)}
                  disabled={!onFindSimilar}
                >
                  <FindReplace fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Save to a mood board">
              <IconButton size="small" onClick={() => onSaveToBoard(tile)}>
                <CollectionsBookmark fontSize="small" />
              </IconButton>
            </Tooltip>
            {onRemoveFromBoard && (
              <Tooltip title="Remove from this board">
                <IconButton size="small" onClick={onRemoveFromBoard}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {savedBoardNames && savedBoardNames.length > 0 && (
            <Typography
              variant="caption"
              color="primary"
              style={{ display: "block", marginTop: 4 }}
            >
              On board: {savedBoardNames.join(", ")}
            </Typography>
          )}

          <Box style={{ marginTop: 16 }}>
            <PaletteStrip palette={v && v.palette} />
          </Box>

          {v && v.tags && v.tags.length > 0 && (
            <Box style={{ marginTop: 16 }}>
              <Typography variant="overline" color="textSecondary">
                Vibe
              </Typography>
              <Box style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {v.tags.map((t) => (
                  <Chip key={t} label={t} size="small" />
                ))}
              </Box>
            </Box>
          )}

          {s && (
            <Box style={{ marginTop: 16 }}>
              <Typography variant="overline" color="textSecondary">
                In this image
              </Typography>
              {s.description && (
                <Typography variant="body2" style={{ marginTop: 4 }}>
                  {s.description}
                </Typography>
              )}
              <Box style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {[...(s.subjects || []), ...(s.topics || []), ...(s.style || []), ...(s.mood || [])]
                  .slice(0, 18)
                  .map((t) => (
                    <Chip key={t} label={t} size="small" variant="outlined" />
                  ))}
              </Box>
            </Box>
          )}

          {genres.length > 0 && (
            <Box style={{ marginTop: 16 }}>
              <Typography variant="overline" color="textSecondary">
                Genre
              </Typography>
              <Box style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {genres.slice(0, 8).map((g) => (
                  <Chip key={g} label={g} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}

          <Typography
            variant="caption"
            color="textSecondary"
            style={{ display: "block", marginTop: 20 }}
          >
            {index + 1} of {tiles.length} · ← → to browse, Esc to close
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
