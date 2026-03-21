'use client'

import { useEffect, useState } from 'react'
import { getAccessToken, clearAccessToken } from './api'

interface User {
  sub: string
  role: string
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

  function logout() {
    clearAccessToken()
    window.location.href = '/login'
  }

  return { user, loading, logout }
}
