import { describe, expect, it } from 'vitest'

import { phoneMenuUrl, storeFromUrl } from './store'

describe('storeFromUrl', () => {
  it('reads the store slug from the loja parameter of an https URL', () => {
    expect(storeFromUrl('https://topa-totem.vercel.app/?loja=lanchonete-bauru')).toEqual({
      slug: 'lanchonete-bauru',
      url: 'https://topa-totem.vercel.app/?loja=lanchonete-bauru',
    })
  })

  it('accepts plain http, which a store testing on its own network may use', () => {
    expect(storeFromUrl('http://192.168.0.10:5180/?loja=padaria-sol')).toEqual({
      slug: 'padaria-sol',
      url: 'http://192.168.0.10:5180/?loja=padaria-sol',
    })
  })

  it('keeps the rest of the URL as written on the sticker, normalized', () => {
    expect(storeFromUrl('https://TOPA-TOTEM.vercel.app?mesa=4&loja=cafe-2')).toEqual({
      slug: 'cafe-2',
      url: 'https://topa-totem.vercel.app/?mesa=4&loja=cafe-2',
    })
  })

  it('rejects a URL without the loja parameter', () => {
    expect(storeFromUrl('https://topa-totem.vercel.app/')).toBeNull()
  })

  it('rejects an empty loja parameter', () => {
    expect(storeFromUrl('https://topa-totem.vercel.app/?loja=')).toBeNull()
  })

  it('rejects a slug that is not lowercase letters, digits and hyphens', () => {
    expect(storeFromUrl('https://topa-totem.vercel.app/?loja=Padaria%20Sol')).toBeNull()
    expect(storeFromUrl('https://topa-totem.vercel.app/?loja=-sol')).toBeNull()
  })

  it('rejects schemes other than http and https', () => {
    expect(storeFromUrl('javascript:alert(1)//?loja=x')).toBeNull()
    expect(storeFromUrl('tel:+5511999999999?loja=x')).toBeNull()
  })

  it('rejects text that is not a URL at all', () => {
    expect(storeFromUrl('lanchonete-bauru')).toBeNull()
  })
})

describe('phoneMenuUrl', () => {
  it('points to the hosted site when the totem runs on loopback, a wildcard bind, or an opaque origin', () => {
    for (const origin of [
      'http://localhost:5180',
      'http://localhost.:5180',
      'http://127.0.0.1:5173',
      'http://127.0.1.1:5180',
      'http://0.0.0.0:5180',
      'http://[::1]:5180',
      'http://[::]:5180',
      'http://tauri.localhost',
      'tauri://localhost',
      'null',
    ]) {
      expect(phoneMenuUrl(origin)).toBe('https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi')
    }
  })

  it('keeps the totem origin when a phone on the network or the internet can reach it', () => {
    expect(phoneMenuUrl('https://topa-totem.vercel.app')).toBe(
      'https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi',
    )
    expect(phoneMenuUrl('http://192.168.0.10:5180', '/totem/')).toBe(
      'http://192.168.0.10:5180/totem/?loja=lanchonete-bem-te-vi',
    )
    expect(storeFromUrl(phoneMenuUrl('https://topa-totem.vercel.app'))).toEqual({
      slug: 'lanchonete-bem-te-vi',
      url: 'https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi',
    })
    expect(phoneMenuUrl('https://topa-totem.vercel.app', '/', 'cantina-central')).toBe(
      'https://topa-totem.vercel.app/?loja=cantina-central',
    )
  })
})
