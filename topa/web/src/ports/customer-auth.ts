export interface AuthenticatedCustomer {
  id?: string
  name: string
  email: string
}

export interface CustomerCredentials {
  email: string
  password: string
}

export interface CustomerRegistration {
  name: string
  email: string
  password: string
}

export interface CustomerAuthPort {
  login(credentials: CustomerCredentials): Promise<AuthenticatedCustomer>
  register(data: CustomerRegistration): Promise<AuthenticatedCustomer>
  logout(): Promise<void> | void
  getToken(): string | null
  getCustomer(): AuthenticatedCustomer | null
  init(): Promise<AuthenticatedCustomer | null>
}

export class CustomerAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerAuthError'
  }
}
