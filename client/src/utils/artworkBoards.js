// Mood boards: named collections of artwork you're gathering as reference for
// a specific release.
//
// Stored in localStorage rather than IndexedDB — boards are small (a few
// hundred entries at most) and we want them read synchronously at first paint
// so the "on a board" indicator never flickers in.
//
// Each entry keeps a self-contained copy of what it needs to render (image url,
// album, artists), exactly like sets.js does, so a board survives a track being
// removed from the source playlist.

const KEY = "keytrack_artwork_boards";

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function write(boards) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(boards));
  } catch (e) {
    // quota / private mode — boards stay in memory for this session
  }
  return boards;
}

export function loadBoards() {
  return read();
}

export function createBoard(name) {
  const boards = read();
  const board = {
    id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name || "Untitled board",
    createdAt: Date.now(),
    items: [],
  };
  return write([...boards, board]);
}

export function renameBoard(id, name) {
  return write(read().map((b) => (b.id === id ? { ...b, name } : b)));
}

export function deleteBoard(id) {
  return write(read().filter((b) => b.id !== id));
}

// Membership is by album, not track: two tracks from the same album are the
// same picture, and a board of duplicates is useless as a reference sheet.
export function isOnBoard(board, albumId) {
  return !!board && board.items.some((i) => i.albumId === albumId);
}

export function addToBoard(boardId, tile) {
  return write(
    read().map((b) => {
      if (b.id !== boardId) return b;
      if (b.items.some((i) => i.albumId === tile.albumId)) return b;
      return {
        ...b,
        items: [
          ...b.items,
          {
            albumId: tile.albumId,
            albumName: tile.albumName,
            artistNames: tile.artistNames,
            trackCount: tile.trackCount,
            url300: tile.url300,
            url640: tile.url640,
            uri: tile.uri,
            addedAt: Date.now(),
          },
        ],
      };
    })
  );
}

export function removeFromBoard(boardId, albumId) {
  return write(
    read().map((b) =>
      b.id === boardId
        ? { ...b, items: b.items.filter((i) => i.albumId !== albumId) }
        : b
    )
  );
}

// Every board an album appears on — drives the "saved" badge on a tile.
export function boardsContaining(boards, albumId) {
  return boards.filter((b) => b.items.some((i) => i.albumId === albumId));
}
