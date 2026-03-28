import { getAccessToken, setAccessToken, clearAccessToken } from '@/lib/api'

/**
 * Authenticated fetch — adds Bearer token from localStorage.
 * Auto-refreshes token on 401 (same logic as api() helper).
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

  let res = await fetch(url, { ...options, headers, credentials: 'include' })

  // H-20: Handle PASSWORD_CHANGE_REQUIRED before 401 refresh logic
  if (res.status === 403) {
    const cloned = res.clone()
    try {
      const body = await cloned.json()
      if (body?.error === 'PASSWORD_CHANGE_REQUIRED') {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/change-password')) {
          window.location.href = '/change-password'
        }
        return res
      }
    } catch {
      // Not JSON — fall through
    }
  }

  // If 401, try refresh once
  if (res.status === 401 && token) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      const refreshBody = await refreshRes.json()
      if (refreshBody.success && refreshBody.data?.accessToken) {
        setAccessToken(refreshBody.data.accessToken)
        headers['Authorization'] = `Bearer ${refreshBody.data.accessToken}`
        res = await fetch(url, { ...options, headers, credentials: 'include' })
      } else {
        clearAccessToken()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    } catch {
      clearAccessToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  return res
}
