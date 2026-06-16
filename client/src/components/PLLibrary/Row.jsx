import React from "react";
import { Avatar, TableCell, TableRow, IconButton } from "@material-ui/core";
import PlaylistAddIcon from "@material-ui/icons/PlaylistAdd";

import KeyMap from "../../utils/KeyMap";
import { camelotColor, harmonicRelation } from "../../utils/harmonic";
import { formatReleaseDate } from "../../utils/release";
import { SpotifyIcon, SoundcloudIcon } from "../BrandIcons";

let Row = (props) => {
  const { item } = props;

  // Key/Camelot info for this track, computed once.
  const trackKey = props.getKey(item.track.id);
  const camelot = trackKey ? KeyMap[trackKey.key].camelot[trackKey.mode] : null;
  const keyColor = camelot ? camelotColor(camelot) : null;

  // Label for the single key column, rendered in the selected notation. On
  // mobile (no separate Quality column) the musical key includes Maj/Min.
  let keyLabel = null;
  if (trackKey) {
    if (props.wheel === "Camelot") {
      keyLabel = camelot;
    } else if (props.wheel === "Open") {
      keyLabel = KeyMap[trackKey.key].open[trackKey.mode];
    } else {
      keyLabel = `${KeyMap[trackKey.key].key}${
        props.isMobile ? (trackKey.mode === 1 ? " Maj" : " Min") : ""
      }`;
    }
  }

  // Harmonic-mixing highlight relative to the anchored track (if any).
  const isAnchor = props.harmonicAnchorId === item.track.id;
  const relation = harmonicRelation(
    props.harmonicAnchorCamelot,
    camelot,
    isAnchor
  );

  const rowStyle = { cursor: "pointer" };
  if (relation === "incompatible") rowStyle.opacity = 0.4;
  if (relation === "compatible")
    rowStyle.backgroundColor = "rgba(30, 215, 96, 0.12)";
  if (relation === "anchor") {
    rowStyle.backgroundColor = "rgba(30, 215, 96, 0.2)";
    rowStyle.boxShadow = `inset 3px 0 0 ${keyColor ? keyColor.bg : "#1ED760"}`;
  }

  // A colored, clickable pill for a key value. Clicking anchors this track so
  // its harmonic matches light up across the table.
  const keyChip = (label) => (
    <span
      onClick={(e) => {
        e.stopPropagation();
        if (props.onToggleAnchor) props.onToggleAnchor(item);
      }}
      title="Click to highlight harmonic matches"
      style={
        keyColor
          ? {
              backgroundColor: keyColor.bg,
              color: keyColor.text,
              padding: "3px 10px",
              borderRadius: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-block",
              whiteSpace: "nowrap",
            }
          : {}
      }
    >
      {label}
    </span>
  );

  // Combined-view only: SoundCloud rows can't be added to the Spotify set, so
  // the add button is suppressed; for no-__source (Spotify) rows it's unchanged.
  const isSoundcloud = item.__source === "soundcloud";
  const addButton = isSoundcloud ? null : (
    <IconButton
      aria-label="add to set"
      size="small"
      title="Add to set"
      onClick={(e) => {
        e.stopPropagation();
        if (props.onAddToSet) props.onAddToSet(item);
      }}
    >
      <PlaylistAddIcon fontSize="small" />
    </IconButton>
  );

  // A tiny brand badge pinned to a cover's bottom-right corner. Only rendered in
  // the combined view (item.__source set) — Spotify-only rows get nothing, so
  // their cover Avatars are byte-for-byte unchanged.
  const sourceBadge = !item.__source ? null : isSoundcloud ? (
    <a
      href={item.__scRaw ? item.__scRaw.permalink_url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open on SoundCloud"
      style={{
        position: "absolute",
        right: -3,
        bottom: -3,
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: "#ff5500",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 1.5px #fff",
      }}
    >
      <SoundcloudIcon size={10} color="#fff" />
    </a>
  ) : (
    <span
      title="Spotify"
      style={{
        position: "absolute",
        right: -3,
        bottom: -3,
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: "#1ED760",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 1.5px #fff",
        pointerEvents: "none",
      }}
    >
      <SpotifyIcon size={10} color="#fff" />
    </span>
  );

  // Wrap an Avatar so the source badge can sit in its corner. Without a badge
  // (Spotify-only rows) the Avatar is returned as-is — no wrapper, no change.
  const withBadge = (avatar, wrapperStyle) =>
    sourceBadge ? (
      <div style={{ position: "relative", display: "inline-flex", ...wrapperStyle }}>
        {avatar}
        {sourceBadge}
      </div>
    ) : (
      avatar
    );

  return (
    <TableRow
      key={item.track.id}
      hover
      style={rowStyle}
      onClick={(event) => props.handleRowClick(event, item)}
    >
      {!props.isMobile && <TableCell>{addButton}</TableCell>}
      {!props.isMobile && (
        <TableCell>
          {withBadge(
            <Avatar
              variant="square"
              src={
                item.track.album.images[0]
                  ? item.track.album.images[0].url
                  : null
              }
            ></Avatar>
          )}
        </TableCell>
      )}
      <TableCell>
        {props.isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            {withBadge(
              <Avatar
                variant="square"
                src={
                  item.track.album.images[0]
                    ? item.track.album.images[0].url
                    : null
                }
                style={{ width: 40, height: 40 }}
              ></Avatar>
            )}
            {addButton}
          </div>
        )}
        <div style={{ fontWeight: "bold" }}>{item.track.name}</div>
        {props.isMobile && (
          <div style={{ fontSize: "0.875rem", color: "#666", marginTop: "4px" }}>
            {item.track.artists.map((artist) => artist.name).join(", ")}
            {" · "}
            {formatReleaseDate(item.track)}
          </div>
        )}
      </TableCell>
      {!props.isMobile && (
        <TableCell>
          {item.track.artists.map((artist) => artist.name).join(", ")}
        </TableCell>
      )}
      <TableCell>{trackKey ? keyChip(keyLabel) : "N/A"}</TableCell>
      {!props.isMobile && (
        <TableCell>
          {trackKey ? (trackKey.mode === 1 ? "Major" : "Minor") : "N/A"}
        </TableCell>
      )}
      <TableCell>{trackKey ? Math.round(trackKey.bpm) : "N/A"}</TableCell>
      {!props.isTablet && (
        <TableCell style={{ whiteSpace: "nowrap" }}>
          {formatReleaseDate(item.track)}
        </TableCell>
      )}
      {!props.isTablet && (
        <TableCell>
          {trackKey && trackKey.energy != null ? (
            <div
              title={`Energy ${Math.round(trackKey.energy * 100)}%`}
              style={{
                width: 46,
                height: 6,
                background: "rgba(128,128,128,0.2)",
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  width: `${Math.round(trackKey.energy * 100)}%`,
                  height: 6,
                  borderRadius: 3,
                  background: `hsl(${(1 - trackKey.energy) * 200}, 75%, 48%)`,
                }}
              />
            </div>
          ) : (
            "—"
          )}
        </TableCell>
      )}
    </TableRow>
  );
};

// Memoized so rows skip re-rendering when Playlist re-renders without their
// props changing (e.g. when an unrelated app-level dialog opens).
export default React.memo(Row);
