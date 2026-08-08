// Windowed artwork grid.
//
// A large library is thousands of tiles; mounting them all would blow up the
// DOM and stall scrolling. This renders only the rows currently near the
// viewport and pads above/below with spacer divs, so scroll height and
// scrollbar behaviour stay correct.
//
// Deliberately hand-rolled rather than pulling in react-window: the grid is
// uniform square tiles, which is the one case where the maths is trivial, and
// it avoids adding a dependency to a CRA 5 app.

import React from "react";

const OVERSCAN_ROWS = 3;

export default function ArtworkGrid({
  tiles,
  tileSize = 180,
  gap = 12,
  onOpen,
  renderBadge,
  emptyMessage = "No artwork matches these filters.",
}) {
  const containerRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(
    typeof window === "undefined" ? 800 : window.innerHeight
  );

  // Track container width so the column count reflows with the sidebar,
  // drawer and window size.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The page itself scrolls, so window scroll drives the windowing maths.
  React.useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setScrollTop(Math.max(0, -rect.top));
      setViewportH(window.innerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tiles.length]);

  const cols = Math.max(1, Math.floor((width + gap) / (tileSize + gap))) || 1;
  const rowH = tileSize + gap;
  const rowCount = Math.ceil(tiles.length / cols);

  const firstRow = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN_ROWS);
  const lastRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + viewportH) / rowH) + OVERSCAN_ROWS
  );

  const visible = [];
  for (let r = firstRow; r < lastRow; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= tiles.length) break;
      visible.push({ tile: tiles[idx], idx });
    }
  }

  const padTop = firstRow * rowH;
  const padBottom = Math.max(0, (rowCount - lastRow) * rowH);

  if (!tiles.length) {
    return (
      <div
        ref={containerRef}
        style={{ padding: "48px 0", textAlign: "center", opacity: 0.6 }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div style={{ height: padTop }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gap,
          justifyContent: "center",
        }}
      >
        {visible.map(({ tile, idx }) => (
          <ArtworkTile
            key={tile.id}
            tile={tile}
            size={tileSize}
            onOpen={() => onOpen(idx)}
            badge={renderBadge ? renderBadge(tile) : null}
          />
        ))}
      </div>
      <div style={{ height: padBottom }} />
    </div>
  );
}

// Memoized so scrolling only mounts genuinely new tiles rather than
// re-rendering the whole visible window on every scroll tick.
const ArtworkTile = React.memo(function ArtworkTile({
  tile,
  size,
  onOpen,
  badge,
}) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${tile.albumName} — ${tile.artistNames.join(", ")}${
        tile.trackCount > 1 ? ` (${tile.trackCount} tracks)` : ""
      }`}
      style={{
        width: size,
        height: size,
        padding: 0,
        border: "none",
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        background: "rgba(128,128,128,0.15)",
        display: "block",
      }}
    >
      <img
        src={tile.url300}
        alt={tile.albumName}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 180ms ease",
        }}
      />
      {badge}
    </button>
  );
});
