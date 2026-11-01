import { describe, expect, it, vi } from 'vitest'

import type { HttpClient } from './http-client'
import { HttpTotemSession } from './http-totem-session'

describe('HttpTotemSession', () => {
  it('creates session via POST /totem/sessions', async () => {
    const fakeClient = {
      post: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: 'tok-123',
          url: 'https://topa-totem.vercel.app/?loja=brasa-burgers&sessao=tok-123',
          expires_at: '2026-10-31T21:00:00Z',
        }),
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    const result = await session.createSession('brasa-burgers')

    expect(fakeClient.post).toHaveBeenCalledWith('/totem/sessions', {
      store_slug: 'brasa-burgers',
      duration_seconds: 1800,
    })
    expect(result.token).toBe('tok-123')
    expect(result.expiresAt).toBe('2026-10-31T21:00:00Z')
  })

  it('throws on create session failure', async () => {
    const fakeClient = {
      post: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    await expect(session.createSession('unknown')).rejects.toThrow('POST /totem/sessions failed with 404')
  })

  it('validates session via GET /totem/sessions/validate', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: true,
          store_slug: 'brasa-burgers',
          expires_at: '2026-10-31T21:00:00Z',
          seconds_remaining: 1200,
        }),
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    const res = await session.validateSession('tok-123', 'brasa-burgers')

    expect(fakeClient.get).toHaveBeenCalledWith(
      '/totem/sessions/validate?token=tok-123&store_slug=brasa-burgers',
      undefined,
      null,
    )
    expect(res.valid).toBe(true)
    expect(res.storeSlug).toBe('brasa-burgers')
  })

  it('returns invalid on HTTP error status during validate', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    const res = await session.validateSession('bad-tok')
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('request_failed')
  })

  it('returns invalid session result when backend returns valid=false', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: false,
          reason: 'expired',
          store_slug: 'brasa-burgers',
        }),
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    const res = await session.validateSession('expired-tok')
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('expired')
    expect(res.storeSlug).toBe('brasa-burgers')
  })

  it('falls back to invalid reason when reason is missing in invalid response', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: false,
        }),
      }),
    } as unknown as HttpClient

    const session = new HttpTotemSession(fakeClient)
    const res = await session.validateSession('unknown-tok')
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('invalid')
  })
})
