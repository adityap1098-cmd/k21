import { getAccessToken } from '@/lib/api'

/**
 * Authenticated fetch — adds Bearer token from localStorage.
 * Drop-in replacement for fetch() in POS components.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(url, { ...options, headers })
}
