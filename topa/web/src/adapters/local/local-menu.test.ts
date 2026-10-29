import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { DEMO_STORE_SLUG } from '../../domain/store'
import { StoreNotFoundError } from '../../ports/menu'
import { LocalMenu } from './local-menu'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('LocalMenu', () => {
  it('serves the demo store and its catalog as copies, so callers cannot mutate it', async () => {
    const { store, products } = await new LocalMenu(new MemoryStorage()).load(DEMO_STORE_SLUG)
    products[0].available = false

    expect(store).toEqual({ slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' })
    expect(products).toHaveLength(18)
    expect(DEMO_CATALOG[0].available).toBe(true)
  })

  it('remembers a sold-out product for every tab on the same storage, until it is back', async () => {
    const storage = new MemoryStorage()

    const soldOut = await new LocalMenu(storage).setAvailability('coxinha', false, DEMO_STORE_SLUG)
    const { products: seenByAnotherTab } = await new LocalMenu(storage).load(DEMO_STORE_SLUG)

    expect(soldOut).toMatchObject({ id: 'coxinha', available: false })
    expect(seenByAnotherTab.find((p) => p.id === 'coxinha')?.available).toBe(false)
    expect(seenByAnotherTab.filter((p) => !p.available)).toHaveLength(1)

    await new LocalMenu(storage).setAvailability('coxinha', true, DEMO_STORE_SLUG)

    expect((await new LocalMenu(storage).load(DEMO_STORE_SLUG)).products.every((p) => p.available)).toBe(true)
  })

  it('refuses an unknown store with StoreNotFoundError', async () => {
    const menu = new LocalMenu(new MemoryStorage())

    await expect(menu.load('outra-loja')).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))
    await expect(menu.setAvailability('coxinha', false, 'outra-loja')).rejects.toEqual(
      new StoreNotFoundError('Loja não encontrada.'),
    )
  })

  it('refuses a product the catalog does not have', async () => {
    await expect(new LocalMenu(new MemoryStorage()).setAvailability('gone', false, DEMO_STORE_SLUG)).rejects.toThrow(
      'No product gone',
    )
  })

  it('uses the browser storage by default', async () => {
    localStorage.clear()

    await new LocalMenu().setAvailability('suco', false, DEMO_STORE_SLUG)

    expect(JSON.parse(localStorage.getItem('topa.sold-out')!)).toEqual(['suco'])
  })

  it('creates and persists a new product', async () => {
    const storage = new MemoryStorage()
    const menu = new LocalMenu(storage)

    const created = await menu.create(
      {
        id: 'pastel-queijo',
        name: 'Pastel de Queijo',
        description: 'Massa crocante.',
        category: 'salgados',
        priceCents: 900,
        photoUrl: 'https://example.com/pastel.jpg',
        available: false,
      },
      DEMO_STORE_SLUG,
    )

    expect(created).toEqual({
      id: 'pastel-queijo',
      name: 'Pastel de Queijo',
      description: 'Massa crocante.',
      category: 'salgados',
      priceCents: 900,
      photoUrl: 'https://example.com/pastel.jpg',
      available: false,
    })

    const { products } = await new LocalMenu(storage).load(DEMO_STORE_SLUG)
    expect(products.find((p) => p.id === 'pastel-queijo')).toEqual(created)
  })

  it('generates an id when creating a product without one', async () => {
    const menu = new LocalMenu(new MemoryStorage())
    const created = await menu.create(
      {
        name: 'Torta de Limao',
        description: '',
        category: 'doces',
        priceCents: 1200,
      },
      DEMO_STORE_SLUG,
    )

    expect(created.id).toBe('torta-de-limao')
    expect(created.available).toBe(true)

    const fallbackId = await menu.create(
      {
        name: '!!!',
        description: '',
        category: 'doces',
        priceCents: 1000,
      },
      DEMO_STORE_SLUG,
    )
    expect(fallbackId.id).toMatch(/^p-\d+$/)
  })

  it('updates a custom product without modifying availability if omitted', async () => {
    const storage = new MemoryStorage()
    const menu = new LocalMenu(storage)

    const created = await menu.create(
      {
        id: 'trufa-chocolate',
        name: 'Trufa de Chocolate',
        description: 'Docinho.',
        category: 'doces',
        priceCents: 400,
        available: false,
      },
      DEMO_STORE_SLUG,
    )
    expect(created.available).toBe(false)

    const updated = await menu.update(
      'trufa-chocolate',
      {
        name: 'Trufa Gourmet',
        description: 'Chocolate belga.',
        category: 'doces',
        priceCents: 500,
      },
      DEMO_STORE_SLUG,
    )
    expect(updated.name).toBe('Trufa Gourmet')
    expect(updated.available).toBe(false)

    const restored = await menu.update(
      'trufa-chocolate',
      {
        name: 'Trufa Gourmet',
        description: 'Chocolate belga.',
        category: 'doces',
        priceCents: 500,
        available: true,
      },
      DEMO_STORE_SLUG,
    )
    expect(restored.available).toBe(true)
  })

  it('refuses creating duplicate product id or in unknown store', async () => {
    const menu = new LocalMenu(new MemoryStorage())

    await expect(
      menu.create(
        { id: 'coxinha', name: 'Coxinha', description: '', category: 'salgados', priceCents: 890 },
        DEMO_STORE_SLUG,
      ),
    ).rejects.toThrow('Produto já cadastrado.')

    await expect(
      menu.create(
        { name: 'Empada', description: '', category: 'salgados', priceCents: 890 },
        'outra-loja',
      ),
    ).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))
  })

  it('updates an existing product', async () => {
    const storage = new MemoryStorage()
    const menu = new LocalMenu(storage)

    const updated = await menu.update(
      'coxinha',
      {
        name: 'Coxinha de Frango',
        description: 'Receita da vovo.',
        category: 'salgados-especiais',
        priceCents: 950,
        photoUrl: 'https://example.com/coxinha.jpg',
        available: false,
      },
      DEMO_STORE_SLUG,
    )

    expect(updated).toEqual({
      id: 'coxinha',
      name: 'Coxinha de Frango',
      description: 'Receita da vovo.',
      category: 'salgados-especiais',
      priceCents: 950,
      photoUrl: 'https://example.com/coxinha.jpg',
      available: false,
    })

    const { products } = await new LocalMenu(storage).load(DEMO_STORE_SLUG)
    expect(products.find((p) => p.id === 'coxinha')).toEqual(updated)
  })

  it('refuses updating unknown product or in unknown store', async () => {
    const menu = new LocalMenu(new MemoryStorage())

    await expect(
      menu.update(
        'inexistente',
        { name: 'X', description: '', category: 'salgados', priceCents: 500 },
        DEMO_STORE_SLUG,
      ),
    ).rejects.toThrow('Produto não encontrado.')

    await expect(
      menu.update(
        'coxinha',
        { name: 'X', description: '', category: 'salgados', priceCents: 500 },
        'outra-loja',
      ),
    ).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))
  })
})
