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
  Toolbar,
  Paper,
  makeStyles,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";

import { MenuOpen, Search, MusicNote } from "@material-ui/icons";

import Spotify from "spotify-web-api-js";

import Playlist from "./Playlist";
import { useEffect } from "react";

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
  playlistCard: {
    marginBottom: theme.spacing(2),
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4],
      backgroundColor: "#f0fff4",
    },
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(1),
    },
  },
  cardContent: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(2),
    "&:last-child": {
      paddingBottom: theme.spacing(2),
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.5),
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
  albumArt: {
    width: 80,
    height: 80,
    marginRight: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      width: 60,
      height: 60,
      marginRight: 0,
      marginBottom: theme.spacing(1),
    },
  },
  playlistInfo: {
    flex: 1,
    minWidth: 0,
    [theme.breakpoints.down('sm')]: {
      width: "100%",
    },
  },
  playlistHeader: {
    display: "flex",
    alignItems: "baseline",
    marginBottom: theme.spacing(0.5),
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
    },
  },
  playlistTitle: {
    fontWeight: 600,
    fontSize: "1.1rem",
    [theme.breakpoints.down('sm')]: {
      fontSize: "1rem",
    },
  },
  playlistDescription: {
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
    marginBottom: theme.spacing(1),
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    [theme.breakpoints.down('sm')]: {
      fontSize: "0.75rem",
      WebkitLineClamp: 1,
    },
  },
  playlistMeta: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
    },
  },
  ownerText: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    fontWeight: 400,
    [theme.breakpoints.down('sm')]: {
      fontSize: "0.7rem",
    },
  },
  trackChip: {
    backgroundColor: "#1ED760",
    color: "#fff",
    fontWeight: 600,
    height: 24,
    [theme.breakpoints.down('sm')]: {
      height: 20,
      fontSize: "0.75rem",
    },
  },
  openButton: {
    marginLeft: theme.spacing(2),
    color: "#1ED760",
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      alignSelf: "center",
    },
  },
}));

let PLLibrary = (props) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
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

      <Box sx={{ padding: isMobile ? 1 : 2 }}>
        {searchItems.map((playlist) => (
          <Card
            key={playlist.id}
            className={classes.playlistCard}
            onClick={() => handlePlaylistOpen(playlist)}
          >
            <CardContent className={classes.cardContent}>
              {/* Album Art */}
              <Avatar
                variant="square"
                src={playlist.images[0] ? playlist.images[0].url : undefined}
                className={classes.albumArt}
              >
                <MusicNote />
              </Avatar>

              {/* Playlist Info */}
              <Box className={classes.playlistInfo}>
                {/* Title and Owner - Always on same line */}
                <Box className={classes.playlistHeader}>
                  <Typography className={classes.playlistTitle}>
                    {playlist.name}
                  </Typography>
                  <Typography className={classes.ownerText}>
                    by {playlist.owner.display_name}
                  </Typography>
                </Box>

                {/* Description */}
                {playlist.description && (
                  <Typography className={classes.playlistDescription}>
                    {playlist.description}
                  </Typography>
                )}

                {/* Meta Info: Track Count */}
                <Box className={classes.playlistMeta}>
                  <Chip
                    label={`${playlist.tracks.total} tracks`}
                    size="small"
                    className={classes.trackChip}
                    icon={<MusicNote style={{ color: "#fff" }} />}
                  />
                </Box>
              </Box>

              {/* Open Button */}
              {!isMobile && (
                <IconButton
                  className={classes.openButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaylistOpen(playlist);
                  }}
                >
                  <MenuOpen />
                </IconButton>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

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
