/// <reference types="vite/client" />

interface ImportMetaEnv {
  // same-origin only (`/api`, proxied): the API sends no CORS headers, so another origin is blocked
  readonly VITE_API_URL?: string
}
