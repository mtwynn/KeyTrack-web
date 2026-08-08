// Artwork Explorer — browse every cover in your library as a visual reference
// library, and search it by vibe, content and genre.
//
// Three views: Albums (1:1 with playlists), a single album's gallery, and a
// flattened All Artwork view across every playlist. Boards collect references
// for a specific release.

import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import {
  ArrowBack,
  Clear,
  CollectionsBookmark,
  Search,
} from "@material-ui/icons";

import ArtworkGrid from "./ArtworkGrid";
import ArtworkLightbox from "./ArtworkLightbox";
import { buildArtworkIndex, clearArtworkIndexMemo, uniqueArtistIds } from "../../utils/artworkIndex";
import {
  loadVibeCache,
  runVibeAnalysis,
  supportsVibeAnalysis,
} from "../../utils/artworkAnalysis";
import { ALL_VIBE_TAGS } from "../../utils/artworkVibe";
import {
  cosineInt8,
  embedQuery,
  fetchSemanticStatus,
  loadSemanticCache,
  runSemanticAnalysis,
} from "../../utils/artworkSemantic";
import {
  fetchArtistGenres,
  loadArtistGenres,
  parentGenre,
} from "../../utils/artistGenres";
import {
  addToBoard,
  boardsContaining,
  createBoard,
  deleteBoard,
  loadBoards,
  removeFromBoard,
} from "../../utils/artworkBoards";

const SORTS = [
  { key: "default", label: "Playlist order" },
  { key: "brightness", label: "Brightness" },
  { key: "hue", label: "Colour (hue)" },
  { key: "saturation", label: "Saturation" },
  { key: "release", label: "Release date" },
  { key: "album", label: "Album name" },
  { key: "artist", label: "Artist" },
  { key: "tracks", label: "Tracks you saved" },
];

export default function ArtworkExplorer({
  spotifyWebApi,
  spotifyRetry,
  playlists,
  backendBase,
  onExit,
}) {
  const [phase, setPhase] = React.useState("idle");
  const [index, setIndex] = React.useState(null);
  const [progress, setProgress] = React.useState(null);

  const [vibe, setVibe] = React.useState(new Map());
  const [semantic, setSemantic] = React.useState(new Map());
  const [genres, setGenres] = React.useState(new Map());
  const [semanticAvailable, setSemanticAvailable] = React.useState(false);
  const [semanticInfo, setSemanticInfo] = React.useState({});
  const [semanticRun, setSemanticRun] = React.useState(null);

  const [view, setView] = React.useState({ kind: "albums" });
  const [query, setQuery] = React.useState("");
  const [activeTags, setActiveTags] = React.useState([]);
  const [genreFilter, setGenreFilter] = React.useState("");
  const [sort, setSort] = React.useState("default");
  const [lightbox, setLightbox] = React.useState(null);
  const [semanticRanking, setSemanticRanking] = React.useState(null);

  const [boards, setBoards] = React.useState(loadBoards);
  const [boardPicker, setBoardPicker] = React.useState(null);
  const [forceRebuild, setForceRebuild] = React.useState(0);

  const cancelRef = React.useRef({ current: false });

  // --- initial load -------------------------------------------------------
  React.useEffect(() => {
    let alive = true;
    const cancel = cancelRef.current;
    (async () => {
      setPhase("indexing");
      const idx = await buildArtworkIndex({
        spotifyWebApi,
        spotifyRetry,
        playlists,
        onProgress: (p) => alive && setProgress({ kind: "index", ...p }),
        cancelRef: cancel,
        force: forceRebuild,
      });
      if (!alive) return;
      setIndex(idx);
      setPhase("ready");
      setProgress(null);

      const [vibeCache, semCache, genreCache, status] = await Promise.all([
        loadVibeCache(),
        loadSemanticCache(),
        loadArtistGenres(),
        fetchSemanticStatus(backendBase),
      ]);
      if (!alive) return;
      setVibe(new Map(vibeCache));
      setSemantic(new Map(semCache));
      setGenres(new Map(genreCache));
      setSemanticAvailable(!!status.semanticAvailable);
      setSemanticInfo(status);

      // Colour/mood analysis is free and fast, so it always runs on its own.
      if (supportsVibeAnalysis()) {
        setProgress({ kind: "vibe", done: 0, total: idx.covers.size });
        await runVibeAnalysis({
          covers: idx.covers,
          cache: vibeCache,
          onProgress: (p) => alive && setProgress({ kind: "vibe", ...p }),
          cancelRef: cancel,
        });
        if (!alive) return;
        setVibe(new Map(vibeCache));
        setProgress(null);
      }

      // Genres cost ~1 request per 50 artists and are cached forever.
      const ids = uniqueArtistIds(idx.tiles);
      await fetchArtistGenres({
        artistIds: ids,
        cache: genreCache,
        spotifyWebApi,
        spotifyRetry,
        cancelRef: cancel,
      });
      if (!alive) return;
      setGenres(new Map(genreCache));
    })();

    return () => {
      alive = false;
      cancel.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceRebuild]);

  // --- semantic pass (explicit, because it costs money) -------------------
  const runSemantic = async () => {
    if (!index) return;
    const cache = new Map(semantic);
    setSemanticRun({ done: 0, total: index.covers.size });
    const res = await runSemanticAnalysis({
      covers: index.covers,
      cache,
      backendBase,
      batchSize: semanticInfo.maxBatch || 4,
      onProgress: (p) => {
        setSemanticRun(p);
        // Surface partial results as they land so the gallery becomes
        // searchable during a long run rather than only at the end.
        setSemantic(new Map(cache));
      },
      cancelRef: cancelRef.current,
    });
    setSemantic(new Map(cache));
    setSemanticRun({ ...res, finished: true });
  };

  const genresFor = React.useCallback(
    (tile) => {
      const out = new Set();
      (tile.artistIds || []).forEach((id) => {
        (genres.get(id) || []).forEach((g) => out.add(g));
      });
      return [...out];
    },
    [genres]
  );

  // --- the tile set currently being browsed -------------------------------
  const baseTiles = React.useMemo(() => {
    if (!index) return [];
    if (view.kind === "album") {
      const album = index.albums.find((a) => a.id === view.albumId);
      return album ? album.tiles : [];
    }
    if (view.kind === "board") {
      const board = boards.find((b) => b.id === view.boardId);
      if (!board) return [];
      // Board entries are self-contained; adapt them to the tile shape.
      return board.items.map((i) => ({
        id: `board:${i.albumId}`,
        albumId: i.albumId,
        albumName: i.albumName || "",
        artistNames: i.artistNames || [],
        artistIds: [],
        releaseYear: "",
        trackNames: [],
        trackCount: i.trackCount || 0,
        playlistNames: [board.name],
        uri: i.uri,
        url300: i.url300,
        url640: i.url640,
      }));
    }
    return index.tiles;
  }, [index, view, boards]);

  const allGenres = React.useMemo(() => {
    const counts = new Map();
    genres.forEach((list) => {
      list.forEach((g) => {
        const p = parentGenre(g) || g;
        counts.set(p, (counts.get(p) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [genres]);

  const tiles = React.useMemo(() => {
    let out = baseTiles;
    const q = query.trim().toLowerCase();

    if (q && !semanticRanking) {
      out = out.filter((t) => {
        const s = semantic.get(t.albumId);
        const hay = [
          (t.trackNames || []).join(" "),
          t.albumName,
          t.artistNames.join(" "),
          (t.playlistNames || []).join(" "),
          s ? s.description : "",
          s ? (s.subjects || []).join(" ") : "",
          s ? (s.topics || []).join(" ") : "",
          s ? (s.style || []).join(" ") : "",
          s ? (s.mood || []).join(" ") : "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (activeTags.length) {
      out = out.filter((t) => {
        const v = vibe.get(t.albumId);
        if (!v || !v.tags) return false;
        return activeTags.every((tag) => v.tags.includes(tag));
      });
    }

    if (genreFilter) {
      out = out.filter((t) =>
        genresFor(t).some((g) => (parentGenre(g) || g) === genreFilter)
      );
    }

    // Semantic ranking replaces sorting — the order IS the relevance.
    // A score of -1 means the cover has no embedding yet, so it's excluded
    // rather than dumped at the bottom of an otherwise meaningful ranking.
    if (semanticRanking) {
      const scored = out
        .map((t) => {
          const s = semantic.get(t.albumId);
          const score =
            s && s.embedding ? cosineInt8(s.embedding, semanticRanking) : -1;
          return { t, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return scored.map((x) => x.t);
    }

    const sorted = [...out];
    const vibeOf = (t) => vibe.get(t.albumId) || {};
    if (sort === "brightness") {
      sorted.sort((a, b) => (vibeOf(b).brightness || 0) - (vibeOf(a).brightness || 0));
    } else if (sort === "hue") {
      sorted.sort((a, b) => (vibeOf(a).dominantHue || 0) - (vibeOf(b).dominantHue || 0));
    } else if (sort === "saturation") {
      sorted.sort((a, b) => (vibeOf(b).saturation || 0) - (vibeOf(a).saturation || 0));
    } else if (sort === "release") {
      sorted.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    } else if (sort === "album") {
      sorted.sort((a, b) => a.albumName.localeCompare(b.albumName));
    } else if (sort === "artist") {
      sorted.sort((a, b) =>
        (a.artistNames[0] || "").localeCompare(b.artistNames[0] || "")
      );
    } else if (sort === "tracks") {
      sorted.sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));
    }
    return sorted;
  }, [
    baseTiles,
    query,
    activeTags,
    genreFilter,
    sort,
    vibe,
    semantic,
    semanticRanking,
    genresFor,
  ]);

  const toggleTag = (tag) =>
    setActiveTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    );

  const runSemanticSearch = async () => {
    if (!query.trim() || !semanticAvailable) return;
    const vec = await embedQuery(query.trim(), backendBase);
    setSemanticRanking(vec);
  };

  const findSimilar = (tile) => {
    const s = semantic.get(tile.albumId);
    if (!s || !s.embedding) return;
    setSemanticRanking(s.embedding);
    setQuery(`similar to: ${tile.albumName}`);
    setLightbox(null);
    setView({ kind: "all" });
  };

  // Only covers that have been through the semantic pass carry an embedding, so
  // find-similar is per-cover, not just per-app. Without this the button looked
  // enabled and silently did nothing on an unanalyzed cover.
  const canFindSimilar = (tile) => {
    if (!semanticAvailable || !tile) return false;
    const s = semantic.get(tile.albumId);
    return !!(s && s.embedding);
  };

  // Two different counts, deliberately:
  //  taggedCount   — has a Gemini record, i.e. the PAID vision pass is done.
  //                  Drives "how many still need analyzing".
  //  analyzedCount — also has an embedding, i.e. usable for meaning-based
  //                  search and find-similar. Embedding can fail independently.
  const { taggedCount, analyzedCount } = React.useMemo(() => {
    let tagged = 0;
    let embedded = 0;
    semantic.forEach((s) => {
      if (!s) return;
      tagged += 1;
      if (s.embedding) embedded += 1;
    });
    return { taggedCount: tagged, analyzedCount: embedded };
  }, [semantic]);

  const clearSearch = () => {
    setQuery("");
    setSemanticRanking(null);
  };

  // --- boards -------------------------------------------------------------
  const saveToBoard = (tile) => setBoardPicker(tile);
  const pickBoard = (boardId) => {
    setBoards(addToBoard(boardId, boardPicker));
    setBoardPicker(null);
  };
  const newBoardWith = (name) => {
    const next = createBoard(name);
    const board = next[next.length - 1];
    setBoards(addToBoard(board.id, boardPicker));
    setBoardPicker(null);
  };

  // --- render -------------------------------------------------------------
  if (phase !== "ready" || !index) {
    const p = progress;
    const count = p && p.total ? ` ${p.done}/${p.total}` : "";
    return (
      <Box style={{ padding: 48, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="body2" style={{ marginTop: 16 }}>
          Loading albums{count}
        </Typography>
      </Box>
    );
  }

  const header = (
    <Box style={{ marginBottom: 16 }}>
      <Box style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {view.kind !== "albums" && (
          <IconButton size="small" onClick={() => setView({ kind: "albums" })}>
            <ArrowBack />
          </IconButton>
        )}
        <Typography variant="h5" style={{ flex: 1 }}>
          {view.kind === "albums"
            ? "Artwork Explorer"
            : view.kind === "all"
            ? "All artwork"
            : view.kind === "board"
            ? (boards.find((b) => b.id === view.boardId) || {}).name
            : (index.albums.find((a) => a.id === view.albumId) || {}).name}
        </Typography>
        {view.kind === "albums" && (
          <Button size="small" variant="outlined" onClick={() => setView({ kind: "all" })}>
            View all artwork
          </Button>
        )}
        {view.kind === "albums" && (
          <Tooltip title="Re-read playlists from Spotify (normally unnecessary — edited playlists refresh on their own)">
            <Button
              size="small"
              onClick={() => {
                clearArtworkIndexMemo();
                setForceRebuild((n) => n + 1);
              }}
            >
              Refresh
            </Button>
          </Tooltip>
        )}
        <Button size="small" onClick={onExit}>
          Close
        </Button>
      </Box>

      {progress && progress.kind === "vibe" && (
        <Box style={{ marginTop: 8 }}>
          <LinearProgress
            variant="determinate"
            value={(progress.done / Math.max(1, progress.total)) * 100}
          />
          <Typography variant="caption" color="textSecondary">
            Reading colours {progress.done}/{progress.total}
          </Typography>
        </Box>
      )}
    </Box>
  );

  const filterRail = view.kind !== "albums" && (
    <Box style={{ marginBottom: 16 }}>
      <Box style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          variant="outlined"
          placeholder={
            semanticAvailable
              ? "Search — try 'foggy neon city at night'"
              : "Search album, artist, track"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSemanticRanking(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && runSemanticSearch()}
          style={{ minWidth: 280, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearSearch}>
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        {semanticAvailable && (
          <Tooltip
            title={
              analyzedCount === 0
                ? "Add smart tags first to enable meaning-based search"
                : "Rank by meaning rather than keywords"
            }
          >
            <span>
              <Button
                size="small"
                variant={semanticRanking ? "contained" : "outlined"}
                color="primary"
                onClick={runSemanticSearch}
                disabled={!query.trim() || analyzedCount === 0}
              >
                Smart search
              </Button>
            </span>
          </Tooltip>
        )}
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          variant="outlined"
          margin="dense"
          disabled={!!semanticRanking}
        >
          {SORTS.map((s) => (
            <MenuItem key={s.key} value={s.key}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
        {allGenres.length > 0 && (
          <Select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            variant="outlined"
            margin="dense"
            displayEmpty
          >
            <MenuItem value="">All genres</MenuItem>
            {allGenres.slice(0, 40).map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      <Box style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
        {ALL_VIBE_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            clickable
            color={activeTags.includes(tag) ? "primary" : "default"}
            variant={activeTags.includes(tag) ? "default" : "outlined"}
            onClick={() => toggleTag(tag)}
          />
        ))}
        {(activeTags.length > 0 || genreFilter) && (
          <Chip
            label="Clear filters"
            size="small"
            onDelete={() => {
              setActiveTags([]);
              setGenreFilter("");
            }}
            onClick={() => {
              setActiveTags([]);
              setGenreFilter("");
            }}
          />
        )}
      </Box>

      <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 8 }}>
        {tiles.length} cover{tiles.length === 1 ? "" : "s"}
        {semanticRanking
          ? ` · ranked by similarity across ${analyzedCount} analyzed`
          : ""}
      </Typography>
    </Box>
  );

  return (
    <Box style={{ padding: 24 }}>
      {header}

      {view.kind === "albums" ? (
        <AlbumsView
          albums={index.albums}
          boards={boards}
          onOpenAlbum={(id) => {
            setView({ kind: "album", albumId: id });
            setQuery("");
            setSemanticRanking(null);
          }}
          onOpenBoard={(id) => setView({ kind: "board", boardId: id })}
          onDeleteBoard={(id) => setBoards(deleteBoard(id))}
          semanticAvailable={semanticAvailable}
          semanticRun={semanticRun}
          onRunSemantic={runSemantic}
          coverCount={index.covers.size}
          analyzedCount={taggedCount}
          rpm={semanticInfo.rpm}
        />
      ) : (
        <>
          {filterRail}
          <ArtworkGrid
            tiles={tiles}
            onOpen={(i) => setLightbox(i)}
            renderBadge={(t) =>
              boardsContaining(boards, t.albumId).length > 0 ? (
                <CollectionsBookmark
                  fontSize="small"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    color: "#fff",
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                  }}
                />
              ) : null
            }
          />
          {view.kind === "board" && tiles.length > 0 && (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "block", marginTop: 12 }}
            >
              Open any artwork to remove it from this board.
            </Typography>
          )}
        </>
      )}

      {lightbox != null && tiles[lightbox] && (
        <ArtworkLightbox
          tiles={tiles}
          index={lightbox}
          vibe={vibe}
          semantic={semantic}
          genresFor={genresFor}
          savedBoardNames={boardsContaining(boards, tiles[lightbox].albumId).map(
            (b) => b.name
          )}
          onClose={() => setLightbox(null)}
          onNavigate={(d) =>
            setLightbox((i) => Math.max(0, Math.min(tiles.length - 1, i + d)))
          }
          onFindSimilar={findSimilar}
          canFindSimilar={canFindSimilar(tiles[lightbox])}
          semanticAvailable={semanticAvailable}
          onSaveToBoard={saveToBoard}
          onRemoveFromBoard={
            view.kind === "board"
              ? () => {
                  const albumId = tiles[lightbox].albumId;
                  setBoards(removeFromBoard(view.boardId, albumId));
                  setLightbox((i) => (i > 0 ? i - 1 : null));
                }
              : null
          }
        />
      )}

      {boardPicker && (
        <BoardPicker
          boards={boards}
          onPick={pickBoard}
          onCreate={newBoardWith}
          onClose={() => setBoardPicker(null)}
        />
      )}
    </Box>
  );
}

function AlbumsView({
  albums,
  boards,
  onOpenAlbum,
  onOpenBoard,
  onDeleteBoard,
  semanticAvailable,
  semanticRun,
  onRunSemantic,
  coverCount,
  analyzedCount,
  rpm,
}) {
  const remaining = Math.max(0, coverCount - analyzedCount);
  // Honest ETA: at the free tier's 15/min a full library is hours, and it's
  // better to say so up front than to let a run silently crawl.
  const estimate = React.useMemo(() => {
    if (!rpm || remaining <= 0) return "";
    const mins = Math.ceil(remaining / rpm);
    if (mins < 60) return `${mins} min`;
    const hrs = (mins / 60).toFixed(1).replace(/\.0$/, "");
    return `${hrs} hr`;
  }, [rpm, remaining]);
  return (
    <Box>
      {semanticAvailable && (
        <Box
          style={{
            padding: 12,
            marginBottom: 16,
            border: "1px solid rgba(128,128,128,0.3)",
            borderRadius: 8,
          }}
        >
          <Typography variant="subtitle2">Smart tags &amp; content search</Typography>
          <Typography variant="caption" color="textSecondary" style={{ display: "block" }}>
            Colour and mood are read automatically for every cover, free. This is
            the separate paid step: it reads what's actually IN each cover so you
            can search by content ("foggy neon city") and find similar art. Runs
            once per cover and is cached permanently.
          </Typography>
          {semanticRun && !semanticRun.finished ? (
            <Box style={{ marginTop: 8 }}>
              <LinearProgress
                variant="determinate"
                value={(semanticRun.done / Math.max(1, semanticRun.total)) * 100}
              />
              <Typography variant="caption">
                Adding smart tags {semanticRun.done}/{semanticRun.total}
                {semanticRun.waitingSec
                  ? ` · rate limit reached, resuming in ${semanticRun.waitingSec}s`
                  : ""}
              </Typography>
            </Box>
          ) : (
            <Box style={{ marginTop: 8 }}>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={onRunSemantic}
                disabled={remaining === 0}
              >
                {remaining === 0
                  ? "All covers tagged"
                  : analyzedCount > 0
                  ? `Add smart tags to ${remaining} remaining`
                  : `Add smart tags (${coverCount} covers)`}
              </Button>
              {/* Reflects what's actually stored, not just this session's run —
                  a reload used to reset the button to its untouched state even
                  when the whole library was already tagged. */}
              <Typography
                variant="caption"
                color="textSecondary"
                style={{ display: "block", marginTop: 4 }}
              >
                {analyzedCount} of {coverCount} covers tagged
                {rpm && remaining > 0
                  ? ` · ~${estimate} at ${rpm}/min`
                  : ""}
              </Typography>
              {rpm > 0 && rpm <= 15 && remaining > 0 && (
                <Typography
                  variant="caption"
                  color="error"
                  style={{ display: "block", marginTop: 2 }}
                >
                  Your Gemini project is on the free tier ({rpm} requests/min).
                  Enabling billing removes the wait — it stays fractions of a
                  cent per cover.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {boards.length > 0 && (
        <Box style={{ marginBottom: 24 }}>
          <Typography variant="overline" color="textSecondary">
            Mood boards
          </Typography>
          <Box style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            {boards.map((b) => (
              <Chip
                key={b.id}
                label={`${b.name} (${b.items.length})`}
                onClick={() => onOpenBoard(b.id)}
                onDelete={() => onDeleteBoard(b.id)}
              />
            ))}
          </Box>
          <Divider style={{ marginTop: 16 }} />
        </Box>
      )}

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {albums.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenAlbum(a.id)}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                width: "100%",
                aspectRatio: "1 / 1",
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(128,128,128,0.15)",
              }}
            >
              {a.mosaic.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ))}
            </Box>
            <Typography variant="body2" noWrap style={{ marginTop: 6 }}>
              {a.name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {a.trackCount} tracks · {a.uniqueCovers} covers
            </Typography>
          </button>
        ))}
      </Box>
    </Box>
  );
}

function BoardPicker({ boards, onPick, onCreate, onClose }) {
  const [name, setName] = React.useState("");
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Save to board</DialogTitle>
      <DialogContent>
        <List>
          {boards.map((b) => (
            <ListItem button key={b.id} onClick={() => onPick(b.id)}>
              <ListItemText primary={b.name} secondary={`${b.items.length} saved`} />
            </ListItem>
          ))}
        </List>
        <Box style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8 }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="New board name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())}
            fullWidth
          />
          <Button
            variant="contained"
            color="primary"
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim())}
          >
            Create
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
