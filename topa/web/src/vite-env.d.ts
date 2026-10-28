/// <reference types="vite/client" />

interface ImportMetaEnv {
  // same-origin only (`/api`, proxied): the API sends no CORS headers, so another origin is blocked
  readonly VITE_API_URL?: string
}

/** The `topa` version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string
