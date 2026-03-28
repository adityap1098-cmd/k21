'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface ModalOverlayProps {
  children: ReactNode
  onClose: () => void
  ariaLabel: string
  className?: string
}

/**
 * H-22: Accessible modal overlay with role="dialog", aria-modal, and focus trap.
 * Wraps modal content with:
 * - Backdrop click to close
 * - Escape key to close
 * - Focus trapped inside (Tab cycles within modal)
 * - Focus restored to trigger element on close
 */
export function ModalOverlay({ children, onClose, ariaLabel, className = '' }: ModalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Save current focus to restore on close
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus first focusable element inside the modal
    const timer = setTimeout(() => {
      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable && focusable.length > 0) {
        focusable[0].focus()
      }
    }, 50)

    return () => {
      clearTimeout(timer)
      // Restore focus on unmount
      previousFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap — Tab and Shift+Tab cycle within the modal
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      ref={overlayRef}
    >
      {children}
    </div>
  )
}
