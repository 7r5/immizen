import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

const AUDIO_RE = /\.(mp3|m4a|ogg|wav|flac)$/i
const VIRTUAL_ID = 'virtual:music-tracks'
const RESOLVED_ID = '\0' + VIRTUAL_ID

function musicTracksPlugin() {
  const musicDir = resolve(process.cwd(), 'public/music')

  function loadTracks() {
    try {
      return readdirSync(musicDir)
        .filter((f) => AUDIO_RE.test(f))
        .sort()
        .map((f) => `./music/${encodeURIComponent(f)}`)
    } catch {
      return []
    }
  }

  return {
    name: 'music-tracks',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      return `export default ${JSON.stringify(loadTracks())}`
    },
    // In dev, invalidate the virtual module when files are added/removed
    configureServer(server) {
      server.watcher.add(musicDir)
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
      function invalidate(file) {
        if (!AUDIO_RE.test(file)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.hot.send({ type: 'full-reload' })
      }
    },
  }
}

function getCommitInfo() {
  try {
    const hash = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
    const subject = execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim()
    return { hash, subject }
  } catch {
    return { hash: 'unknown', subject: 'commit unavailable' }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const commitInfo = getCommitInfo()
  return {
    base: './',
    plugins: [react(), musicTracksPlugin()],
    define: {
      __APP_COMMIT_INFO__: JSON.stringify(commitInfo),
    },
    build: {
      // Tizen 7 TVs use a Chromium 94-class web runtime.
      target: 'chrome94',
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_IMMICH_URL || 'http://localhost:2283',
          changeOrigin: true,
          secure: false,
        },
        // proxy for Uptime Kuma socket.io (bypasses CORS in dev)
        '/uptime-proxy': {
          target: env.VITE_UPTIME_URL || 'http://localhost:31050',
          changeOrigin: true,
          ws: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/uptime-proxy/, ''),
        },
        // proxy for TrueNAS REST API — server-side connection bypasses self-signed cert
        '/truenas-api': {
          target: env.VITE_TRUENAS_URL || 'https://192.168.72.55',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/truenas-api/, ''),
        },
      },
    },
  }
})
