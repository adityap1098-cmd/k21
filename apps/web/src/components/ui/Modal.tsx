'use client'

import { useEffect, useRef, useCallback } from 'react'
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

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, description, children, width = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus trap + Escape + restore focus
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [onClose])

  useEffect(() => {
    if (!open) return

    // Save + set focus
    previousFocusRef.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    // Focus first focusable inside panel (defer to next frame so DOM is ready)
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    })

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      // Restore focus
      previousFocusRef.current?.focus()
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const titleId = 'modal-title'
  const descId = description ? 'modal-desc' : undefined

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(27,43,58,0.5)] backdrop-blur-[2px] animate-in" style={{ animationDuration: '200ms' }} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={clsx(
          'relative w-full bg-surface-raised rounded-2xl',
          'shadow-[0_24px_48px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)]',
          'animate-in',
          widthClasses[width],
        )} style={{ animationDuration: '250ms' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>
            {description && <p id={descId} className="text-[13px] text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg hover:bg-surface-subtle transition-colors text-ink-muted hover:text-ink -mt-1 -mr-1"
          >
            <X size={18} aria-hidden="true" />
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
