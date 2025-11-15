import React from "react";
import _ from "underscore";

import {
  makeStyles,
  withStyles,
  useMediaQuery,
  Avatar,
  Button,
  Box,
  Chip,
  Collapse,
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
  TextField,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Select,
} from "@material-ui/core";

import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";

import { useTheme } from "@material-ui/core/styles";
import { ArrowUpward, Close, Search, Delete } from "@material-ui/icons";
import Spotify from "spotify-web-api-js";

import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../../../src/config/firebaseConfig";
import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";

import KeyMap from "../../utils/KeyMap";
import { useEffect } from "react";

initializeApp(firebaseConfig);

const qualities = ["Major", "Minor"];
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
  },
  input: {
    color: "white",
  },
  filter: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
  },
  minFilter: {
    marginLeft: theme.spacing(5),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 50,
  },
  toFilter: {
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 20,
  },
  maxFilter: {
    marginLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
    minWidth: 20,
    maxWidth: 50,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
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

function getStyles(attr, attrFilter, theme) {
  return {
    fontWeight:
      attrFilter.indexOf(attr) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

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
  const allItems = props.playlist;

  const [search, setSearch] = React.useState("");
  const [wheel, setWheel] = React.useState("Musical");
  const [qualityFilter, setQualityFilter] = React.useState([]);
  const [keyFilter, setKeyFilter] = React.useState([]);
  const [minBpm, setMinBpm] = React.useState("");
  const [maxBpm, setMaxBpm] = React.useState("");
  let [searchItems, setSearchItems] = React.useState(allItems);
  let [chordProgressions, setChordProgressions] = React.useState({});

  let topRef = React.createRef();

  let handleChange = _.debounce((event) => {
    event.persist();
    setSearch(String(event.target.value).toLowerCase());
  }, 500);

  let handleRowClick = (event, item) => {
    let uri = item.track.uri;
    // Call the parent's updatePlayer function
    if (props.updatePlayer) {
      props.updatePlayer([uri], true);
    }
  };

  const db = getFirestore();

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  let getKey = (id) => {
    if (id) {
      let result = props.playlistKeys.find((track) => {
        if (track) {
          return id.localeCompare(track.id) === 0;
        }
        return null;
      });

      if (result) {
        let returnObj = {
          key: result.key,
          mode: result.mode,
          bpm: result.tempo,
        };
        return returnObj;
      } else {
        return null;
      }
    }
  };

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
      qualityFilter.length === 0 &&
      search === "" &&
      minBpm === "" &&
      maxBpm === ""
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
              let mappedKey;

              switch (wheel) {
                case "Musical":
                  mappedKey =
                    (trackKey || trackKey === 0) && KeyMap[trackKey.key].key;

                  break;
                case "Camelot":
                  mappedKey =
                    KeyMap[getKey(item.track.id).key].camelot[
                      getKey(item.track.id).mode
                    ];
                  break;
                case "Open":
                  mappedKey =
                    KeyMap[getKey(item.track.id).key].open[
                      getKey(item.track.id).mode
                    ];
                  break;
                default:
                  break;
              }
              return keyFilter.includes(mappedKey);
            });
          }
          if (qualityFilter.length !== 0) {
            filteredItems = filteredItems.filter((item) => {
              let trackKey = getKey(item.track.id);
              let mappedQuality =
                trackKey || trackKey === 0
                  ? trackKey.mode === 1
                    ? "Major"
                    : "Minor"
                  : "N/A";

              return qualityFilter.includes(mappedQuality);
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
          return filteredItems;
        }, 500)
      );
    }
  }, [wheel, search, keyFilter, qualityFilter, minBpm, maxBpm]);

  const handleFilterChange = (event, type) => {
    const {
      target: { value },
    } = event;

    let setValue;

    if (type === "key" || type === "quality") {
      setValue = typeof value === "string" ? value.split(",") : value;
    } else {
      setValue = value;
    }

    let funcMap = {
      wheel: setWheel,
      key: setKeyFilter,
      quality: setQualityFilter,
      minBpm: _.debounce(setMinBpm, 500),
      maxBpm: _.debounce(setMaxBpm, 500),
    };

    funcMap[type](setValue);
  };

  const getKeysForWheel = (wheel) => {
    switch (wheel) {
      case "Camelot":
        return camelotKeys;
      case "Open":
        return openKeys;
      case "Musical":
      default:
        return musicalKeys;
    }
  };

  const clearFilters = () => {
    setKeyFilter([]);
    setQualityFilter([]);
    setMinBpm("");
    setMaxBpm("");
    document.getElementById("minBpm").value = "";
    document.getElementById("maxBpm").value = "";
  };

  // TODO: Abstract this to new component
  function Row(props) {
    const { item } = props;
    const [open, setOpen] = React.useState(false);
    const [editChords, setEditChords] = React.useState(false);
    const [oldProgressions, setOldProgressions] = React.useState(
      chordProgressions[item.track.id] || {}
    );
    const [progressions, setProgressions] = React.useState(
      chordProgressions[item.track.id] || {}
    );

    let handleChordProgressionChange = (e) => {
      let newObj = { ...progressions };
      newObj[e.target.id] = e.target.value;
      setProgressions(newObj);
    };

    const progressionRef = doc(db, `Users/${props.userId}`);

    return (
      <React.Fragment>
        <TableRow
          key={item.track.id}
          hover
          style={{ cursor: "pointer" }}
          onClick={(event) => handleRowClick(event, item)}
          sx={{ "& > *": { borderBottom: "unset" } }}
        >
          <TableCell>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </TableCell>
          <TableCell>
            <Avatar
              variant="square"
              src={
                item.track.album.images[0]
                  ? item.track.album.images[0].url
                  : null
              }
            ></Avatar>
          </TableCell>
          <TableCell>{item.track.name}</TableCell>
          <TableCell>
            {item.track.artists.map((artist) => artist.name).join(", ")}
          </TableCell>
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? KeyMap[getKey(item.track.id).key].key
              : "N/A"}
          </TableCell>
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? getKey(item.track.id).mode === 1
                ? "Major"
                : "Minor"
              : "N/A"}
          </TableCell>
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? KeyMap[getKey(item.track.id).key].camelot[
                  getKey(item.track.id).mode
                ]
              : "N/A"}
          </TableCell>
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? KeyMap[getKey(item.track.id).key].open[
                  getKey(item.track.id).mode
                ]
              : "N/A"}
          </TableCell>
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? Math.round(getKey(item.track.id).bpm)
              : "N/A"}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={12}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box>
                <Typography variant="h6" gutterBottom component="div">
                  Chord Progressions
                </Typography>
                {editChords ? (
                  <>
                    <Button
                      variant="contained"
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditChords(false);

                        setOldProgressions(progressions);

                        console.log("Saving...");
                        console.log(progressions);
                        let route = `chordProgressions.${item.track.id}`;

                        updateDoc(progressionRef, {
                          [route]: progressions,
                        });
                      }}
                    >
                      Save Chords
                    </Button>{" "}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditChords(false);

                        console.log("Cancelling");
                        setProgressions(oldProgressions);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditChords(true);
                      }}
                    >
                      Edit Chords
                    </Button>
                  </>
                )}

                <Table size="small" aria-label="purchases">
                  <TableHead>
                    <TableRow>
                      <TableCell>Verse</TableCell>
                      <TableCell>Pre-Chorus</TableCell>
                      <TableCell>Chorus</TableCell>
                      <TableCell>Build-up</TableCell>
                      <TableCell>Drop</TableCell>
                      <TableCell>Bridge</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow key={item.track.id}>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="verse"
                            variant="outlined"
                            size="small"
                            placeholder='ex. "C G Am F"'
                            defaultValue={progressions.verse}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.verse}</strong>
                        )}
                      </TableCell>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="preChorus"
                            variant="outlined"
                            size="small"
                            placeholder='ex. "I V vi IV"'
                            value={progressions.preChorus}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.preChorus}</strong>
                        )}
                      </TableCell>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="chorus"
                            variant="outlined"
                            size="small"
                            value={progressions.chorus}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.chorus}</strong>
                        )}
                      </TableCell>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="buildUp"
                            variant="outlined"
                            size="small"
                            value={progressions.buildUp}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.buildUp}</strong>
                        )}
                      </TableCell>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="drop"
                            variant="outlined"
                            size="small"
                            value={progressions.drop}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.drop}</strong>
                        )}
                      </TableCell>
                      <TableCell>
                        {editChords ? (
                          <TextField
                            id="bridge"
                            variant="outlined"
                            size="small"
                            value={progressions.bridge}
                            onChange={handleChordProgressionChange}
                          />
                        ) : (
                          <strong>{progressions.bridge}</strong>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  }

  return (
    <div className="m-div">
      <Dialog
        fullScreen={fullScreen}
        open={props.open}
        onClose={props.handlePlaylistClose}
      >
        <AppBar className={classes.appBar}>
          <Typography variant="h6" className={classes.title}>
            {props.playlistName}
          </Typography>
          <Toolbar>
            <Input
              classes={{
                root: classes.search,
                focused: classes.inputFocused,
              }}
              type={"text"}
              onChange={handleChange}
              placeholder="Search"
              endAdornment={
                <InputAdornment position="end">
                  <Search />
                </InputAdornment>
              }
            />
            <FormControl>
              <IconButton
                edge="end"
                color="inherit"
                onClick={props.handlePlaylistClose}
                aria-label="close"
              >
                <Close />
              </IconButton>
            </FormControl>
          </Toolbar>
          <Toolbar>
            <Typography variant="overline" className={classes.title}>
              Filters
            </Typography>

            <div>
              <FormControl className={classes.filter}>
                <InputLabel id="demo-simple-select-label">Wheel</InputLabel>
                <Select
                  label="Wheel"
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
                <InputLabel id="demo-simple-select-label">Key</InputLabel>
                <Select
                  label="Key"
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={keyFilter}
                  multiple
                  onChange={(e) => handleFilterChange(e, "key")}
                  renderValue={(selected) => (
                    <div className={classes.chips}>
                      {selected.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          className={classes.chip}
                        />
                      ))}
                    </div>
                  )}
                  classes={classes.select}
                  inputProps={{
                    classes: {
                      icon: classes.icon,
                      root: classes.root,
                    },
                  }}
                  input={<Input />}
                >
                  {getKeysForWheel(wheel).map((key) => (
                    <MenuItem
                      key={key}
                      value={key}
                      style={getStyles(key, keyFilter, theme)}
                    >
                      {key}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {wheel === "Musical" && (
                <FormControl className={classes.filter}>
                  <InputLabel id="demo-simple-select-label">Quality</InputLabel>
                  <Select
                    label="Quality"
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={qualityFilter}
                    multiple
                    onChange={(e) => handleFilterChange(e, "quality")}
                    renderValue={(selected) => (
                      <div className={classes.chips}>
                        {selected.map((value) => (
                          <Chip
                            key={value}
                            label={value}
                            className={classes.chip}
                          />
                        ))}
                      </div>
                    )}
                    classes={classes.select}
                    inputProps={{
                      classes: {
                        icon: classes.icon,
                        root: classes.root,
                      },
                    }}
                    input={<Input />}
                  >
                    {qualities.map((quality) => (
                      <MenuItem
                        key={quality}
                        value={quality}
                        style={getStyles(quality, qualityFilter, theme)}
                      >
                        {quality}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

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
            </div>
            <FormControl>
              <IconButton
                aria-label="delete"
                className={classes.button}
                onClick={clearFilters}
              >
                <Delete />
              </IconButton>
            </FormControl>
          </Toolbar>
        </AppBar>

        <div style={{ paddingBottom: "63px" }}>
          <Table>
            <TableHead ref={topRef}>
              <TableRow>
                <StyledTableCell></StyledTableCell>
                <StyledTableCell>Cover Art</StyledTableCell>
                <StyledTableCell>Track</StyledTableCell>
                <StyledTableCell>Artist</StyledTableCell>
                <StyledTableCell>Musical Key</StyledTableCell>
                <StyledTableCell>Quality</StyledTableCell>
                <StyledTableCell>Camelot Key</StyledTableCell>
                <StyledTableCell>Open Key</StyledTableCell>
                <StyledTableCell>BPM</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {searchItems
                .sort((a, b) => {
                  let aKey = getKey(a.track.id);
                  let bKey = getKey(b.track.id);

                  if (!aKey) return -1;
                  if (!bKey) return 1;
                  if (!aKey && !bKey) return 0;

                  let aCamelot = KeyMap[aKey.key].camelot[aKey.mode];
                  let bCamelot = KeyMap[bKey.key].camelot[bKey.mode];
                  let aBPM = aKey.bpm;
                  let bBPM = bKey.bpm;

                  if (aCamelot.localeCompare(bCamelot) < 0) return -1;
                  if (aCamelot.localeCompare(bCamelot) > 0) return 1;
                  return aBPM - bBPM;
                })
                .map((item) => (
                  <Row item={item} userId={props.userId} />
                ))}
            </TableBody>
          </Table>
          <Fab
            variant="extended"
            style={{
              backgroundColor: "#1ED760",
              color: "#FFF",
              borderRadius: "0",
              width: "100vw",
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
      </Dialog>
    </div>
  );
};

export default Playlist;
