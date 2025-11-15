# 🎵 KeyTrack

A web application for analyzing and organizing your Spotify playlists with key, BPM, and musical metadata.

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 🎹 **Key Detection** - Automatically detect the musical key of tracks
- ⏱️ **BPM Analysis** - View tempo information for harmonic mixing
- 🎚️ **Multiple Key Notations** - Switch between Musical, Camelot, and Open Key systems
- 🎵 **Integrated Player** - Play tracks directly in the browser with Spotify Web Playback
- 🔍 **Advanced Filtering** - Filter playlists by key, quality (major/minor), and BPM range
- 🎼 **Chord Progressions** - Store and view chord progressions for each track

---

## 🚀 Local Development

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Spotify Developer account
- Spotify Premium (required for Web Playback API)

### Setup Instructions

#### 1. Set Environment Variables

Export your Spotify credentials from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

```bash
export SPOTIFY_ID=<spotify_id_from_dev_dashboard>
export SPOTIFY_SECRET=<spotify_secret_from_dev_dashboard>
```

#### 2. Start the Backend Server

Open a terminal window and run:

```bash
cd local-server
npm install  # First time only
npm start
```

The server will start on `http://localhost:8888`

#### 3. Start the Frontend Client

Open a **new** terminal window and run:

```bash
cd client
npm install  # First time only
npm start
```

The client will start on `http://localhost:3000`

#### 4. Login and Use the App

1. Navigate to `http://localhost:3000`
2. Click the **Spotify logo** to authenticate
3. Open your playlist library
4. View track metadata (key, BPM, mode, etc.)
5. Click any song to play it through the integrated player

---

## 🌐 Deployment

### Frontend Deployment (Netlify)

Deploy the React frontend to Netlify:

#### 1. Build the Production Bundle

```bash
cd client
npm run build
```

#### 2. Install Netlify CLI

If not already installed:

```bash
npm install -g netlify-cli
```

#### 3. Deploy to Production

```bash
netlify deploy --prod
```

When prompted for the **publish directory**, specify:

```
./build
```

---

### Backend Deployment (Heroku)

The backend server is configured for **automatic deployment** via Heroku.

#### ⚡ Auto-Deploy (Recommended)

The backend **automatically deploys** when code is merged to the `master` branch:

1. Make your changes and commit to a feature branch
2. Create a pull request to merge into `master`
3. Once merged, **Heroku automatically deploys** the updated backend! 🎉

**No manual deployment needed** - just merge to `master` and Heroku handles the rest.

#### Manual Deploy (if needed)

If you need to deploy manually:

```bash
cd local-server
heroku login
heroku git:remote -a your-app-name
git push heroku master
```

**Note:** The auto-deploy is configured to watch the `master` branch in the connected GitHub repository.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Material-UI** - Component library
- **Spotify Web Playback SDK** - In-browser music player
- **Firebase** - User data storage
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Spotify Web API** - Authentication and data fetching

---

## 📝 Configuration

### Spotify Developer Dashboard

1. Create a new app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URIs:
   - `http://localhost:8888/spotify/callback` (local development)
   - `https://your-app.herokuapp.com/spotify/callback` (production)
3. Note your **Client ID** and **Client Secret**

### Environment Variables

For production deployment, set these environment variables:

- `SPOTIFY_ID` - Your Spotify Client ID
- `SPOTIFY_SECRET` - Your Spotify Client Secret
- `NODE_ENV` - Set to `production` for production builds

---

## 📄 License

MIT License - feel free to use this project for your own purposes!

---

## 👤 Author

**Tam Nguyen**

Powered by Spotify 🎵

---

## 🐛 Troubleshooting

### "Device not found" error
- Ensure you have Spotify Premium
- The player needs to initialize before playing tracks
- Try refreshing the page if the issue persists

### Songs not playing
- Check that you're logged in with a Premium account
- Verify the Spotify Web Playback SDK has loaded
- Check browser console for errors

### Backend connection issues
- Verify environment variables are set correctly
- Ensure the backend server is running on port 8888
- Check that redirect URIs match in Spotify Dashboard

---

**Happy mixing! 🎧✨**

