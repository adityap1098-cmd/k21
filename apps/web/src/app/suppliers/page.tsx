'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, Input } from '@/components/ui'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  Plus,
  Search,
  Loader2,
  X,
  Truck,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  RotateCcw,
} from 'lucide-react'

/* ─── Types ─── */

interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  createdAt: string
}

interface SupplierForm {
  name: string
  contact: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: SupplierForm = {
  name: '', contact: '', phone: '', email: '', address: '', notes: '',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ─── Supplier Form Modal ─── */

interface SupplierModalProps {
  initial?: Supplier | null
  onClose: () => void
  onSuccess: () => void
}

function SupplierModal({ initial, onClose, onSuccess }: SupplierModalProps) {
  const isEdit = !!initial
  const [form, setForm] = useState<SupplierForm>(
    initial
      ? {
          name: initial.name,
          contact: initial.contact ?? '',
          phone: initial.phone ?? '',
          email: initial.email ?? '',
          address: initial.address ?? '',
          notes: initial.notes ?? '',
        }
      : { ...EMPTY_FORM }
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Nama supplier harus diisi'); return }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }

    const res = isEdit
      ? await apiPatch<Supplier>(`/api/v1/suppliers/${initial!.id}`, payload)
      : await apiPost<Supplier>('/api/v1/suppliers', payload)

    setSubmitting(false)

    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setError(res.error || 'Gagal menyimpan supplier')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in overflow-y-auto">
      <Card className="w-full max-w-lg p-6 animate-in scale-95 duration-200 my-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink">
            {isEdit ? 'Edit Supplier' : 'Tambah Supplier'}
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-3 mb-5">
          <Input
            label="Nama Supplier *"
            placeholder="Nama supplier"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Kontak PIC"
            placeholder="Nama PIC"
            value={form.contact}
            onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nomor HP"
              placeholder="+62..."
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Email"
              placeholder="email@supplier.com"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Alamat</label>
            <textarea
              placeholder="Alamat lengkap supplier"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink"
              rows={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Catatan</label>
            <textarea
              placeholder="Catatan tambahan"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink"
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {isEdit ? 'Simpan Perubahan' : 'Tambah Supplier'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ─── Main Page ─── */

export default function SuppliersPage() {
  const { user } = useAuth()
  const isOwnerOrAdmin = user?.role === 'Owner' || user?.role === 'Admin'

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (!showInactive) params.set('active', 'true')
    const res = await apiGet<Supplier[]>(`/api/v1/suppliers?${params}`)
    if (res.success && res.data) setSuppliers(res.data)
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Nonaktifkan supplier "${s.name}"?`)) return
    const res = await apiDelete(`/api/v1/suppliers/${s.id}`)
    if (res.success) {
      loadData()
    } else {
      setError((res as any).error || 'Gagal menonaktifkan supplier')
    }
  }

  const handleReactivate = async (s: Supplier) => {
    const res = await apiPatch(`/api/v1/suppliers/${s.id}`, { active: true })
    if (res.success) {
      loadData()
    } else {
      setError((res as any).error || 'Gagal mengaktifkan supplier')
    }
  }

  const activeCount = suppliers.filter(s => s.active).length

  return (
    <DashboardLayout>
      <PageHeader
        title="Supplier"
        subtitle="Kelola daftar supplier dan informasi kontak"
        actions={
          isOwnerOrAdmin ? (
            <Button icon={<Plus size={15} />} onClick={() => { setEditTarget(null); setShowModal(true) }}>
              Tambah Supplier
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-in stagger-2">
        <Card className="py-3 px-4">
          <p className="text-xs text-ink-muted mb-0.5">Total Supplier</p>
          <p className="text-2xl font-bold text-ink tabular-nums">{suppliers.length}</p>
        </Card>
        <Card className="py-3 px-4">
          <p className="text-xs text-ink-muted mb-0.5">Aktif</p>
          <p className="text-2xl font-bold text-success tabular-nums">{activeCount}</p>
        </Card>
        <Card className="py-3 px-4">
          <p className="text-xs text-ink-muted mb-0.5">Non-aktif</p>
          <p className="text-2xl font-bold text-ink-faint tabular-nums">{suppliers.length - activeCount}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3 animate-in stagger-3">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Cari nama atau nomor HP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowInactive(v => !v)}
          className={`px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
            showInactive
              ? 'bg-brand text-white border-brand'
              : 'bg-transparent text-ink-secondary border-border hover:bg-surface-subtle'
          }`}
        >
          {showInactive ? 'Tampilkan Aktif Saja' : 'Tampilkan Non-aktif'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger-muted text-danger rounded-lg text-sm animate-in">
          {error}
          <button className="ml-3 underline text-xs" onClick={() => setError(null)}>Tutup</button>
        </div>
      )}

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-4">
        <div className="grid grid-cols-[minmax(160px,2fr)_minmax(120px,1.5fr)_minmax(100px,1.5fr)_100px_100px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-4">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Nama / Kontak</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Nomor HP</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Email</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Aksi</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Truck size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">
                {search ? 'Tidak ada supplier yang cocok' : 'Belum ada supplier'}
              </p>
              {isOwnerOrAdmin && !search && (
                <Button
                  variant="secondary"
                  icon={<Plus size={14} />}
                  onClick={() => { setEditTarget(null); setShowModal(true) }}
                >
                  Tambah Supplier Pertama
                </Button>
              )}
            </div>
          ) : suppliers.map(s => (
            <div
              key={s.id}
              className="grid grid-cols-[minmax(160px,2fr)_minmax(120px,1.5fr)_minmax(100px,1.5fr)_100px_100px] items-center px-6 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors gap-4"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink truncate">{s.name}</p>
                {s.contact && (
                  <p className="text-xs text-ink-muted truncate">{s.contact}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                {s.phone ? (
                  <>
                    <Phone size={12} className="text-ink-faint flex-shrink-0" />
                    <span className="text-[13px] text-ink-secondary truncate">{s.phone}</span>
                  </>
                ) : (
                  <span className="text-ink-faint text-[13px]">—</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                {s.email ? (
                  <>
                    <Mail size={12} className="text-ink-faint flex-shrink-0" />
                    <span className="text-[13px] text-ink-secondary truncate">{s.email}</span>
                  </>
                ) : (
                  <span className="text-ink-faint text-[13px]">—</span>
                )}
              </div>
              <div>
                <Badge color={s.active ? 'green' : 'neutral'}>
                  {s.active ? 'Aktif' : 'Non-aktif'}
                </Badge>
              </div>
              <div className="flex items-center justify-end gap-1">
                {isOwnerOrAdmin && (
                  <>
                    <button
                      onClick={() => { setEditTarget(s); setShowModal(true) }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-ink-faint hover:text-brand hover:bg-surface-subtle transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    {s.active ? (
                      <button
                        onClick={() => handleDelete(s)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-ink-faint hover:text-danger hover:bg-surface-subtle transition-colors"
                        title="Nonaktifkan"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(s)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-ink-faint hover:text-success hover:bg-surface-subtle transition-colors"
                        title="Aktifkan kembali"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-border">
          <span className="text-xs text-ink-muted">{suppliers.length} supplier</span>
        </div>
      </Card>

      {showModal && (
        <SupplierModal
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSuccess={loadData}
        />
      )}
    </DashboardLayout>
  )
}
