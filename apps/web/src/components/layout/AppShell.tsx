'use client'

import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/api'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeProvider } from '@/components/ui/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = getAccessToken()
    if (!token && pathname !== '/login') {
      router.replace('/login')
      return
    }
    if (token && pathname === '/login') {
      router.replace('/dashboard')
      return
    }

    // Force password change redirect
    if (token && pathname !== '/change-password') {
      try {
        const base64Url = token.split('.')[1]
        const json = JSON.parse(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')))
        if (json.mustChangePassword) {
          router.replace('/change-password')
          return
        }
      } catch { /* ignore parse errors */ }
    }

    setReady(true)
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  )
}
