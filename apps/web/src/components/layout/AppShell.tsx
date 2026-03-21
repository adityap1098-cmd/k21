'use client'

import { useEffect, useState } from 'react'
import { getAccessToken } from '@/lib/api'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeProvider } from '@/components/ui/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'

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
        {children}
      </ToastProvider>
    </ThemeProvider>
  )
}
