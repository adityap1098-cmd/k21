'use client'

import { useState, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { MoreVertical } from 'lucide-react'

interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface ActionMenuProps {
  items: MenuItem[]
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: rect.right - 160,
      })
    }
    setOpen(prev => !prev)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={handleToggle}
        className="p-1.5 rounded-md hover:bg-surface-subtle transition-colors"
      >
        <MoreVertical size={16} className="text-ink-muted" />
      </button>

      {open && (
        <>
          {/* Invisible overlay to close */}
          <div
            className="fixed inset-0 z-[99]"
            onMouseDown={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-[160px] rounded-lg border border-border py-1 animate-in"
            style={{
              top: pos.top,
              left: pos.left,
              animationDuration: '120ms',
              backgroundColor: 'var(--color-surface-raised)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.stopPropagation(); item.onClick(); setOpen(false) }}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors',
                  item.danger
                    ? 'text-danger hover:bg-danger-muted'
                    : 'text-ink hover:bg-surface-subtle',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
