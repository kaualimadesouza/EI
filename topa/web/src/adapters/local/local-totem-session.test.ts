import { describe, expect, it } from 'vitest'

import { LocalTotemSession } from './local-totem-session'

describe('LocalTotemSession', () => {
  it('creates and validates session successfully', async () => {
    const session = new LocalTotemSession()
    const created = await session.createSession('brasa-burgers', 1200)

    expect(created.token).toContain('demo-session-brasa-burgers-')
    expect(created.url).toContain('sessao=')

    const validation = await session.validateSession(created.token, 'brasa-burgers')
    expect(validation.valid).toBe(true)
    expect(validation.storeSlug).toBe('brasa-burgers')
    expect(validation.secondsRemaining).toBeGreaterThan(0)
  })

  it('rejects mismatched store slug', async () => {
    const session = new LocalTotemSession()
    const created = await session.createSession('brasa-burgers')

    const validation = await session.validateSession(created.token, 'bella-nonna')
    expect(validation.valid).toBe(false)
    expect(validation.reason).toBe('store_mismatch')
  })

  it('rejects expired session', async () => {
    const session = new LocalTotemSession()
    const created = await session.createSession('brasa-burgers', -10) // already expired

    const validation = await session.validateSession(created.token)
    expect(validation.valid).toBe(false)
    expect(validation.reason).toBe('expired')
  })

  it('validates inferred demo-session token when not in map', async () => {
    const session = new LocalTotemSession()
    const res = await session.validateSession('demo-session-bella-nonna-abc')
    expect(res.valid).toBe(true)
    expect(res.storeSlug).toBe('bella-nonna')

    const singlePart = await session.validateSession('demo-session-single')
    expect(singlePart.valid).toBe(true)
    expect(singlePart.storeSlug).toBe('single')

    const withStoreSlug = await session.validateSession('demo-session-foo-bar', 'override-store')
    expect(withStoreSlug.valid).toBe(true)
    expect(withStoreSlug.storeSlug).toBe('override-store')

    const emptyPrefix = await session.validateSession('demo-session-')
    expect(emptyPrefix.valid).toBe(true)
    expect(emptyPrefix.storeSlug).toBe('lanchonete-bem-te-vi')
  })

  it('rejects unrecognized token', async () => {
    const session = new LocalTotemSession()
    const res = await session.validateSession('unknown-tok')
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('invalid_or_expired')
  })
})
