'use client'

import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const widthClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, width = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(27,43,58,0.5)] backdrop-blur-[2px] animate-in" style={{ animationDuration: '200ms' }} />

      {/* Panel */}
      <div className={clsx(
        'relative w-full bg-surface-raised rounded-2xl',
        'shadow-[0_24px_48px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)]',
        'animate-in',
        widthClasses[width],
      )} style={{ animationDuration: '250ms' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && <p className="text-[13px] text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-subtle transition-colors text-ink-muted hover:text-ink -mt-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}
