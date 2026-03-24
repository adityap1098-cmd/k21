'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Card } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Plus, Pencil, Trash2, X, Check, Loader2, ShieldAlert } from 'lucide-react'

/* ═══════ Store Settings (localStorage) ═══════ */

interface StoreSettings {
  storeName: string
  storeAddress: string
  storePhone: string
  npwp: string
}

const DEFAULTS: StoreSettings = {
  storeName: 'Teladan27 Motor',
  storeAddress: 'Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat',
  storePhone: '+62 858-4622-2290',
  npwp: '00.000.000.0-000.000',
}

const STORAGE_KEY = 'k21_store_settings'

function loadSettings(): StoreSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULTS
}

function saveSettings(settings: StoreSettings) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* */ }
}

/* ═══════ Mechanic type ═══════ */

interface Mechanic {
  id: string
  name: string
  phone: string | null
  specialty: string | null
  isActive: boolean
}

/* ═══════ Page ═══════ */

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const role = user?.role || ''

  // Role guard: only Owner and Admin can access Settings
  if (role && role !== 'Owner' && role !== 'Admin') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <ShieldAlert size={48} className="text-ink-faint" />
          <h2 className="text-lg font-semibold text-ink">Akses Ditolak</h2>
          <p className="text-sm text-ink-muted">Halaman ini hanya dapat diakses oleh Owner dan Admin.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-2 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </DashboardLayout>
    )
  }

  /* ── Store settings state ── */
  const [settings, setSettings] = useState<StoreSettings>(DEFAULTS)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<StoreSettings>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  /* ── Mechanic state ── */
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [mechLoading, setMechLoading] = useState(true)
  const [mechError, setMechError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', specialty: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', specialty: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  /* ── Load settings ── */
  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    setDraft(loaded)
  }, [])

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/v1/health', { method: 'GET' })
        setServerOnline(res.ok)
      } catch { setServerOnline(false) }
    }
    checkHealth()
  }, [])

  /* ── Load mechanics ── */
  const fetchMechanics = useCallback(async () => {
    setMechLoading(true)
    setMechError(null)
    try {
      const res = await apiGet<Mechanic[]>('/api/v1/mechanics/all')
      if (res.success && res.data) {
        setMechanics(res.data)
      } else {
        setMechError(res.error ?? 'Gagal memuat data mekanik')
      }
    } catch {
      setMechError('Gagal terhubung ke server')
    } finally {
      setMechLoading(false)
    }
  }, [])

  useEffect(() => { fetchMechanics() }, [fetchMechanics])

  /* ── Store settings handlers ── */
  function handleEdit() { setDraft({ ...settings }); setIsEditing(true); setSaved(false) }
  function handleCancel() { setDraft({ ...settings }); setIsEditing(false) }
  function handleSave() {
    saveSettings(draft); setSettings({ ...draft }); setIsEditing(false)
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }
  function updateDraft(field: keyof StoreSettings, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  /* ── Mechanic handlers ── */
  async function handleAddMechanic() {
    if (!addForm.name.trim()) return
    setAddSaving(true)
    try {
      const res = await apiPost<Mechanic>('/api/v1/mechanics', {
        name: addForm.name.trim(),
        phone: addForm.phone.trim() || undefined,
        specialty: addForm.specialty.trim() || undefined,
      })
      if (res.success && res.data) {
        setMechanics(prev => [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)))
        setAddForm({ name: '', phone: '', specialty: '' })
        setShowAdd(false)
      } else {
        setMechError(res.error ?? 'Gagal menambah mekanik')
      }
    } catch { setMechError('Gagal menambah mekanik') }
    finally { setAddSaving(false) }
  }

  function startEdit(m: Mechanic) {
    setEditId(m.id)
    setEditForm({ name: m.name, phone: m.phone ?? '', specialty: m.specialty ?? '' })
  }

  async function handleSaveEdit() {
    if (!editId || !editForm.name.trim()) return
    setEditSaving(true)
    try {
      const res = await apiPatch<Mechanic>(`/api/v1/mechanics/${editId}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        specialty: editForm.specialty.trim() || undefined,
      })
      if (res.success && res.data) {
        setMechanics(prev => prev.map(m => m.id === editId ? res.data! : m))
        setEditId(null)
      } else {
        setMechError(res.error ?? 'Gagal mengubah mekanik')
      }
    } catch { setMechError('Gagal mengubah mekanik') }
    finally { setEditSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
    try {
      const res = await apiDelete<Mechanic>(`/api/v1/mechanics/${id}`)
      if (res.success) {
        setMechanics(prev => prev.map(m => m.id === id ? { ...m, isActive: false } : m))
      } else {
        setMechError(res.error ?? 'Gagal menghapus mekanik')
      }
    } catch { setMechError('Gagal menghapus mekanik') }
    finally { setDeleteId(null) }
  }

  async function handleReactivate(id: string) {
    try {
      const res = await apiPatch<Mechanic>(`/api/v1/mechanics/${id}`, { isActive: true })
      if (res.success) {
        setMechanics(prev => prev.map(m => m.id === id ? { ...m, isActive: true } : m))
      }
    } catch { /* silent */ }
  }

  const activeMechanics = mechanics.filter(m => m.isActive)
  const inactiveMechanics = mechanics.filter(m => !m.isActive)

  /* ── Render ── */
  return (
    <DashboardLayout>
      <PageHeader title="Pengaturan" subtitle="Konfigurasi sistem" />

      <Card className="animate-in stagger-2">
        <div className="flex flex-col gap-6">
          {/* ── Informasi Toko ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-ink">Informasi Toko</h3>
              {!isEditing ? (
                <button onClick={handleEdit} className="text-xs font-medium text-brand hover:text-brand-hover transition-colors">Edit</button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleCancel} className="text-xs font-medium text-ink-secondary hover:text-ink transition-colors">Batal</button>
                  <button onClick={handleSave} className="text-xs font-semibold text-white bg-brand hover:bg-brand-hover px-3 py-1 rounded-md transition-colors">Simpan</button>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-muted">Nama dan detail bisnis</p>

            {saved && (
              <div className="mt-2 text-xs font-medium text-success bg-success/10 px-3 py-1.5 rounded-md inline-block">
                Pengaturan berhasil disimpan
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-4">
              <SettingsField label="Nama Toko" value={isEditing ? draft.storeName : settings.storeName} isEditing={isEditing} onChange={v => updateDraft('storeName', v)} />
              <SettingsField label="Alamat" value={isEditing ? draft.storeAddress : settings.storeAddress} isEditing={isEditing} onChange={v => updateDraft('storeAddress', v)} />
              <SettingsField label="No. Telepon" value={isEditing ? draft.storePhone : settings.storePhone} isEditing={isEditing} mono onChange={v => updateDraft('storePhone', v)} />
              <SettingsField label="NPWP" value={isEditing ? draft.npwp : settings.npwp} isEditing={isEditing} mono onChange={v => updateDraft('npwp', v)} />
            </div>
          </div>

          {/* ── Daftar Mekanik ── */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-ink">Daftar Mekanik</h3>
              <button
                onClick={() => { setShowAdd(!showAdd); setMechError(null) }}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>
            <p className="text-xs text-ink-muted">Kelola data mekanik bengkel</p>

            {mechError && (
              <div className="mt-2 text-xs font-medium text-danger bg-danger/10 px-3 py-1.5 rounded-md">
                {mechError}
                <button onClick={() => setMechError(null)} className="ml-2 underline">Tutup</button>
              </div>
            )}

            {/* Add form */}
            {showAdd && (
              <div className="mt-3 p-3 bg-surface-secondary rounded-lg border border-border">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text" placeholder="Nama mekanik *" value={addForm.name}
                    onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                    className="text-[13px] bg-surface border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-brand"
                    autoFocus
                  />
                  <input
                    type="text" placeholder="No. HP (opsional)" value={addForm.phone}
                    onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                    className="text-[13px] bg-surface border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-brand"
                  />
                  <input
                    type="text" placeholder="Spesialisasi (opsional)" value={addForm.specialty}
                    onChange={e => setAddForm(p => ({ ...p, specialty: e.target.value }))}
                    className="text-[13px] bg-surface border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-brand"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setShowAdd(false); setAddForm({ name: '', phone: '', specialty: '' }) }}
                    className="text-xs text-ink-muted hover:text-ink px-2 py-1">
                    Batal
                  </button>
                  <button onClick={handleAddMechanic} disabled={addSaving || !addForm.name.trim()}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-brand hover:bg-brand-hover disabled:opacity-50 px-3 py-1 rounded-md">
                    {addSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            {mechLoading ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 size={14} className="animate-spin" /> Memuat data mekanik...
              </div>
            ) : activeMechanics.length === 0 && !showAdd ? (
              <div className="mt-3 text-xs text-ink-muted">Belum ada mekanik terdaftar</div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-surface-secondary">
                      <th className="text-left text-xs font-medium text-ink-muted px-3 py-2">Nama</th>
                      <th className="text-left text-xs font-medium text-ink-muted px-3 py-2">No. HP</th>
                      <th className="text-left text-xs font-medium text-ink-muted px-3 py-2">Spesialisasi</th>
                      <th className="text-right text-xs font-medium text-ink-muted px-3 py-2 w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeMechanics.map(m => (
                      <tr key={m.id} className="hover:bg-surface-secondary/50 transition-colors">
                        {editId === m.id ? (
                          <>
                            <td className="px-3 py-2">
                              <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                className="w-full text-[13px] bg-surface border border-brand rounded px-2 py-1 outline-none" autoFocus />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                className="w-full text-[13px] bg-surface border border-border rounded px-2 py-1 outline-none focus:border-brand" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={editForm.specialty} onChange={e => setEditForm(p => ({ ...p, specialty: e.target.value }))}
                                className="w-full text-[13px] bg-surface border border-border rounded px-2 py-1 outline-none focus:border-brand" />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => setEditId(null)} className="p-1 text-ink-muted hover:text-ink"><X size={14} /></button>
                                <button onClick={handleSaveEdit} disabled={editSaving || !editForm.name.trim()} className="p-1 text-brand hover:text-brand-hover disabled:opacity-50">
                                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-medium text-ink">{m.name}</td>
                            <td className="px-3 py-2 text-ink-secondary font-mono">{m.phone || '-'}</td>
                            <td className="px-3 py-2 text-ink-secondary">{m.specialty || '-'}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => startEdit(m)} className="p-1 text-ink-muted hover:text-brand transition-colors"><Pencil size={14} /></button>
                                <button onClick={() => handleDelete(m.id)} disabled={deleteId === m.id} className="p-1 text-ink-muted hover:text-danger transition-colors disabled:opacity-50">
                                  {deleteId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inactive mechanics */}
            {inactiveMechanics.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-ink-muted mb-1">Nonaktif ({inactiveMechanics.length})</p>
                <div className="flex flex-wrap gap-2">
                  {inactiveMechanics.map(m => (
                    <span key={m.id} className="flex items-center gap-1 text-xs text-ink-muted bg-surface-secondary rounded px-2 py-1">
                      <span className="line-through">{m.name}</span>
                      <button onClick={() => handleReactivate(m.id)} className="text-brand hover:text-brand-hover font-medium ml-1">Aktifkan</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Versi Sistem ── */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-ink mb-1">Versi Sistem</h3>
            <div className="mt-3 flex items-center gap-4">
              <span className="text-xs text-ink-muted">Teladan27 Motor ERP v1.0</span>
              <span className="text-xs text-ink-muted">·</span>
              <span className="text-xs text-ink-muted">API /api/v1/</span>
              <span className="text-xs text-ink-muted">·</span>
              <span className={`text-xs font-medium ${serverOnline === null ? 'text-ink-muted' : serverOnline ? 'text-success' : 'text-danger'}`}>
                {serverOnline === null ? 'Mengecek...' : serverOnline ? 'Server Online' : 'Server Offline'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  )
}

function SettingsField({ label, value, isEditing, mono, onChange }: {
  label: string; value: string; isEditing: boolean; mono?: boolean; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      {isEditing ? (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className={`text-[13px] font-medium text-ink bg-surface border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors ${mono ? 'font-mono' : ''}`} />
      ) : (
        <span className={`text-[13px] font-medium text-ink ${mono ? 'font-mono' : ''}`}>{value}</span>
      )}
    </div>
  )
}
