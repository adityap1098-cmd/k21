'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <AlertTriangle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  warning: 'bg-warning text-white',
  info: 'bg-ink text-white',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const contextValue = useMemo(() => ({ toast: addToast }), [addToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container — live region for screen reader announcements */}
      <div
        className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={clsx(
              'flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg pointer-events-auto',
              'animate-in min-w-[280px]',
              COLORS[t.type],
            )}
            style={{ animationDuration: '200ms' }}
          >
            {ICONS[t.type]}
            <span className="text-[13px] font-medium flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} aria-label="Tutup notifikasi" className="opacity-70 hover:opacity-100 transition-opacity">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
