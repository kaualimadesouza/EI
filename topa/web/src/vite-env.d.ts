/// <reference types="vite/client" />

interface ImportMetaEnv {
  // `/api` locally, proxied by Vite; a deployed build takes the API's full URL, whose CORS list
  // (topa/api/infrastructure/main.tf) must include the origin the build is served from
  readonly VITE_API_URL?: string
}

/** The `topa` version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string
