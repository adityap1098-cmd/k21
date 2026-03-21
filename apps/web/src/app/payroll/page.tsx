'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, MetricCard } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  Plus,
  Play,
  Loader2,
  Users,
  FileText,
} from 'lucide-react'

/* ─── Types ─── */

interface Employee {
  id: string; employeeNumber: string; name: string
  baseSalary: number; isActive: boolean; taxStatus: string
}

interface PayrollRun {
  id: string; period: string; status: string
  totalGross: number; totalNet: number; employeeCount: number
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/* ─── Page ─── */

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'employees' | 'runs'>('employees')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [empRes, runRes] = await Promise.all([
      apiGet<Employee[]>('/api/v1/payroll/employees'),
      apiGet<PayrollRun[]>('/api/v1/payroll/runs'),
    ])
    if (empRes.success && empRes.data) setEmployees(empRes.data)
    if (runRes.success && runRes.data) setRuns(runRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeEmp = employees.filter(e => e.isActive).length

  return (
    <DashboardLayout>
      <PageHeader
        title="Payroll"
        subtitle="Gaji karyawan, BPJS, dan PPh 21"
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={15} />}>Tambah Karyawan</Button>
            <Button icon={<Play size={15} />}>Proses Payroll</Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-2">
        {(['employees', 'runs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab === 'employees' ? 'Karyawan' : 'Payroll Runs'}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in stagger-3">
            <MetricCard label="Total Karyawan" value={String(employees.length)} subtitle={`${activeEmp} aktif`} />
            <MetricCard
              label="Total Gaji Pokok"
              value={formatRp(employees.reduce((s, e) => s + e.baseSalary, 0))}
              subtitle="Per bulan"
            />
            <MetricCard label="Non-aktif" value={String(employees.length - activeEmp)} subtitle="Karyawan non-aktif" />
          </div>

          <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-4">
            <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
              <span className="w-[120px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">No. Karyawan</span>
              <span className="w-[200px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Nama</span>
              <span className="w-[120px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status Pajak</span>
              <span className="w-[140px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Gaji Pokok</span>
              <span className="flex-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="text-ink-faint animate-spin" />
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Users size={32} className="text-ink-faint" />
                  <p className="text-sm font-medium text-ink-muted">Belum ada karyawan</p>
                </div>
              ) : employees.map(emp => (
                <div key={emp.id} className="flex items-center px-5 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer">
                  <span className="w-[120px] font-mono text-xs text-ink-secondary">{emp.employeeNumber}</span>
                  <span className="w-[200px] text-[13px] font-medium text-ink">{emp.name}</span>
                  <div className="w-[120px]">
                    <Badge color="blue">{emp.taxStatus}</Badge>
                  </div>
                  <span className="w-[140px] text-[13px] font-medium text-ink tabular-nums">{formatRp(emp.baseSalary)}</span>
                  <div className="flex-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${emp.isActive ? 'text-success' : 'text-ink-faint'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-success' : 'bg-ink-faint'}`} />
                      {emp.isActive ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeTab === 'runs' && (
        <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
          <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
            <span className="w-[150px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Periode</span>
            <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
            <span className="w-[80px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Karyawan</span>
            <span className="w-[150px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Total Gross</span>
            <span className="flex-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Total Net</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="text-ink-faint animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <FileText size={32} className="text-ink-faint" />
                <p className="text-sm font-medium text-ink-muted">Belum ada payroll run</p>
                <p className="text-xs text-ink-faint">Klik "Proses Payroll" untuk memulai</p>
              </div>
            ) : runs.map(run => (
              <div key={run.id} className="flex items-center px-5 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer">
                <span className="w-[150px] text-[13px] font-medium text-ink">{run.period}</span>
                <div className="w-[100px]">
                  <Badge color={run.status === 'COMPLETED' ? 'green' : 'amber'}>{run.status}</Badge>
                </div>
                <span className="w-[80px] text-[13px] text-ink-secondary tabular-nums">{run.employeeCount}</span>
                <span className="w-[150px] text-[13px] font-medium text-ink tabular-nums">{formatRp(run.totalGross)}</span>
                <span className="flex-1 text-[13px] font-bold text-ink tabular-nums">{formatRp(run.totalNet)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </DashboardLayout>
  )
}
