'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface RevenueChartProps {
  data: Array<{ date: string; pos: number; marketplace: number }>
  className?: string
}

function formatRpShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}rb`
  return String(value)
}

export function RevenueChart({ data, className }: RevenueChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E85D3A" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#E85D3A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradMkt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-light)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-ink-faint)' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-ink-faint)' }}
            tickFormatter={formatRpShort}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              padding: '10px 14px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'var(--color-ink)', fontWeight: 600, marginBottom: 4 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, name: any) => [
              `Rp ${Number(value).toLocaleString('id-ID')}`,
              name === 'pos' ? 'POS' : 'Marketplace',
            ]) as any}
          />
          <Area
            type="monotone"
            dataKey="pos"
            stroke="#E85D3A"
            strokeWidth={2}
            fill="url(#gradPos)"
            dot={false}
            activeDot={{ r: 4, stroke: '#E85D3A', strokeWidth: 2, fill: 'white' }}
          />
          <Area
            type="monotone"
            dataKey="marketplace"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#gradMkt)"
            dot={false}
            activeDot={{ r: 4, stroke: '#3B82F6', strokeWidth: 2, fill: 'white' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
