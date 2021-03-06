import React from "react";

import {
  makeStyles,
  withStyles,
  Avatar,
  Dialog,
  Input,
  InputAdornment,
  Fab,
  FormControl,
  Table,
  TableCell,
  TableRow,
  TableBody,
  TableHead,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
} from "@material-ui/core";

import { useTheme } from "@material-ui/core/styles";
import { ArrowUpward, Close, Search } from "@material-ui/icons";
import Spotify from "spotify-web-api-js";
import SpotifyPlayer from "react-spotify-web-playback";

import KeyMap from "../../utils/KeyMap";

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "-webkit-sticky",
    position: "sticky",
    backgroundColor: "#191414",
  },
  title: {
    flex: 0,
  },
  search: {
    flex: 1,
    color: "white",
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(3),
    borderWidth: "10px",
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
  const allItems = props.playlist;

  const [search, setSearch] = React.useState("");
  let [searchItems, setSearchItems] = React.useState(allItems);
  let [uris, setUris] = React.useState([]);
  let [isPlaying, setIsPlaying] = React.useState(false);

  let topRef = React.createRef();

  let handleChange = (event) => {
    event.persist();
    setSearch(event.target.value);

    let searchQuery = String(event.target.value).toLowerCase();
    setSearchItems((searchItems) =>
      allItems.filter((item) => {
        let artists = item.track.artists
          .map((artist) => artist.name)
          .join(", ")
          .toLowerCase();

        let trackName = String(item.track.name).toLowerCase();

        return trackName.includes(searchQuery) || artists.includes(searchQuery);
      })
    );
  };

  let handleRowClick = (event, item) => {
    let uri = item.track.uri;
    setUris([uri]);

    setIsPlaying(true);
  };

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

  return (
    <div className="m-div">
      <Dialog
        fullScreen={fullScreen}
        open={props.open}
        onClose={props.handlePlaylistClose}
      >
        <AppBar className={classes.appBar}>
          <Toolbar>
            <Typography variant="h6" className={classes.title}>
              {props.playlistName}
            </Typography>
            <Input
              classes={{
                root: classes.search,
                focused: classes.inputFocused,
              }}
              type={"text"}
              value={search}
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
        </AppBar>

        <div style={{paddingBottom: "63px"}}>
          <Table>
            <TableHead ref={topRef}>
              <TableRow>
                <StyledTableCell>Image</StyledTableCell>
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
                  <TableRow
                    key={item.track.id}
                    hover
                    style={{ cursor: "pointer" }}
                    onClick={(event) => handleRowClick(event, item)}
                  >
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
                ))}
            </TableBody>
          </Table>
          <Fab
            variant="extended"
            style={{
              backgroundColor: "#1ED760",
              color: "#FFF",
              borderRadius: "0",
              width: "100vw"
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

        <div style={{position: "fixed", bottom: 0, width: "100vw"}}>
          <SpotifyPlayer
            token={spotifyWebApi.getAccessToken()}
            uris={uris}
            styles={{
              activeColor: "#1ED760",
              loaderColor: "#1ED760",
              sliderColor: "#1ED760",
            }}
            play={isPlaying}
            showSaveIcon={true}
          />
          <Fab
            variant="extended"
            style={{
              backgroundColor: "#FFF",
              color: "#333",
              borderRadius: "0",
              width: "100vw",
              height: "15px"
            }}>
              The web player is a little buggy. Please try clicking Play again if clicking a track does not play it. 
          </Fab>
        </div>
      </Dialog>   
    </div>
  );
};

export default Playlist;
