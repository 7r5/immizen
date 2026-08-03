import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
      },
    },
  }
})
