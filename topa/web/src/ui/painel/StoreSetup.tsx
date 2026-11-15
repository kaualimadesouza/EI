import { useState } from 'react'

import type { StoresPort } from '../../ports/stores'
import { Qr } from '../kiosk/Qr'

interface StoreSetupProps {
  storeSlug: string
  storeName: string | null
  loaded: boolean
  accepting: boolean
  productCount: number
  availableCount: number
  stores: StoresPort
  onAddProduct: () => void
  onOrderingChanged: (accepting: boolean) => void
}

export function StoreSetup({
  storeSlug,
  storeName,
  loaded,
  accepting,
  productCount,
  availableCount,
  stores,
  onAddProduct,
  onOrderingChanged,
}: StoreSetupProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuPath = `${import.meta.env.BASE_URL}pedir?loja=${encodeURIComponent(storeSlug)}`
  const menuUrl = new URL(menuPath, window.location.origin).href

  const toggleOrdering = async () => {
    setSaving(true)
    setError(null)
    try {
      onOrderingChanged(await stores.setAcceptingOrders(storeSlug, !accepting))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível alterar os pedidos. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label="Preparar loja"
      className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-[20px] font-semibold">{storeName ?? 'Carregando sua loja...'}</h2>
          <p className="mt-1 text-[14px] font-medium text-teal">
            {accepting ? 'Loja aberta para pedidos' : 'Pedidos pausados'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggleOrdering()}
          disabled={!loaded || saving || (!accepting && availableCount === 0)}
          className="min-h-12 cursor-pointer rounded-[12px] bg-teal px-4 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {accepting ? 'Pausar pedidos' : 'Abrir loja'}
        </button>
      </div>
      {productCount === 0 && loaded && (
        <div className="rounded-[12px] bg-sage-tint p-4">
          <h3 className="font-semibold">Comece pelo seu cardápio</h3>
          <p className="mt-1 text-[14px] text-muted">
            Cadastre um produto à venda. Depois, abra a loja e compartilhe o cardápio com seus clientes.
          </p>
          <button
            type="button"
            onClick={onAddProduct}
            className="mt-3 min-h-11 cursor-pointer font-semibold text-teal underline"
          >
            Cadastrar primeiro produto
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-[12px] bg-warning-tint p-3 text-[14px] text-warning">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-[14px] font-medium text-teal">
        <a
          href={menuPath}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-[10px] border border-teal px-3"
        >
          Ver cardápio
        </a>
        <a
          href={`${import.meta.env.BASE_URL}totem?loja=${encodeURIComponent(storeSlug)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-[10px] border border-teal px-3"
        >
          Abrir o totem
        </a>
      </div>
      <details className="rounded-[12px] bg-ground-2 p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-[14px] font-medium text-teal">
          Compartilhar cardápio com QR Code
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Qr value={menuUrl} size={160} label="QR Code do cardápio da sua loja" />
          <div className="min-w-0 flex-1 basis-52">
            <label htmlFor="store-menu-link" className="text-[14px] font-medium">
              Link do cardápio
            </label>
            <input
              id="store-menu-link"
              readOnly
              value={menuUrl}
              className="mt-2 h-12 w-full min-w-0 rounded-[10px] border border-slate bg-white px-3 text-[14px] text-ink"
            />
            <p className="mt-2 text-[13px] text-muted">
              Copie o link ou use o QR Code. O cliente faz o pedido no navegador, sem instalar um aplicativo.
            </p>
          </div>
        </div>
      </details>
      <p className="text-[13px] leading-relaxed text-muted">
        Ao encerrar o dia, pause os pedidos, conclua os que estão em andamento e confira o Resumo do dia. Ele
        mostra as vendas pelo TOPA e não substitui o fechamento do seu caixa.
      </p>
    </section>
  )
}
