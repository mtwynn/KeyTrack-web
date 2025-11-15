import React, { Fragment } from "react";
import _ from "underscore";

import {
  AppBar,
  Avatar,
  IconButton,
  CircularProgress,
  Dialog,
  Input,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Paper,
  makeStyles,
  withStyles,
} from "@material-ui/core";

import { MenuOpen, Search } from "@material-ui/icons";

import Spotify from "spotify-web-api-js";

import Playlist from "./Playlist";
import { useEffect } from "react";

const StyledTableCell = withStyles((theme) => ({
  head: {
    backgroundColor: "#191414",
    color: theme.palette.common.white,
    fontWeight: "bolder",
  },
  body: {
    fontSize: 14,
  },
}))(TableCell);

const useStyles = makeStyles((theme) => ({
  appBar: {
    position: "sticky",
    backgroundColor: "#191414",
    borderRadius: "8px 8px 0 0",
  },
  search: {
    flex: 1,
    color: "white",
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(3),
    borderWidth: "10px",
    [theme.breakpoints.down('sm')]: {
      marginRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
    },
  },
  root: {
    display: "inline-block",
    borderRadius: "0 0 4px 4px",
  },
  loadingDialog: {
    backgroundColor: "transparent",
  },
  loadingDialogPaper: {
    backgroundColor: "transparent",
    boxShadow: "none",
    overflow: "hidden",
  },
  colorPrimary: {
    color: "#1ED760",
  },
}));

const StyledTableRow = withStyles((theme) => ({
  root: {
    "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:hover": {
      background: "#bcf6d0",
    },
    transition: "background .15s ease-in",
    cursor: "pointer",
  },
}))(TableRow);

let PLLibrary = (props) => {
  const [loadingPlaylist, setLoadingPlaylist] = React.useState(false);
  const [showPlaylist, setShowPlaylist] = React.useState(false);
  const [currPlaylist, setCurrPlaylist] = React.useState(null);
  const [playlistKeys, setPlaylistKeys] = React.useState(null);
  const [playlistName, setPlaylistName] = React.useState("");
  const [playlistId, setPlaylistId] = React.useState("");
  const [playlistOwnerId, setPlaylistOwnerId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [searchItems, setSearchItems] = React.useState(props.pllibrary);

  const spotifyWebApi = new Spotify();
  spotifyWebApi.setAccessToken(props.token);

  // Add tracks to current playlist state without refetching
  const addTracksToPlaylistState = (tracks, audioFeatures = []) => {
    if (!currPlaylist) return;
    
    // Convert tracks to playlist item format if needed
    const newItems = tracks.map(track => {
      // If track is already in playlist format, use it; otherwise wrap it
      if (track.track) {
        return track;
      }
      return {
        added_at: new Date().toISOString(),
        track: track
      };
    });
    
    setCurrPlaylist([...currPlaylist, ...newItems]);
    
    // Add audio features to playlistKeys if provided
    if (audioFeatures.length > 0 && playlistKeys) {
      setPlaylistKeys([...playlistKeys, ...audioFeatures]);
      console.log(`Added ${newItems.length} track(s) with metadata to playlist state`);
    } else {
      console.log(`Added ${newItems.length} track(s) to playlist state (no metadata)`);
    }
  };

  useEffect(() => {
    if (search === "") {
      _.debounce(setSearchItems(props.pllibrary), 500);
    } else {
      _.debounce(
        setSearchItems(() => {
          let filteredItems = props.pllibrary;

          if (search !== "") {
            filteredItems = filteredItems.filter((item) => {
              const {
                name: title,
                description,
                owner: { display_name: owner },
              } = item;

              console.log(description);

              return (
                title.toLowerCase().includes(search) ||
                description.toLowerCase().includes(search) ||
                owner.toLowerCase().includes(search)
              );
            });
          }

          return filteredItems;
        }, 500)
      );
    }
  }, [search]);

  let handleChange = _.debounce((event) => {
    event.persist();
    setSearch(String(event.target.value).toLowerCase());
  }, 500);

  let handlePlaylistOpen = (playlist) => {
    let numRequests = Math.ceil(playlist.tracks.total / 100);
    let playlistPromises = [];
    let audioFeaturesPromises = [];

    setLoadingPlaylist(true);

    setPlaylistName(playlist.name);
    setPlaylistId(playlist.id);
    setPlaylistOwnerId(playlist.owner.id);

    for (var i = 0; i < numRequests; ++i) {
      playlistPromises.push(
        spotifyWebApi.getPlaylistTracks(playlist.id, { offset: i * 100 })
      );
    }

    Promise.all(playlistPromises).then((results) => {
      let tempArr = [];

      results.forEach((result) => {
        tempArr = tempArr.concat(result.items);

        let playlistItems = result.items;
        let playlistItemIds = [];

        for (var j = 0; j < playlistItems.length; ++j) {
          let id = playlistItems[j].track.id;
          playlistItemIds.push(id);
        }

        audioFeaturesPromises.push(
          spotifyWebApi.getAudioFeaturesForTracks(playlistItemIds)
        );
      });

      Promise.all(audioFeaturesPromises).then((results) => {
        let keysArr = [];

        results.forEach((result) => {
          keysArr = keysArr.concat(result.audio_features);
        });

        setCurrPlaylist(tempArr);
        setPlaylistKeys(keysArr);
        setShowPlaylist(true);
        setLoadingPlaylist(false);
      });
    });
  };

  let handlePlaylistClose = () => {
    setShowPlaylist(false);
  };
  const classes = useStyles();

  return (
    <>
      <Dialog
        open={loadingPlaylist}
        PaperProps={{
          classes: {
            root: classes.loadingDialogPaper,
          },
        }}
      >
        <CircularProgress
          classes={{ colorPrimary: classes.colorPrimary }}
          size={100}
          variant="indeterminate"
          disableShrink
        />
      </Dialog>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <Input
            classes={{
              root: classes.search,
              focused: classes.inputFocused,
            }}
            type={"text"}
            onChange={handleChange}
            placeholder="Search Playlists"
            endAdornment={
              <InputAdornment position="end">
                <Search />
              </InputAdornment>
            }
          />
        </Toolbar>
      </AppBar>

      <TableContainer component={Paper} className={classes.root}>
        <Table className={classes.table} aria-label="customized table">
          <TableHead>
            <TableRow>
              <StyledTableCell></StyledTableCell>
              <StyledTableCell>Cover Art</StyledTableCell>
              <StyledTableCell>Title</StyledTableCell>
              <StyledTableCell>Description</StyledTableCell>
              <StyledTableCell>Owner</StyledTableCell>
              <StyledTableCell>Number of Tracks</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {searchItems.map((playlist) => (
              <Fragment key={playlist.id}>
                <StyledTableRow
                  key={playlist.id}
                  onClick={() => handlePlaylistOpen(playlist)}
                >
                  <StyledTableCell>
                    <IconButton onClick={() => handlePlaylistOpen(playlist)}>
                      <MenuOpen />
                    </IconButton>
                  </StyledTableCell>
                  <StyledTableCell>
                    <Avatar
                      variant="square"
                      src={
                        playlist.images[0] ? playlist.images[0].url : undefined
                      }
                    ></Avatar>
                  </StyledTableCell>
                  <StyledTableCell>{playlist.name}</StyledTableCell>
                  <StyledTableCell>{playlist.description}</StyledTableCell>
                  <StyledTableCell>
                    {playlist.owner.display_name}
                  </StyledTableCell>
                  <StyledTableCell>{playlist.tracks.total}</StyledTableCell>
                </StyledTableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {showPlaylist ? (
        <Playlist
          open={showPlaylist}
          handlePlaylistOpen={handlePlaylistOpen}
          handlePlaylistClose={handlePlaylistClose}
          playlistName={playlistName}
          playlistId={playlistId}
          playlistOwnerId={playlistOwnerId}
          playlist={currPlaylist}
          playlistKeys={playlistKeys}
          token={props.token}
          userId={props.userId}
          updatePlayer={props.updatePlayer}
          addTracksToPlaylistState={addTracksToPlaylistState}
        />
      ) : null}
    </>
  );
};
export default PLLibrary;
