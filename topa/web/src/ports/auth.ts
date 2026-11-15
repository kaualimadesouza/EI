export interface AuthenticatedMerchant {
  email: string
  storeSlug: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface MerchantRegistration extends LoginCredentials {
  storeName: string
}

export interface AuthPort {
  login(credentials: LoginCredentials): Promise<AuthenticatedMerchant>
  register(registration: MerchantRegistration): Promise<AuthenticatedMerchant>
  logout(): Promise<void> | void
  getToken(): string | null
  getMerchant(): AuthenticatedMerchant | null
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
