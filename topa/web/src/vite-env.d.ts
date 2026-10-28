/// <reference types="vite/client" />

interface ImportMetaEnv {
  // `/api` locally, proxied by Vite; production builds take the API's full URL from .env.production,
  // and the origin they are served from must be in its CORS list (topa/api/infrastructure/main.tf)
  readonly VITE_API_URL?: string
}

/** The `topa` version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string
