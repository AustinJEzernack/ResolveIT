export interface AuthUser {
  id: string
  email: string
  username?: string
  first_name: string
  last_name: string
  full_name?: string
  role?: string
  avatar_url?: string | null
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? ''
}

export function hasJwtAccessToken(): boolean {
  const token = getAccessToken()
  return token.split('.').length === 3
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}