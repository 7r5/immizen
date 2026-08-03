import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync } from 'fs'
import { resolve } from 'path'

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
        .map((f) => `/music/${f}`)
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    plugins: [react(), musicTracksPlugin()],
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
