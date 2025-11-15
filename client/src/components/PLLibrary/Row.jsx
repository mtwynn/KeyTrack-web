import React from "react";
import { doc, updateDoc } from "firebase/firestore";

import {
    Avatar,
    Button,
    Box,
    Collapse,
    Table,
    TableCell,
    TableRow,
    TableBody,
    TableHead,
    TextField,
    IconButton,
    Typography
} from "@material-ui/core";

import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";

import KeyMap from "../../utils/KeyMap";

// TODO: FIX CHORD PROGRESSIONS BUG HERE
let Row = (props) => {
    const { item } = props;
    const [open, setOpen] = React.useState(false);
    const [editChords, setEditChords] = React.useState(false);
    const [oldProgressions, setOldProgressions] = React.useState(
      props.chordProgressions[item.track.id] || {}
    );
    const [progressions, setProgressions] = React.useState(
      props.chordProgressions[item.track.id] || {}
    );

    let handleChordProgressionChange = (e) => {
      let newObj = { ...progressions };
      newObj[e.target.id] = e.target.value;
      setProgressions(newObj);
    };

    const progressionRef = doc(props.db, `Users/${props.userId}`);

    const getKey = (id) => {
        return props.getKey(id);
    }

    return (
      <React.Fragment>
        <TableRow
          key={item.track.id}
          hover
          style={{ cursor: "pointer" }}
          onClick={(event) => props.handleRowClick(event, item)}
          sx={{ "& > *": { borderBottom: "unset" } }}
        >
          {!props.isMobile && (
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
          )}
          {!props.isMobile && (
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
          )}
          <TableCell>
            {props.isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Avatar
                  variant="square"
                  src={
                    item.track.album.images[0]
                      ? item.track.album.images[0].url
                      : null
                  }
                  style={{ width: 40, height: 40 }}
                ></Avatar>
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
              </div>
            )}
            <div style={{ fontWeight: 'bold' }}>{item.track.name}</div>
            {props.isMobile && (
              <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '4px' }}>
                {item.track.artists.map((artist) => artist.name).join(", ")}
              </div>
            )}
          </TableCell>
          {!props.isMobile && (
            <TableCell>
              {item.track.artists.map((artist) => artist.name).join(", ")}
            </TableCell>
          )}
          <TableCell>
            {getKey(item.track.id) || getKey(item.track.id) === 0
              ? KeyMap[getKey(item.track.id).key].key
              : "N/A"}
          </TableCell>
          {!props.isMobile && (
            <TableCell>
              {getKey(item.track.id) || getKey(item.track.id) === 0
                ? getKey(item.track.id).mode === 1
                  ? "Major"
                  : "Minor"
                : "N/A"}
            </TableCell>
          )}
          {!props.isTablet && (
            <TableCell>
              {getKey(item.track.id) || getKey(item.track.id) === 0
                ? KeyMap[getKey(item.track.id).key].camelot[
                    getKey(item.track.id).mode
                  ]
                : "N/A"}
            </TableCell>
          )}
          {!props.isTablet && (
            <TableCell>
              {getKey(item.track.id) || getKey(item.track.id) === 0
                ? KeyMap[getKey(item.track.id).key].open[
                    getKey(item.track.id).mode
                  ]
                : "N/A"}
            </TableCell>
          )}
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
                        console.log(progressions);
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

  export default Row;