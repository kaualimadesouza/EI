import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { NfcPort } from '../../ports/nfc'
import { PhoneApp } from './PhoneApp'

const nfc: NfcPort = {
  scan: () => Promise.resolve({ kind: 'url', url: 'https://topa-totem.vercel.app/?loja=padaria-sol' }),
}

describe('PhoneApp', () => {
  it('opens the store read from the sticker, and goes back to reading on request', async () => {
    render(<PhoneApp nfc={nfc} />)

    await userEvent.click(screen.getByRole('button', { name: 'Aproximar do totem' }))

    expect(screen.getByText('padaria-sol')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ler outro adesivo' }))

    expect(screen.getByRole('button', { name: 'Aproximar do totem' })).toBeInTheDocument()
  })
})
