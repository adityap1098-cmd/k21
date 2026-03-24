'use client'

import { useEffect, useState } from 'react'
import { getAccessToken, clearAccessToken } from './api'

interface User {
  sub: string
  role: string
  email?: string
  name?: string
  mustChangePassword: boolean
}

function parseJwt(token: string): User | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      const parsed = parseJwt(token)
      if (parsed) {
        setUser(parsed)
      } else {
        clearAccessToken()
      }
    }
    setLoading(false)
  }, [])

  async function logout() {
    try {
      // Invalidate refresh token on server (fire-and-forget — don't block on failure)
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Network failure is acceptable — token will expire naturally
    }
    clearAccessToken()
    window.location.href = '/login'
  }

  return { user, loading, logout }
}
