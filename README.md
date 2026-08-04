# immizen

A Netflix-style [Immich](https://immich.app) viewer for Samsung Smart TVs (Tizen). Browse your personal photo library from your couch using only the TV remote — plus a built-in homelab status dashboard (Uptime Kuma + TrueNAS).

## Features

- Auto-login with credentials stored locally — no login screen
- Netflix-style sidebar layout with two sections: **Albums** and **Uptime**
- Album browser: year-grouped sections with larger cards, using a sampled month/year label per album
- Full-screen photo viewer with left/right D-pad navigation
- Video playback in full screen, with orientation handling for rotated assets
- Slideshow mode with configurable interval (3 / 5 / 10 seconds)
- Animated slideshow transitions with a toggle to enable/disable fade and motion
- Ambient music during the slideshow — tracks are auto-discovered from `public/music/`, shuffled randomly, with skip-track control
- Smooth transitions: images are cached and next/previous slides are preloaded before each transition
- Aspect-aware motion: landscape photos pan/zoom subtly, portrait photos stay fully visible, with a blurred background fill
- Uptime dashboard: live Uptime Kuma monitor list with heartbeat bars, plus TrueNAS CPU/RAM usage
- D-pad-only navigation optimized for TV remote (1920×1080)
- Semantic controls, visible focus, reduced-motion support, bounded image caching, and a randomized UI accent theme on each app launch
- Footer badge showing the current git commit hash and commit subject snippet

## Requirements

- [Immich](https://immich.app) running on your local network
- Samsung Smart TV with Tizen 7.0 or newer (or Tizen Studio for emulation)
- Node.js ≥ 20.19
- *(optional)* [Uptime Kuma](https://github.com/louislam/uptime-kuma) and/or [TrueNAS SCALE](https://www.truenas.com) for the Uptime dashboard

## Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/7r5/immizen.git
cd immizen
npm install
```

**2. Create your credentials file**

Create a `.env.local` file in the project root (this file is git-ignored):

```env
# Immich (required)
VITE_IMMICH_URL=http://192.168.1.100:2283
VITE_IMMICH_EMAIL=your@email.com
VITE_IMMICH_PASSWORD=yourpassword

# Uptime Kuma (optional — powers the Uptime screen)
VITE_UPTIME_URL=http://192.168.1.100:3001
VITE_UPTIME_USER=your-username
VITE_UPTIME_PASSWORD=your-password

# TrueNAS SCALE (optional — CPU/RAM stats on the Uptime screen)
VITE_TRUENAS_URL=https://192.168.1.100
VITE_TRUENAS_KEY=your-truenas-api-key
```

The Uptime and TrueNAS variables are optional: leave them out and the Uptime screen simply hides the sections it can't reach.

**3. Add slideshow music (optional)**

Drop any `.mp3`, `.m4a`, `.ogg`, `.wav`, or `.flac` files into `public/music/`. They are auto-discovered at build time and during dev — no manual registration needed. Tracks are shuffled randomly for each session and can be skipped from the viewer controls.

**4. Favicon**

The web favicon uses the existing `public/icon.png` file.

**5. Run in development**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. The app connects to Immich automatically on load. In dev, Vite proxies requests to Immich, Uptime Kuma, and TrueNAS to sidestep CORS and self-signed certificates.

**6. Build for Tizen**

```bash
npm run build
```

This builds the app into `dist/` and then copies the output into `Debug/projects/immizen/` (via `scripts/sync-tizen-dist.mjs`). Package **that staging directory** as the widget root; do not package the Vite source root.

With a configured Tizen signing profile:

```bash
tizen package -t wgt -s YOUR_SIGNING_PROFILE -- Debug/projects/immizen
```

To run lint and rebuild the staging directory in one command:

```bash
npm run check
```

## Remote Navigation

| Key | Action |
|---|---|
| ← → | Navigate cards within a row / prev-next in viewer |
| ↑ ↓ | Switch between album rows / sidebar items |
| ← at first card | Focus sidebar |
| → from sidebar | Focus content |
| Enter | Open album / open asset / switch screen / toggle slideshow |
| Back | Return to the previous screen; at the root, exit the TV app |

### Viewer controls

| Key | Action |
|---|---|
| ← / → | Previous / next asset. Manual navigation pauses the slideshow. |
| Enter | Start or pause the slideshow. |
| ↓ | Open the viewer controls. |
| ← / → (in controls) | Move control focus. |
| Enter (in controls) | Select playback, interval, animations, information, skip music, or exit. |
| ↑ / Back (in controls) | Close viewer controls. |
| Back (viewer) | Return to the album. |

Photos wait for their full image and background preview before a transition begins. Slides use a short cross-dissolve with restrained motion by default; the viewer controls now include an animations switch to turn fade and motion on or off. Videos are de-rotated/corrected based on metadata when needed. Music tracks are chosen in a random order.

### Albums browser

Albums are displayed in year sections. Each album shows a date range derived from a small sample of its photos, and the app keeps the list in vertical scroll order for TV navigation.

## Project Structure

```
src/
  api/
    immich.js                — Immich REST API client
    uptime.js                — Uptime Kuma socket.io client
    truenas.js               — TrueNAS SCALE CPU/RAM stats
    imageCache.js            — Bounded, decoded Blob-URL image cache
  context/AppContext.jsx     — Global auth + navigation state
  hooks/
    useDpad.js               — D-pad keyboard hooks (rows, grid, 1D)
    useMusicPlayer.js        — Slideshow audio playback + track skipping
    useImagePreloader.js     — Preload next/prev slides into cache
  config/music.js            — Auto-discovered music track list
  screens/
    MainLayout.jsx           — Sidebar + content layout
    AlbumsScreen.jsx         — Netflix-style album rows
    AlbumDetailScreen.jsx    — Asset grid for a single album
    ViewerScreen.jsx         — Full-screen photo/video viewer + slideshow
    UptimeScreen.jsx         — Uptime Kuma + TrueNAS dashboard
  components/
    AlbumCard.jsx            — Album thumbnail card
    AlbumRow.jsx             — Horizontal scrollable row
    AuthImage.jsx            — Image with bearer-auth via blob URL
scripts/
  sync-tizen-dist.mjs        — Copies dist/ into the Tizen project
public/music/                — Drop slideshow audio files here
```

## Notes

- Images and thumbnails are fetched with an `Authorization: Bearer` header and served as blob URLs (see `AuthImage` and `imageCache.js`), so no `?accessToken=` leaks into image URLs. Videos still use `?accessToken=` because `<video>` cannot set request headers.
- Album assets are fetched via `POST /api/search/metadata` for newer Immich versions that no longer embed assets in the album response.
- For CORS to work from a packaged Tizen app, Immich should be reachable from the TV's network. The Tizen webview typically relaxes CORS for packaged apps.
- During development the Vite dev server proxies `/api` (Immich), `/uptime-proxy` (Uptime Kuma socket.io), and `/truenas-api` (TrueNAS, self-signed cert) to their respective targets.
- Production targets the Chromium 94-class runtime used by Tizen 7 TVs.

## Security

All `VITE_*` values are compiled into the client bundle. Treat the widget as a trusted-LAN application: use dedicated low-privilege accounts and API keys, restrict server access to your local network, prefer HTTPS, and never distribute a widget containing personal credentials. Video playback currently requires the Immich access token in the media URL because a native `<video>` element cannot attach an `Authorization` header.
