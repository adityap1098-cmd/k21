const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

let accessToken: string | null = null

export function setAccessToken(token: string) {
  accessToken = token
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', token)
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('accessToken')
  }
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken')
  }
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    const data: ApiResponse<{ accessToken: string }> = await res.json()
    if (data.success && data.data) {
      setAccessToken(data.data.accessToken)
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  // If 401, try refresh once
  if (res.status === 401 && token) {
    const refreshed = await refreshToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      })
    } else {
      clearAccessToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return { success: false, data: null, error: 'SESSION_EXPIRED' }
    }
  }

  return res.json()
}

// Convenience methods
export const apiGet = <T>(path: string) => api<T>(path)
export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const apiPut = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) })
export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: 'DELETE' })
