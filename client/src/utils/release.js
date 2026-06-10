// Helpers for a track's release date. Spotify provides album.release_date
// ("2021", "2021-03", or "2021-03-15") plus release_date_precision.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Mar 2021" when a month is known, otherwise the year, or "—" if unknown.
export function formatReleaseDate(track) {
  const album = track && track.album;
  const rd = album && album.release_date;
  if (!rd) return "—";
  const [y, m] = rd.split("-");
  if (!m || (album.release_date_precision === "year")) return y;
  const mi = parseInt(m, 10);
  return mi >= 1 && mi <= 12 ? `${MONTHS[mi - 1]} ${y}` : y;
}

export function releaseYear(track) {
  const rd = track && track.album && track.album.release_date;
  return rd ? parseInt(rd.slice(0, 4), 10) || null : null;
}

// A sortable integer YYYYMMDD (missing month/day count as 0) — newest = largest.
export function releaseSortKey(track) {
  const rd = track && track.album && track.album.release_date;
  if (!rd) return 0;
  const [y, m, d] = rd.split("-");
  return (
    (parseInt(y, 10) || 0) * 10000 +
    (parseInt(m, 10) || 0) * 100 +
    (parseInt(d, 10) || 0)
  );
}
