import { useEffect, useState } from 'react'

import { CATEGORIES, type Product } from '../../domain/menu'
import type { ProductDraft } from '../../ports/menu'
import { CloseIcon } from '../icons'

interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave: (draft: ProductDraft) => Promise<void>
}

export function ProductModal({ product, isOpen, onClose, onSave }: ProductModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setCategory(product.category)
      setPrice((product.priceCents / 100).toFixed(2).replace('.', ','))
      setDescription(product.description)
      setPhotoUrl(product.photoUrl ?? '')
    } else {
      setName('')
      setCategory('lanches')
      setPrice('')
      setDescription('')
      setPhotoUrl('')
    }
    setError(null)
  }, [product, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Informe o nome do produto.')
      return
    }
    const cleanCategory = category.trim()
    if (!cleanCategory) {
      setError('Informe a categoria.')
      return
    }
    const parsedPrice = parseFloat(price.replace(',', '.'))
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Informe um preço válido.')
      return
    }
    const priceCents = Math.round(parsedPrice * 100)
    const cleanPhoto = photoUrl.trim()
    if (
      cleanPhoto &&
      !cleanPhoto.startsWith('http://') &&
      !cleanPhoto.startsWith('https://') &&
      !cleanPhoto.startsWith('/')
    ) {
      setError('A foto deve ser uma URL válida.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: cleanName,
        category: cleanCategory,
        priceCents,
        description: description.trim(),
        photoUrl: cleanPhoto || undefined,
        available: product ? product.available : true,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="flex w-full max-w-[500px] flex-col gap-4 rounded-[20px] bg-white p-6 shadow-xl max-sm:p-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 id="product-modal-title" className="text-[20px] font-bold text-ink">
            {product ? 'Editar produto' : 'Novo produto'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer text-muted hover:text-ink"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        {error && (
          <div role="alert" className="rounded-[12px] bg-warning-tint px-4 py-2 text-[14px] font-medium text-warning">
            {error}
          </div>
        )}
        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 text-[15px]">
          <div className="flex flex-col gap-1">
            <label htmlFor="product-name" className="font-medium text-ink">
              Nome
            </label>
            <input
              id="product-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pastel de queijo"
              className="h-11 rounded-[10px] border border-line px-3 text-ink focus:border-teal focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="product-category" className="font-medium text-ink">
              Categoria
            </label>
            <input
              id="product-category"
              type="text"
              required
              list="categories-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex.: lanches"
              className="h-11 rounded-[10px] border border-line px-3 text-ink focus:border-teal focus:outline-none"
            />
            <datalist id="categories-list">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="product-price" className="font-medium text-ink">
              Preço (R$)
            </label>
            <input
              id="product-price"
              type="text"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className="h-11 rounded-[10px] border border-line px-3 text-ink tabular-nums focus:border-teal focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="product-description" className="font-medium text-ink">
              Descrição
            </label>
            <textarea
              id="product-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do produto."
              className="rounded-[10px] border border-line p-3 text-ink focus:border-teal focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="product-photo-url" className="font-medium text-ink">
              URL da foto (opcional)
            </label>
            <input
              id="product-photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="h-11 rounded-[10px] border border-line px-3 text-ink focus:border-teal focus:outline-none"
            />
          </div>
          <div className="mt-2 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 cursor-pointer rounded-[10px] border border-line px-4 font-medium text-muted hover:bg-ground-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 cursor-pointer rounded-[10px] bg-teal px-5 font-semibold text-white hover:bg-slate disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
