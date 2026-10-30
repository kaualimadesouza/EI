import type { Product } from './menu'

export interface VoiceParsedItem {
  readonly productId: string
  readonly name: string
  readonly quantity: number
  readonly priceCents: number
  readonly available: boolean
  readonly confidence: number
}

export interface VoiceUnmatchedItem {
  readonly spokenPhrase: string
  readonly reason: string
}

export interface VoiceOrderParseResult {
  readonly rawTranscript: string
  readonly matchedItems: readonly VoiceParsedItem[]
  readonly unmatchedItems: readonly VoiceUnmatchedItem[]
  readonly totalCents: number
  readonly allAvailable: boolean
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
}

const FILLER_WORDS = new Set([
  'quero',
  'queria',
  'me',
  've',
  'da',
  'por',
  'favor',
  'gostaria',
  'de',
  'pra',
  'para',
  'mim',
  'adiciona',
  'adicionar',
  'bota',
  'coloca',
  'tambem',
  'pedir',
  'vou',
  'levar',
  'ola',
  'oi',
  'opa',
  'bom',
  'dia',
  'boa',
  'tarde',
  'noite',
  'e',
  'com',
  'sem',
  'o',
  'a',
  'os',
  'as',
  'valeu',
  'obrigado',
  'obrigada',
])

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
}

export function stem(word: string): string {
  if (word.length <= 3) {
    return word
  }
  if (word.endsWith('oes') || word.endsWith('aes')) {
    return `${word.slice(0, -3)}ao`
  }
  if (word.endsWith('ais') || word.endsWith('eis')) {
    return `${word.slice(0, -3)}el`
  }
  if (word.endsWith('s')) {
    return word.slice(0, -1)
  }
  return word
}

function extractQuantityAndTokens(tokens: readonly string[]): {
  quantity: number
  contentTokens: string[]
} {
  let quantity = 1
  let quantityIndex = -1

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token in NUMBER_WORDS) {
      quantity = NUMBER_WORDS[token]
      quantityIndex = i
      break
    }
    const parsedInt = Number.parseInt(token, 10)
    if (!Number.isNaN(parsedInt) && parsedInt > 0) {
      quantity = parsedInt
      quantityIndex = i
      break
    }
  }

  const remaining = tokens.filter((_, idx) => idx !== quantityIndex)
  const contentTokens = remaining.filter((t) => !FILLER_WORDS.has(t))

  return { quantity, contentTokens }
}

function computeProductScore(
  spokenStems: readonly string[],
  productTokens: readonly string[],
): number {
  if (spokenStems.length === 0 || productTokens.length === 0) {
    return 0
  }

  const productStems = productTokens.map(stem)
  let matches = 0

  for (const spoken of spokenStems) {
    const isMatched = productStems.some(
      (cand) => cand === spoken || cand.startsWith(spoken) || spoken.startsWith(cand),
    )
    if (isMatched) {
      matches += 1
    }
  }

  if (matches === 0) {
    return 0
  }

  const precision = matches / spokenStems.length
  const recall = matches / productStems.length
  return precision * 0.6 + recall * 0.4
}

function splitPhrases(transcript: string): string[] {
  return transcript
    .split(/\s+(?:e|mais|com|junto com)\s+|[,;.]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function parseVoiceOrder(
  transcript: string,
  catalog: readonly Product[],
): VoiceOrderParseResult {
  const normalizedTranscript = normalizeText(transcript)
  if (!normalizedTranscript) {
    return {
      rawTranscript: transcript,
      matchedItems: [],
      unmatchedItems: [],
      totalCents: 0,
      allAvailable: true,
    }
  }

  const segments = splitPhrases(transcript)
  const matched: VoiceParsedItem[] = []
  const unmatched: VoiceUnmatchedItem[] = []

  for (const segment of segments) {
    const rawTokens = normalizeText(segment).split(/\s+/).filter(Boolean)
    if (rawTokens.length === 0) {
      continue
    }

    const { quantity, contentTokens } = extractQuantityAndTokens(rawTokens)
    if (contentTokens.length === 0) {
      continue
    }

    const spokenStems = contentTokens.map(stem)
    let bestProduct: Product | null = null
    let bestScore = 0

    for (const product of catalog) {
      const productTokens = normalizeText(product.name)
        .split(/\s+/)
        .filter((t) => !FILLER_WORDS.has(t) && t.length > 0)
      const score = computeProductScore(spokenStems, productTokens)
      if (score > bestScore) {
        bestScore = score
        bestProduct = product
      }
    }

    if (bestProduct && bestScore >= 0.45) {
      const existing = matched.find((m) => m.productId === bestProduct!.id)
      if (existing) {
        matched[matched.indexOf(existing)] = {
          ...existing,
          quantity: existing.quantity + quantity,
        }
      } else {
        matched.push({
          productId: bestProduct.id,
          name: bestProduct.name,
          quantity,
          priceCents: bestProduct.priceCents,
          available: bestProduct.available,
          confidence: Number(bestScore.toFixed(2)),
        })
      }
    } else {
      unmatched.push({
        spokenPhrase: segment,
        reason: 'Produto não encontrado no cardápio desta loja.',
      })
    }
  }

  const totalCents = matched.reduce(
    (sum, item) => (item.available ? sum + item.priceCents * item.quantity : sum),
    0,
  )
  const allAvailable = matched.every((item) => item.available)

  return {
    rawTranscript: transcript,
    matchedItems: matched,
    unmatchedItems: unmatched,
    totalCents,
    allAvailable,
  }
}
