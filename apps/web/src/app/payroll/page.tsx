'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, MetricCard, Input } from '@/components/ui'
import { apiGet } from '@/lib/api'
import { authFetch } from '@/lib/auth-fetch'
import {
  Plus,
  Play,
  Loader2,
  Users,
  FileText,
  X,
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [formData, setFormData] = useState({ nama: '', jabatan: '', gajiPokok: '', tunjangan: '' })
  const [showConfirm, setShowConfirm] = useState(false)

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

  const handleAddEmployee = async () => {
    try {
      const res = await authFetch('/api/v1/payroll/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowAddForm(false)
        setFormData({ nama: '', jabatan: '', gajiPokok: '', tunjangan: '' })
        loadData()
      } else {
        alert('Fitur segera tersedia')
      }
    } catch (err) {
      alert('Fitur segera tersedia')
    }
  }

  const handleProcessPayroll = async () => {
    setIsProcessing(true)
    try {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await authFetch('/api/v1/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowConfirm(false)
        loadData()
      } else {
        alert(data.error || 'Gagal memproses payroll')
      }
    } catch (err) {
      alert('Gagal memproses payroll')
    } finally {
      setIsProcessing(false)
    }
  }

  const activeEmp = employees.filter(e => e.isActive).length

  return (
    <DashboardLayout>
      <PageHeader
        title="Payroll"
        subtitle="Gaji karyawan, BPJS, dan PPh 21"
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setShowAddForm(true)}>Tambah Karyawan</Button>
            <Button icon={<Play size={15} />} onClick={() => setShowConfirm(true)} disabled={isProcessing}>
              {isProcessing ? 'Memproses...' : 'Proses Payroll'}
            </Button>
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
            <div className="grid grid-cols-[minmax(80px,1fr)_minmax(140px,2fr)_100px_minmax(100px,1.5fr)_80px] items-center px-6 py-3 gap-3 bg-surface-subtle border-b border-border">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">No. Karyawan</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Nama</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Status Pajak</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Gaji Pokok</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Status</span>
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
                <div key={emp.id} className="grid grid-cols-[minmax(80px,1fr)_minmax(140px,2fr)_100px_minmax(100px,1.5fr)_80px] items-center px-6 py-3.5 gap-3 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer">
                  <span className="font-mono text-xs text-ink-secondary min-w-0 truncate">{emp.employeeNumber}</span>
                  <span className="text-[13px] font-medium text-ink min-w-0 truncate">{emp.name}</span>
                  <div className="min-w-0">
                    <Badge color="blue">{emp.taxStatus}</Badge>
                  </div>
                  <span className="text-[13px] font-medium text-ink tabular-nums min-w-0 truncate">{formatRp(emp.baseSalary)}</span>
                  <div className="min-w-0">
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
          <div className="grid grid-cols-[minmax(120px,1.5fr)_100px_80px_minmax(100px,1.5fr)_minmax(100px,1.5fr)] items-center px-6 py-3 gap-3 bg-surface-subtle border-b border-border">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Periode</span>
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Status</span>
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Karyawan</span>
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Total Gross</span>
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider min-w-0">Total Net</span>
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
              <div key={run.id} className="grid grid-cols-[minmax(120px,1.5fr)_100px_80px_minmax(100px,1.5fr)_minmax(100px,1.5fr)] items-center px-6 py-3.5 gap-3 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer">
                <span className="text-[13px] font-medium text-ink min-w-0 truncate">{run.period}</span>
                <div className="min-w-0">
                  <Badge color={run.status === 'COMPLETED' ? 'green' : 'amber'}>{run.status}</Badge>
                </div>
                <span className="text-[13px] text-ink-secondary tabular-nums min-w-0 truncate">{run.employeeCount}</span>
                <span className="text-[13px] font-medium text-ink tabular-nums min-w-0 truncate">{formatRp(run.totalGross)}</span>
                <span className="text-[13px] font-bold text-ink tabular-nums min-w-0 truncate">{formatRp(run.totalNet)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Employee Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in">
          <Card className="w-full max-w-md p-6 animate-in scale-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink">Tambah Karyawan</h2>
              <button onClick={() => setShowAddForm(false)} className="text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <Input
                label="Nama"
                placeholder="Nama karyawan"
                value={formData.nama}
                onChange={e => setFormData({ ...formData, nama: e.target.value })}
              />
              <Input
                label="Jabatan"
                placeholder="Posisi jabatan"
                value={formData.jabatan}
                onChange={e => setFormData({ ...formData, jabatan: e.target.value })}
              />
              <Input
                label="Gaji Pokok"
                placeholder="Jumlah gaji pokok"
                value={formData.gajiPokok}
                onChange={e => setFormData({ ...formData, gajiPokok: e.target.value })}
              />
              <Input
                label="Tunjangan"
                placeholder="Tunjangan tambahan"
                value={formData.tunjangan}
                onChange={e => setFormData({ ...formData, tunjangan: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowAddForm(false)}>Batal</Button>
              <Button onClick={handleAddEmployee}>Simpan</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Payroll Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in">
          <Card className="w-full max-w-md p-6 animate-in scale-95 duration-200">
            <h2 className="text-lg font-semibold text-ink mb-3">Konfirmasi Proses Payroll</h2>
            <p className="text-sm text-ink-secondary mb-5">
              Proses payroll untuk periode {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={isProcessing}>
                Batal
              </Button>
              <Button onClick={handleProcessPayroll} disabled={isProcessing}>
                {isProcessing ? 'Memproses...' : 'Lanjutkan'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}
