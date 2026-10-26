/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// compose points the proxy at the api container; outside it, `make run` in topa/api serves on 8000
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8000'

  return {
    // GitHub Pages serves the repo under /EI/; Vercel and dev serve from the root
    base: env.BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': { target, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        // remaps through the AST, so an `if` without `else` counts its untaken arm
        experimentalAstAwareRemapping: true,
        include: ['src/**'],
        exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
        reporter: ['text', 'lcov'],
        thresholds: { 100: true },
      },
    },
  }
})
