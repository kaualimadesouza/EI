// @vitest-environment node
import { fileURLToPath } from 'node:url'

import { loadEnv } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllEnvs())

it('builds for production against the deployed API, named by its bare https origin', () => {
  // a VITE_API_URL in the shell would beat the file, and the file is what ships
  vi.stubEnv('VITE_API_URL', undefined)

  const env = loadEnv('production', fileURLToPath(new URL('..', import.meta.url)), 'VITE_')

  expect(env.VITE_API_URL).toMatch(/^https:\/\/[a-z0-9.-]+$/)
})
