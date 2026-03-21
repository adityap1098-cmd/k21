'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAccessToken } from '@/lib/api'

const PUBLIC_ROUTES = ['/login']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = getAccessToken()
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

    if (!token && !isPublic) {
      router.replace('/login')
      return
    }

    if (token && pathname === '/login') {
      router.replace('/dashboard')
      return
    }

    setChecked(true)
  }, [pathname, router])

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center shadow-[0_4px_20px_rgba(232,93,58,0.3)]">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
