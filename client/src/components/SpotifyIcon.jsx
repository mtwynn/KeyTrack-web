import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";

// The Spotify wordmark glyph, sized to sit inside a button as a startIcon.
const SpotifyIcon = (props) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.62.62 0 01-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 11-.28-1.21c3.8-.87 7.07-.5 9.71 1.11.3.18.39.57.22.85zm1.23-2.74a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.36.22.48.7.25 1.07zm.1-2.85C14.83 8.98 9.5 8.8 6.42 9.73a.93.93 0 11-.54-1.78c3.53-1.07 9.42-.86 13.13 1.34a.93.93 0 11-.95 1.6z" />
  </SvgIcon>
);

export default SpotifyIcon;
