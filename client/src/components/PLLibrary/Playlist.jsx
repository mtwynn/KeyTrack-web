import React from "react";
import _ from "underscore";

import {
  makeStyles,
  withStyles,
  useMediaQuery,
  Button,
  Chip,
  Dialog,
  Fab,
  FormControl,
  Input,
  InputAdornment,
  InputLabel,
  MenuItem,
  Table,
  TableCell,
  TableRow,
  TableBody,
  TableHead,
  TablePagination,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Select,
  Collapse,
  Box,
} from "@material-ui/core";

import { useTheme } from "@material-ui/core/styles";
import { ArrowUpward, Close, Search, Delete, DonutLarge, FilterList, ExpandMore, ExpandLess, QueueMusic } from "@material-ui/icons";
import Spotify from "spotify-web-api-js";

import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../../../src/config/firebaseConfig";
import { doc, getDoc, getFirestore } from "firebase/firestore";

import KeyMap from "../../utils/KeyMap";
import { releaseSortKey, releaseYear } from "../../utils/release";
import { useEffect } from "react";

import Row from "./Row";
import Recommendations from "./Recommendations";
import KeyFilterPicker from "./KeyFilterPicker";

initializeApp(firebaseConfig);

const musicalKeys = [
  "C",
  "C♯/D♭",
  "D",
  "D♯/E♭",
  "E",
  "F",
  "F♯/G♭",
  "G",
  "G♯/A♭",
  "A",
  "A♯/B♭",
  "B",
];

const camelotKeys = [
  "1A",
  "1B",
  "2A",
  "2B",
  "3A",
  "3B",
  "4A",
  "4B",
  "5A",
  "5B",
  "6A",
  "6B",
  "7A",
  "7B",
  "8A",
  "8B",
  "9A",
  "9B",
  "10A",
  "10B",
  "11A",
  "11B",
  "12A",
  "12B",
];

const openKeys = [
  "1d",
  "1m",
  "2d",
  "2m",
  "3d",
  "3m",
  "4d",
  "4m",
  "5d",
  "5m",
  "6d",
  "6m",
  "7d",
  "7m",
  "8d",
  "8m",
  "9d",
  "9m",
  "10d",
  "10m",
  "11d",
  "11m",
  "12d",
  "12m",
];

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "sticky",
    backgroundColor: "#191414",
  },
  title: {
    flex: 0,
    marginLeft: theme.spacing(3),
  },
  search: {
    flex: 1,
    color: "white",
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(3),
    borderWidth: "10px",
    [theme.breakpoints.down('sm')]: {
      marginRight: 0,
      marginLeft: 0,
    },
  },
  input: {
    color: "white",
  },
  filter: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      marginBottom: theme.spacing(0.5),
      minWidth: '100%',
      maxWidth: '100%',
      fontSize: '0.875rem',
      '& .MuiInputLabel-root': {
        fontSize: '0.75rem',
      },
      '& .MuiSelect-root': {
        fontSize: '0.875rem',
      },
    },
  },
  minFilter: {
    marginLeft: theme.spacing(5),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 50,
    [theme.breakpoints.down('sm')]: {
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
      minWidth: 60,
      maxWidth: 60,
      '& .MuiInputLabel-root': {
        fontSize: '0.75rem',
      },
      '& .MuiInput-root': {
        fontSize: '0.875rem',
      },
    },
  },
  toFilter: {
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 20,
    [theme.breakpoints.down('sm')]: {
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
      '& .MuiInputLabel-root': {
        fontSize: '0.75rem',
      },
    },
  },
  maxFilter: {
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 50,
    [theme.breakpoints.down('sm')]: {
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
      minWidth: 60,
      maxWidth: 60,
      '& .MuiInputLabel-root': {
        fontSize: '0.75rem',
      },
      '& .MuiInput-root': {
        fontSize: '0.875rem',
      },
    },
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
    [theme.breakpoints.down('sm')]: {
      height: 24,
      fontSize: '0.75rem',
      '& .MuiChip-label': {
        padding: '0 8px',
      },
    },
  },
  noLabel: {
    marginTop: theme.spacing(3),
  },
  icon: {
    fill: "white",
  },
  root: {
    fill: "white",
    color: "white",
  },

  button: {
    margin: theme.spacing(1),
    color: "white",
  },
}));

const StyledTableCell = withStyles((theme) => ({
  head: {
    backgroundColor: "#1ED760",
    color: theme.palette.common.white,
    fontWeight: "bold",
  },
  body: {
    fontSize: 14,
  },
}))(TableCell);

let Playlist = (props) => {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xl"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const allItems = props.playlist;

  const [search, setSearch] = React.useState("");
  const [wheel, setWheel] = React.useState("Musical");
  const [keyFilter, setKeyFilter] = React.useState([]);
  const [minBpm, setMinBpm] = React.useState("");
  const [maxBpm, setMaxBpm] = React.useState("");
  const [minYear, setMinYear] = React.useState("");
  const [maxYear, setMaxYear] = React.useState("");
  const [sortBy, setSortBy] = React.useState("key");
  const [showFilters, setShowFilters] = React.useState(!isMobile); // Collapsed on mobile by default
  let [searchItems, setSearchItems] = React.useState(allItems);
  let [chordProgressions, setChordProgressions] = React.useState({});
  // Track whose key is "anchored" for harmonic-mixing highlighting (or null).
  const [harmonicAnchorId, setHarmonicAnchorId] = React.useState(null);
  // Key-filter bottom-sheet open state.
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // Saved picker style: "notation" (Piano/Wheel by notation) or "combined".
  const [filterMode, setFilterMode] = React.useState(
    window.localStorage.getItem("keytrack_filter_mode") === "combined"
      ? "combined"
      : "notation"
  );

  const changeFilterMode = (mode) => {
    window.localStorage.setItem("keytrack_filter_mode", mode);
    setFilterMode(mode);
  };

  // Every picker (piano, wheel, combined) reads/writes the filter as Camelot
  // codes, so the selection is independent of the notation being shown.
  const toggleKeyFilter = (code) => {
    setKeyFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  let topRef = React.createRef();

  let handleChange = _.debounce((event) => {
    event.persist();
    setSearch(String(event.target.value).toLowerCase());
  }, 500);

  // useCallback so Row (memoized) keeps a stable reference and doesn't
  // re-render every time Playlist re-renders for unrelated reasons.
  const handleRowClick = React.useCallback(
    (event, item) => {
      let uri = item.track.uri;
      if (props.updatePlayer) {
        props.updatePlayer([uri], true);
      }
    },
    [props.updatePlayer]
  );

  const db = getFirestore();

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  // Index audio features by track id once, so getKey is O(1). Previously it
  // did a linear .find() per call, and the table sort calls getKey twice per
  // comparison — O(n^2 log n), which froze the UI on large crates for seconds.
  const keysById = React.useMemo(() => {
    const map = new Map();
    (props.playlistKeys || []).forEach((track) => {
      if (track) map.set(track.id, track);
    });
    return map;
  }, [props.playlistKeys]);

  const getKey = React.useCallback(
    (id) => {
      if (!id) return undefined;
      const result = keysById.get(id);
      return result
        ? { key: result.key, mode: result.mode, bpm: result.tempo }
        : null;
    },
    [keysById]
  );

  // Camelot code of the anchored track, derived from its key.
  const anchorKey = harmonicAnchorId ? getKey(harmonicAnchorId) : null;
  const harmonicAnchorCamelot = anchorKey
    ? KeyMap[anchorKey.key].camelot[anchorKey.mode]
    : null;

  const toggleHarmonicAnchor = React.useCallback((item) => {
    setHarmonicAnchorId((prev) =>
      prev === item.track.id ? null : item.track.id
    );
  }, []);

  // Add a track to the app-level set, tagging it with this crate's key/BPM so
  // the set stays self-contained across playlists.
  const handleAddToSet = React.useCallback(
    (item) => {
      if (props.onAddToSet) props.onAddToSet(item, getKey(item.track.id));
    },
    [props.onAddToSet, getKey]
  );

  // Pagination keeps the rendered DOM small. A huge table (thousands of nodes)
  // makes the browser re-layout the whole page whenever a dialog/drawer opens,
  // which froze opening the Set/Calculator for seconds on large crates.
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(100);

  // Sort once per data change (not on every render), on a copy so we don't
  // mutate the searchItems state in place. Default order: Camelot key, then BPM.
  const sortedItems = React.useMemo(() => {
    const arr = [...searchItems];
    arr.sort((a, b) => {
      if (sortBy === "released-desc" || sortBy === "released-asc") {
        const diff = releaseSortKey(a.track) - releaseSortKey(b.track);
        return sortBy === "released-desc" ? -diff : diff;
      }
      const aKey = getKey(a.track.id);
      const bKey = getKey(b.track.id);
      if (!aKey) return -1;
      if (!bKey) return 1;
      if (sortBy === "bpm") return aKey.bpm - bKey.bpm;
      // Default: Camelot key, then BPM.
      const aCamelot = KeyMap[aKey.key].camelot[aKey.mode];
      const bCamelot = KeyMap[bKey.key].camelot[bKey.mode];
      const cmp = aCamelot.localeCompare(bCamelot);
      if (cmp !== 0) return cmp;
      return aKey.bpm - bKey.bpm;
    });
    return arr;
  }, [searchItems, getKey, sortBy]);

  // Only the current page is rendered into the DOM.
  const pagedItems = React.useMemo(
    () => sortedItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedItems, page, rowsPerPage]
  );

  // Reset to the first page whenever the filtered result set changes.
  React.useEffect(() => {
    setPage(0);
  }, [sortedItems]);

  useEffect(() => {
    let getChordProgressions = async () => {
      const docRef = doc(db, "Users", props.userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setChordProgressions(docSnap.data().chordProgressions || {});
      } else {
        // doc.data() will be undefined in this case
        console.log("No such document!");
      }
    };

    getChordProgressions();

    if (
      keyFilter.length === 0 &&
      search === "" &&
      minBpm === "" &&
      maxBpm === "" &&
      minYear === "" &&
      maxYear === ""
    ) {
      _.debounce(setSearchItems(allItems), 500);
    } else {
      _.debounce(
        setSearchItems((searchItems) => {
          let filteredItems = allItems;

          if (search !== "") {
            filteredItems = filteredItems.filter((item) => {
              let artists = item.track.artists
                .map((artist) => artist.name)
                .join(", ")
                .toLowerCase();

              let trackName = String(item.track.name).toLowerCase();
              return artists.includes(search) || trackName.includes(search);
            });
          }
          if (keyFilter.length !== 0) {
            filteredItems = filteredItems.filter((item) => {
              let trackKey = getKey(item.track.id);
              if (!trackKey) return false;
              // keyFilter holds Camelot codes (set via the wheel).
              let camelot = KeyMap[trackKey.key].camelot[trackKey.mode];
              return keyFilter.includes(camelot);
            });
          }
          if (minBpm !== "") {
            let bpmNum = parseInt(minBpm);
            filteredItems = filteredItems.filter((item) => {
              let trackKey = getKey(item.track.id);
              let mappedBpm =
                (trackKey || trackKey === 0) && Math.round(trackKey.bpm);

              return mappedBpm >= bpmNum;
            });
          }

          if (maxBpm !== "") {
            let bpmNum = parseInt(maxBpm);
            filteredItems = filteredItems.filter((item) => {
              let trackKey = getKey(item.track.id);
              let mappedBpm =
                (trackKey || trackKey === 0) && Math.round(trackKey.bpm);

              return mappedBpm <= bpmNum;
            });
          }

          if (minYear !== "") {
            const y = parseInt(minYear, 10);
            filteredItems = filteredItems.filter((item) => {
              const ry = releaseYear(item.track);
              return ry !== null && ry >= y;
            });
          }
          if (maxYear !== "") {
            const y = parseInt(maxYear, 10);
            filteredItems = filteredItems.filter((item) => {
              const ry = releaseYear(item.track);
              return ry !== null && ry <= y;
            });
          }
          return filteredItems;
        }, 500)
      );
    }
    // `wheel` only changes the displayed notation, not which tracks match.
  }, [search, keyFilter, minBpm, maxBpm, minYear, maxYear]);

  const handleFilterChange = (event, type) => {
    const {
      target: { value },
    } = event;

    const setValue = value;

    let funcMap = {
      wheel: setWheel,
      minBpm: _.debounce(setMinBpm, 500),
      maxBpm: _.debounce(setMaxBpm, 500),
      minYear: _.debounce(setMinYear, 500),
      maxYear: _.debounce(setMaxYear, 500),
    };

    funcMap[type](setValue);
  };

  const clearFilters = () => {
    setKeyFilter([]);
    setMinBpm("");
    setMaxBpm("");
    setMinYear("");
    setMaxYear("");
    ["minBpm", "maxBpm", "minYear", "maxYear"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  };

  // TODO: Abstract this to new component

  return (
    <div className="m-div">
      <Dialog
        fullScreen={fullScreen}
        open={props.open}
        onClose={props.handlePlaylistClose}
      >
        <AppBar className={classes.appBar}>
          <Toolbar style={{ 
            minHeight: isMobile ? '56px' : '64px',
            padding: isMobile ? theme.spacing(0, 1) : theme.spacing(0, 2)
          }}>
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="toggle filters"
                edge="start"
              >
                {showFilters ? <ExpandLess /> : <FilterList />}
              </IconButton>
            )}
            <Typography 
              variant={isMobile ? "subtitle1" : "h6"} 
              className={classes.title}
              style={{ 
                flex: 1,
                fontSize: isMobile ? '1rem' : '1.25rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {props.playlistName}
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={props.handlePlaylistClose}
              aria-label="close"
            >
              <Close />
            </IconButton>
          </Toolbar>
          
          <Collapse in={showFilters} timeout="auto">
            <Toolbar style={{ 
              minHeight: isMobile ? '48px' : '64px',
              padding: isMobile ? theme.spacing(0.5, 1) : theme.spacing(0, 2)
            }}>
              <Input
                classes={{
                  root: classes.search,
                  focused: classes.inputFocused,
                }}
                type={"text"}
                onChange={handleChange}
                placeholder="Search"
                style={{
                  fontSize: isMobile ? '0.875rem' : '1rem',
                  width: isMobile ? '100%' : 'auto'
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <Search style={{ fontSize: isMobile ? '20px' : '24px' }} />
                  </InputAdornment>
                }
              />
            </Toolbar>
            <Toolbar 
              style={{ 
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: isMobile ? theme.spacing(0.5, 1) : theme.spacing(1, 2),
                minHeight: isMobile ? 'auto' : '64px',
              }}
            >
              {/* Filter Controls */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: isMobile ? theme.spacing(0.5) : theme.spacing(1),
                width: '100%'
              }}>
              <FormControl className={classes.filter}>
                <InputLabel id="demo-simple-select-label">Notation</InputLabel>
                <Select
                  label="Notation"
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={wheel}
                  onChange={(e) => handleFilterChange(e, "wheel")}
                  classes={classes.select}
                  inputProps={{
                    classes: {
                      icon: classes.icon,
                      root: classes.root,
                    },
                  }}
                  MenuProps={{
                    anchorOrigin: {
                      vertical: "bottom",
                      horizontal: "left"
                    },
                    transformOrigin: {
                      vertical: "top",
                      horizontal: "left"
                    },
                    getContentAnchorEl: null,
                    PaperProps: {
                      style: {
                        maxHeight: isMobile ? 250 : 400,
                      }
                    }
                  }}
                  input={<Input />}
                >
                  {["Musical", "Camelot", "Open"].map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl className={classes.filter}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DonutLarge />}
                  onClick={() => setPickerOpen(true)}
                  style={{
                    height: "100%",
                    textTransform: "none",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.6)",
                  }}
                >
                  Filter by Key{keyFilter.length ? ` (${keyFilter.length})` : ""}
                </Button>
              </FormControl>
              <FormControl className={classes.filter}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<QueueMusic />}
                  onClick={props.onOpenSet}
                  style={{
                    height: "100%",
                    textTransform: "none",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.6)",
                  }}
                >
                  Set{props.setCount ? ` (${props.setCount})` : ""}
                </Button>
              </FormControl>
              <FormControl className={classes.minFilter}>
                <InputLabel id="demo-simple-select-label">BPM: </InputLabel>
              </FormControl>
              <FormControl className={classes.minFilter}>
                <InputLabel id="demo-simple-select-label">Min</InputLabel>
                <Input
                  id="minBpm"
                  label="Standard"
                  type="number"
                  classes={{
                    root: classes.root,
                  }}
                  onChange={(e) => handleFilterChange(e, "minBpm")}
                />
              </FormControl>
              <FormControl className={classes.toFilter}>
                <InputLabel id="demo-simple-select-label">to</InputLabel>
              </FormControl>
              <FormControl className={classes.maxFilter}>
                <InputLabel id="demo-simple-select-label">Max</InputLabel>
                <Input
                  id="maxBpm"
                  label="Standard"
                  type="number"
                  classes={{
                    root: classes.root,
                  }}
                  // value={maxBpm}
                  onChange={(e) => handleFilterChange(e, "maxBpm")}
                />
              </FormControl>

              <FormControl className={classes.minFilter}>
                <InputLabel id="demo-simple-select-label">Year:</InputLabel>
              </FormControl>
              <FormControl className={classes.minFilter}>
                <InputLabel id="demo-simple-select-label">From</InputLabel>
                <Input
                  id="minYear"
                  type="number"
                  classes={{ root: classes.root }}
                  onChange={(e) => handleFilterChange(e, "minYear")}
                />
              </FormControl>
              <FormControl className={classes.toFilter}>
                <InputLabel id="demo-simple-select-label">to</InputLabel>
              </FormControl>
              <FormControl className={classes.maxFilter}>
                <InputLabel id="demo-simple-select-label">To</InputLabel>
                <Input
                  id="maxYear"
                  type="number"
                  classes={{ root: classes.root }}
                  onChange={(e) => handleFilterChange(e, "maxYear")}
                />
              </FormControl>

              <FormControl className={classes.filter}>
                <InputLabel id="demo-simple-select-label">Sort by</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort by"
                  onChange={(e) => setSortBy(e.target.value)}
                  inputProps={{
                    classes: { icon: classes.icon, root: classes.root },
                  }}
                  input={<Input />}
                >
                  <MenuItem value="key">Key</MenuItem>
                  <MenuItem value="bpm">BPM</MenuItem>
                  <MenuItem value="released-desc">Newest</MenuItem>
                  <MenuItem value="released-asc">Oldest</MenuItem>
                </Select>
              </FormControl>

              <IconButton
                  aria-label="clear filters"
                  className={classes.button}
                  onClick={clearFilters}
                  size="small"
                  style={{ padding: isMobile ? 4 : 8 }}
                  title="Clear all filters"
                >
                  <Delete style={{ fontSize: isMobile ? '18px' : '20px' }} />
                </IconButton>
            </div>
          </Toolbar>
          </Collapse>
        </AppBar>

        <div style={{
          paddingBottom: isMobile ? "180px" : "63px",
          overflowX: isMobile ? "auto" : "visible",
          overflowY: "visible"
        }}>
          {harmonicAnchorCamelot && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                backgroundColor: "#f0fbf4",
                borderBottom: "1px solid #cdeed7",
              }}
            >
              <Typography variant="body2" style={{ fontWeight: 600 }}>
                🎚 Harmonic matches for {harmonicAnchorCamelot} — compatible
                tracks highlighted, others dimmed
              </Typography>
              <Chip
                size="small"
                label="Clear"
                onClick={() => setHarmonicAnchorId(null)}
                onDelete={() => setHarmonicAnchorId(null)}
              />
            </Box>
          )}
          {sortedItems.length > 50 && (
            <TablePagination
              component="div"
              count={sortedItems.length}
              page={page}
              onChangePage={(e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onChangeRowsPerPage={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[50, 100, 200]}
            />
          )}
          <Table>
            <TableHead ref={topRef}>
              <TableRow>
                {!isMobile && <StyledTableCell></StyledTableCell>}
                {!isMobile && <StyledTableCell>Cover Art</StyledTableCell>}
                <StyledTableCell>Track</StyledTableCell>
                {!isMobile && <StyledTableCell>Artist</StyledTableCell>}
                <StyledTableCell>
                  {isMobile ? "Key" : `Key (${wheel})`}
                </StyledTableCell>
                {!isMobile && <StyledTableCell>Quality</StyledTableCell>}
                <StyledTableCell>BPM</StyledTableCell>
                {!isTablet && <StyledTableCell>Released</StyledTableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedItems
                .map((item) => (
                  <Row
                    item={item}
                    userId={props.userId}
                    key={item.track.id}
                    db={db}
                    chordProgressions={chordProgressions}
                    handleRowClick={handleRowClick}
                    getKey={getKey}
                    isMobile={isMobile}
                    isTablet={isTablet}
                    wheel={wheel}
                    harmonicAnchorId={harmonicAnchorId}
                    harmonicAnchorCamelot={harmonicAnchorCamelot}
                    onToggleAnchor={toggleHarmonicAnchor}
                    onAddToSet={handleAddToSet}
                  />
                ))}
            </TableBody>
          </Table>

          {props.userId === props.playlistOwnerId && (
            <Recommendations
              token={props.token}
              playlistId={props.playlistId}
              playlistTracks={allItems}
              playlistKeys={props.playlistKeys}
              updatePlayer={props.updatePlayer}
              addTracksToPlaylistState={props.addTracksToPlaylistState}
            />
          )}

          <Fab
            variant="extended"
            style={{
              backgroundColor: "#1ED760",
              color: "#FFF",
              borderRadius: "0",
              width: "100%",
              minHeight: isMobile ? "56px" : "48px",
              fontSize: isMobile ? "1rem" : "0.875rem",
            }}
            onClick={() => {
              topRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          >
            <ArrowUpward />
            Back To Top
          </Fab>
        </div>

        <KeyFilterPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          notation={wheel}
          selected={keyFilter}
          onToggle={toggleKeyFilter}
          onClear={() => setKeyFilter([])}
          filterMode={filterMode}
          onChangeFilterMode={changeFilterMode}
        />

      </Dialog>
    </div>
  );
};

export default Playlist;
