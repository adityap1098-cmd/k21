'use client'

import { useEffect, useState } from 'react'
import { getAccessToken, setAccessToken, clearAccessToken } from './api'
import { useCartStore } from './store/cart.store'
import { useShiftStore } from './store/shift.store'

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
    async function init() {
      // If token exists in memory, use it
      const token = getAccessToken()
      if (token) {
        const parsed = parseJwt(token)
        if (parsed) {
          setUser(parsed)
          setLoading(false)
          return
        }
        clearAccessToken()
      }

      // No in-memory token — try to rehydrate via refresh cookie
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success && data.data?.accessToken) {
          setAccessToken(data.data.accessToken)
          const parsed = parseJwt(data.data.accessToken)
          if (parsed) {
            setUser(parsed)
            setLoading(false)
            return
          }
        }
      } catch {
        // Refresh failed — user needs to login
      }
      setLoading(false)
    }
    init()
  }, [])

  async function logout() {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
      await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch {
      // Network failure is acceptable — token will expire naturally
    }
    clearAccessToken()
    // Clear all Zustand stores to prevent cross-user state leakage on shared devices
    useCartStore.getState().clearCart()
    useShiftStore.getState().setActiveShift(null)
    window.location.href = '/login'
  }

  return { user, loading, logout }
}
