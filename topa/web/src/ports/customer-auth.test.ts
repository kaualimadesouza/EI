import { describe, expect, it } from 'vitest'
import { CustomerAuthError } from './customer-auth'

describe('CustomerAuthError', () => {
  it('instantiates with message and name', () => {
    const error = new CustomerAuthError('Credenciais inválidas.')
    expect(error.message).toBe('Credenciais inválidas.')
    expect(error.name).toBe('CustomerAuthError')
  })
})
