/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// compose points the proxy at the api container; outside compose the API listens on the host
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8010'
  // `tauri android dev` sets it: the phone loads the dev server over the LAN, not localhost
  const tauriHost = env.TAURI_DEV_HOST

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: tauriHost || false,
      hmr: tauriHost ? { protocol: 'ws', host: tauriHost, port: 1421 } : undefined,
      watch: { ignored: ['**/src-tauri/**'] },
      proxy: {
        '/api': { target, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
        reporter: ['text', 'lcov'],
        thresholds: { 100: true },
      },
    },
  }
})
