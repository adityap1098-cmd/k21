'use client'

import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onChange: (start: Date, end: Date) => void
  className?: string
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

// Cell size in px — drives both header and day cells
const CELL = 36

function formatShort(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isInRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Pad start to Monday (Mon=0 … Sun=6)
  const startDay = (first.getDay() + 6) % 7
  for (let i = startDay; i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }

  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  let next = 1
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, next++))
  }

  return days
}

const PRESETS = [
  {
    label: 'Hari ini',
    getDates: (): [Date, Date] => {
      const t = new Date(); t.setHours(0, 0, 0, 0); return [t, new Date()]
    },
  },
  {
    label: '7 hari',
    getDates: (): [Date, Date] => {
      const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 7); return [s, e]
    },
  },
  {
    label: '30 hari',
    getDates: (): [Date, Date] => {
      const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 30); return [s, e]
    },
  },
  {
    label: 'Bulan ini',
    getDates: (): [Date, Date] => {
      const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s, e]
    },
  },
  {
    label: 'Bulan lalu',
    getDates: (): [Date, Date] => {
      const now = new Date()
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return [s, e]
    },
  },
]

// Calendar width = 7 cells × CELL px + 2×padding(16px)
const CAL_WIDTH = 7 * CELL + 32

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const [open, setOpen]           = useState(false)
  const [viewMonth, setViewMonth] = useState(startDate.getMonth())
  const [viewYear, setViewYear]   = useState(startDate.getFullYear())
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd]     = useState(endDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleDayClick(d: Date) {
    if (!selecting || selecting === 'start') {
      setTempStart(d)
      setTempEnd(d)
      setSelecting('end')
    } else {
      const [s, e] = d < tempStart ? [d, tempStart] : [tempStart, d]
      setTempStart(s)
      setTempEnd(e)
      setSelecting(null)
      onChange(s, e)
      setOpen(false)
    }
  }

  function applyPreset(getDates: () => [Date, Date]) {
    const [s, e] = getDates()
    setTempStart(s)
    setTempEnd(e)
    onChange(s, e)
    setOpen(false)
  }

  const days = getDaysInMonth(viewYear, viewMonth)

  return (
    <div ref={ref} className={clsx('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSelecting('start') }}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-surface-raised text-[13px] font-medium text-ink-secondary hover:bg-surface-subtle transition-colors"
      >
        <Calendar size={14} className="text-ink-faint" />
        {formatShort(startDate)} — {formatShort(endDate)}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-2 left-0 z-[200] flex bg-surface-raised rounded-xl border border-border shadow-[0_16px_40px_rgba(0,0,0,0.12)] animate-in"
          style={{ animationDuration: '150ms' }}
        >
          {/* Presets sidebar */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-border" style={{ minWidth: 112 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.getDates)}
                className="text-left px-3 py-2 rounded-md text-xs font-medium text-ink-secondary hover:bg-surface-subtle transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar — fixed pixel width so cells never squish */}
          <div className="p-4 flex-shrink-0" style={{ width: CAL_WIDTH }}>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                  else setViewMonth(m => m - 1)
                }}
                className="p-1 rounded-md hover:bg-surface-subtle transition-colors"
              >
                <ChevronLeft size={16} className="text-ink-muted" />
              </button>
              <span className="text-[13px] font-semibold text-ink">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
                  else setViewMonth(m => m + 1)
                }}
                className="p-1 rounded-md hover:bg-surface-subtle transition-colors"
              >
                <ChevronRight size={16} className="text-ink-muted" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="flex mb-1">
              {DAYS.map(d => (
                <div
                  key={d}
                  style={{ width: CELL, height: 28, flexShrink: 0 }}
                  className="flex items-center justify-center text-[10px] font-semibold text-ink-faint uppercase"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid — flex-wrap rows */}
            <div className="flex flex-wrap">
              {days.map((d, i) => {
                const isCurrentMonth = d.getMonth() === viewMonth
                const isStart        = isSameDay(d, tempStart)
                const isEnd          = isSameDay(d, tempEnd)
                const inRange        = isInRange(d, tempStart, tempEnd)
                const isToday        = isSameDay(d, new Date())

                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(d)}
                    style={{ width: CELL, height: CELL, flexShrink: 0 }}
                    className={clsx(
                      'flex items-center justify-center text-xs rounded-md transition-colors leading-none',
                      !isCurrentMonth && 'text-ink-faint',
                      isCurrentMonth && !inRange && 'text-ink-secondary hover:bg-surface-subtle',
                      inRange && !isStart && !isEnd && 'bg-brand/10 text-brand',
                      (isStart || isEnd) && 'bg-brand text-white font-semibold',
                      isToday && !isStart && !isEnd && 'font-bold ring-1 ring-brand/40',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
