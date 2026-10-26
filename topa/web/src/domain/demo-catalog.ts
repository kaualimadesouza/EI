import type { Product } from './menu'

/** The demo store's menu, the same rows the API seeds, for the cloud build that has no API. */
export const DEMO_CATALOG: readonly Product[] = [
  { id: 'combo-cafe', category: 'combos', name: 'Café + pão de queijo', description: 'Café coado e três pães de queijo.', priceCents: 1290, available: true },
  { id: 'combo-misto', category: 'combos', name: 'Misto + suco', description: 'Misto quente com suco de laranja de 300 ml.', priceCents: 2290, available: true },
  { id: 'misto', category: 'lanches', name: 'Misto quente', description: 'Pão de forma, presunto e queijo na chapa.', priceCents: 1490, available: true },
  { id: 'xsalada', category: 'lanches', name: 'X-salada', description: 'Hambúrguer, queijo, alface e tomate.', priceCents: 2290, available: true },
  { id: 'bauru', category: 'lanches', name: 'Bauru', description: 'Rosbife, queijo, tomate e picles no pão francês.', priceCents: 1890, available: true },
  { id: 'americano', category: 'lanches', name: 'Americano', description: 'Presunto, queijo, ovo, alface e tomate.', priceCents: 1990, available: true },
  { id: 'paoqueijo', category: 'salgados', name: 'Pão de queijo', description: 'Porção com três unidades.', priceCents: 750, available: true },
  { id: 'coxinha', category: 'salgados', name: 'Coxinha', description: 'Frango com catupiry.', priceCents: 890, available: true },
  { id: 'esfiha', category: 'salgados', name: 'Esfiha de carne', description: 'Massa aberta com carne temperada.', priceCents: 790, available: true },
  { id: 'enroladinho', category: 'salgados', name: 'Enroladinho', description: 'Salsicha em massa assada.', priceCents: 690, available: true },
  { id: 'cafe', category: 'bebidas', name: 'Café coado', description: 'Xícara de 150 ml.', priceCents: 550, available: true },
  { id: 'suco', category: 'bebidas', name: 'Suco de laranja', description: 'Natural, 300 ml.', priceCents: 990, available: true },
  { id: 'refri', category: 'bebidas', name: 'Refrigerante', description: 'Copo de 350 ml com gelo.', priceCents: 690, available: true },
  { id: 'agua', category: 'bebidas', name: 'Água sem gás', description: '500 ml.', priceCents: 400, available: true },
  { id: 'bolo', category: 'doces', name: 'Bolo de cenoura', description: 'Fatia com cobertura de chocolate.', priceCents: 850, available: true },
  { id: 'pudim', category: 'doces', name: 'Pudim', description: 'Fatia de pudim de leite.', priceCents: 990, available: true },
  { id: 'brigadeiro', category: 'doces', name: 'Brigadeiro', description: 'Unidade.', priceCents: 450, available: true },
  { id: 'brownie', category: 'doces', name: 'Brownie', description: 'Com nozes.', priceCents: 890, available: true },
]
