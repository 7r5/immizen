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
      },
    },
  }
})
