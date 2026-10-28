/// <reference types="vite/client" />

interface ImportMetaEnv {
  // `/api` under `make run`; production builds read the deployed API's URL from .env.production
  readonly VITE_API_URL?: string
}

/** The `topa` version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string
