# immizen

A Netflix-style [Immich](https://immich.app) viewer for Samsung Smart TVs (Tizen). Navigate your personal photo library from your couch using only the TV remote.

## Features

- Auto-login with credentials stored locally — no login screen
- Netflix-style album browser: horizontal rows for your albums and shared albums
- Full-screen photo viewer with left/right D-pad navigation
- Video playback in full screen
- Slideshow mode with configurable interval (3 / 5 / 10 seconds)
- D-pad-only navigation optimized for TV remote (1920×1080)

## Requirements

- [Immich](https://immich.app) running on your local network
- Samsung Smart TV with Tizen OS (or Tizen Studio for emulation)
- Node.js ≥ 18

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
VITE_IMMICH_URL=http://192.168.1.100:2283
VITE_IMMICH_EMAIL=your@email.com
VITE_IMMICH_PASSWORD=yourpassword
```

**3. Run in development**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. The app connects to Immich automatically on load.

**4. Build for Tizen**

```bash
npm run build
```

The `dist/` output is ready to be packaged as a `.wgt` Tizen web app using Tizen Studio. Copy the contents of `dist/` into your Tizen project and build the widget from there.

## Remote Navigation

| Key | Action |
|---|---|
| ← → | Navigate cards within a row / prev-next in viewer |
| ↑ ↓ | Switch between album rows |
| ← at first card | Focus sidebar |
| → from sidebar | Focus content |
| Enter | Open album / open asset / toggle slideshow |
| Back | Return to previous screen / stop slideshow |

### Viewer controls

| Key | Action |
|---|---|
| ← / → | Previous / next asset. Manual navigation pauses the slideshow. |
| Enter | Start or pause the slideshow. |
| ↓ | Open the viewer controls. |
| ← / → (in controls) | Move control focus. |
| Enter (in controls) | Select playback, interval, information, music, or exit. |
| ↑ / Back (in controls) | Close viewer controls. |
| Back (viewer) | Return to the album. |

Photos wait for their full image and background preview before a transition begins. Slides use a short cross-dissolve with restrained motion: landscape photos can pan or zoom slightly, while portrait photos remain fully visible without zoom. Videos play through completely before the slideshow advances.

## Project Structure

```
src/
  api/immich.js              — Immich REST API client
  context/AppContext.jsx     — Global auth + navigation state
  hooks/useDpad.js           — D-pad keyboard hooks (rows, grid, viewer)
  screens/
    MainLayout.jsx           — Sidebar + content layout
    AlbumsScreen.jsx         — Netflix-style album rows
    AlbumDetailScreen.jsx    — Asset grid for a single album
    ViewerScreen.jsx         — Full-screen photo/video viewer
  components/
    AlbumCard.jsx            — Album thumbnail card
    AlbumRow.jsx             — Horizontal scrollable row
```

## Notes

- Media URLs use `?accessToken=` query param — requires Immich v1.x or newer.
- For CORS to work from a packaged Tizen app, Immich should be reachable from the TV's network. The Tizen webview typically relaxes CORS for packaged apps.
- During development the Vite dev server proxies `/api` requests to your `VITE_IMMICH_URL`.
