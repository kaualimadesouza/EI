import { describe, expect, it } from 'vitest'

import { storeFromUrl } from './store'

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
