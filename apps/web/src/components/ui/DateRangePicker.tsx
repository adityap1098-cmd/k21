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

function formatShort(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isInRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Pad start to Monday (0=Mon … 6=Sun)
  const startDay = (first.getDay() + 6) % 7
  for (let i = startDay; i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }

  // Current month days
  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Pad end to complete last row
  let next = 1
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, next++))
  }

  return days
}

const PRESETS = [
  { label: 'Hari ini', getDates: () => { const t = new Date(); t.setHours(0,0,0,0); return [t, new Date()] as [Date, Date] } },
  { label: '7 hari', getDates: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 7); return [s, e] as [Date, Date] } },
  { label: '30 hari', getDates: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 30); return [s, e] as [Date, Date] } },
  { label: 'Bulan ini', getDates: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s, e] as [Date, Date] } },
  { label: 'Bulan lalu', getDates: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return [s, e] as [Date, Date] } },
]

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(startDate.getMonth())
  const [viewYear, setViewYear] = useState(startDate.getFullYear())
  const [selecting, setSelecting] = useState<'start' | 'end' | null>(null)
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)
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
      if (d < tempStart) {
        setTempEnd(tempStart)
        setTempStart(d)
      } else {
        setTempEnd(d)
      }
      setSelecting(null)
      onChange(d < tempStart ? d : tempStart, d < tempStart ? tempStart : d)
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
      <button
        type="button"
        onClick={() => { setOpen(!open); setSelecting('start') }}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-surface-raised text-[13px] font-medium text-ink-secondary hover:bg-surface-subtle transition-colors"
      >
        <Calendar size={14} className="text-ink-faint" />
        {formatShort(startDate)} — {formatShort(endDate)}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-[200] flex bg-surface-raised rounded-xl border border-border shadow-[0_16px_40px_rgba(0,0,0,0.12)] animate-in" style={{ animationDuration: '150ms' }}>
          {/* Presets */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-border min-w-[120px]">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.getDates)}
                className="text-left px-3 py-2 rounded-md text-xs font-medium text-ink-secondary hover:bg-surface-subtle transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) } else setViewMonth(viewMonth - 1) }}
                className="p-1 rounded-md hover:bg-surface-subtle transition-colors"
              >
                <ChevronLeft size={16} className="text-ink-muted" />
              </button>
              <span className="text-[13px] font-semibold text-ink">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) } else setViewMonth(viewMonth + 1) }}
                className="p-1 rounded-md hover:bg-surface-subtle transition-colors"
              >
                <ChevronRight size={16} className="text-ink-muted" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="w-8 h-7 flex items-center justify-center text-[10px] font-semibold text-ink-faint uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const isCurrentMonth = d.getMonth() === viewMonth
                const isStart = isSameDay(d, tempStart)
                const isEnd = isSameDay(d, tempEnd)
                const inRange = isInRange(d, tempStart, tempEnd)
                const isToday = isSameDay(d, new Date())

                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(d)}
                    className={clsx(
                      'w-8 h-8 flex items-center justify-center text-[11px] rounded-md transition-colors',
                      !isCurrentMonth && 'text-ink-faint',
                      isCurrentMonth && !inRange && 'text-ink-secondary hover:bg-surface-subtle',
                      inRange && !isStart && !isEnd && 'bg-brand-subtle text-brand',
                      (isStart || isEnd) && 'bg-brand text-white font-semibold',
                      isToday && !isStart && !isEnd && 'font-bold',
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
