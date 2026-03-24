'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card } from '@/components/ui'
import { UserForm } from '@/components/forms/UserForm'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { Plus, MoreVertical, Loader2, Users as UsersIcon, X } from 'lucide-react'

/* ─── Types ─── */

interface User {
  id: string; name: string | null; email: string; role: string; isActive: boolean
  mustChangePassword?: boolean
  createdAt: string; updatedAt: string
}

const ROLE_COLORS: Record<string, 'brand' | 'blue' | 'green' | 'amber' | 'purple'> = {
  'Owner': 'brand',
  'Admin': 'blue',
  'Finance': 'green',
  'Cashier': 'amber',
  'Warehouse Staff': 'purple',
}

const ROLES = ['Owner', 'Admin', 'Finance', 'Warehouse Staff', 'Cashier'] as const

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

function getDisplayName(name: string | null, email: string): string {
  return name || email.split('@')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Page ─── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Edit role inline
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRoleValue, setEditRoleValue] = useState('')
  const [editRoleSaving, setEditRoleSaving] = useState(false)

  // Edit name inline
  const [editNameId, setEditNameId] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [editNameSaving, setEditNameSaving] = useState(false)

  // Reset password modal
  const [resetModal, setResetModal] = useState<{ userId: string; email: string } | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Action feedback
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<User[]>('/api/v1/users')
    if (res.success && res.data) setUsers(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Clear action message after 3s
  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(null), 3000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const activeCount = users.filter(u => u.isActive).length
  const inactiveCount = users.filter(u => !u.isActive).length

  /* ── Handlers ── */

  async function handleDeactivate(user: User) {
    if (!confirm(`Nonaktifkan akun ${user.email}?`)) return
    setOpenMenuId(null)
    try {
      const res = await apiPatch<{ isActive: boolean }>(`/api/v1/users/${user.id}`, { isActive: false })
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: false } : u))
        setActionMsg({ type: 'success', text: `${user.email} berhasil dinonaktifkan` })
      } else {
        setActionMsg({ type: 'error', text: res.error ?? 'Gagal menonaktifkan' })
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Gagal menonaktifkan' })
    }
  }

  async function handleReactivate(user: User) {
    if (!confirm(`Aktifkan kembali akun ${user.email}?`)) return
    setOpenMenuId(null)
    try {
      const res = await apiPatch<{ isActive: boolean }>(`/api/v1/users/${user.id}`, { isActive: true })
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: true } : u))
        setActionMsg({ type: 'success', text: `${user.email} berhasil diaktifkan kembali` })
      } else {
        setActionMsg({ type: 'error', text: res.error ?? 'Gagal mengaktifkan' })
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Gagal mengaktifkan' })
    }
  }

  function startEditName(user: User) {
    setOpenMenuId(null)
    setEditNameId(user.id)
    setEditNameValue(user.name || '')
  }

  async function saveEditName(userId: string) {
    setEditNameSaving(true)
    try {
      const res = await apiPatch<User>(`/api/v1/users/${userId}`, { name: editNameValue.trim() })
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: editNameValue.trim() || null } : u))
        setEditNameId(null)
        setActionMsg({ type: 'success', text: 'Nama berhasil diubah' })
      } else {
        setActionMsg({ type: 'error', text: res.error ?? 'Gagal mengubah nama' })
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Gagal mengubah nama' })
    } finally {
      setEditNameSaving(false)
    }
  }

  function startEditRole(user: User) {
    setOpenMenuId(null)
    setEditRoleId(user.id)
    setEditRoleValue(user.role)
  }

  async function saveEditRole(userId: string) {
    setEditRoleSaving(true)
    try {
      const res = await apiPatch<User>(`/api/v1/users/${userId}`, { role: editRoleValue })
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRoleValue } : u))
        setEditRoleId(null)
        setActionMsg({ type: 'success', text: 'Role berhasil diubah' })
      } else {
        setActionMsg({ type: 'error', text: res.error ?? 'Gagal mengubah role' })
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Gagal mengubah role' })
    } finally {
      setEditRoleSaving(false)
    }
  }

  function openResetModal(user: User) {
    setOpenMenuId(null)
    setResetModal({ userId: user.id, email: user.email })
    setResetPassword('')
    setResetError(null)
    setResetSuccess(false)
  }

  async function handleResetPassword() {
    if (!resetModal) return
    if (resetPassword.length < 8) {
      setResetError('Password minimal 8 karakter')
      return
    }
    setResetSaving(true)
    setResetError(null)
    try {
      const res = await apiPost<{ passwordReset: boolean }>(`/api/v1/users/${resetModal.userId}/reset-password`, {
        newPassword: resetPassword,
      })
      if (res.success) {
        setResetSuccess(true)
        setTimeout(() => { setResetModal(null); setResetSuccess(false) }, 1500)
      } else {
        setResetError(res.error ?? 'Gagal reset password')
      }
    } catch {
      setResetError('Gagal terhubung ke server')
    } finally {
      setResetSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Pengguna"
        subtitle="Kelola akun dan hak akses"
        actions={<Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Tambah Pengguna</Button>}
      />

      <div className="flex items-center gap-6 text-sm animate-in stagger-2">
        <span className="text-ink-muted">Total: <strong className="text-ink">{users.length}</strong></span>
        <span className="text-ink-muted">Aktif: <strong className="text-success">{activeCount}</strong></span>
        <span className="text-ink-muted">Non-aktif: <strong className="text-danger">{inactiveCount}</strong></span>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div className={`text-xs font-medium px-3 py-2 rounded-lg animate-in ${
          actionMsg.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={() => setOpenMenuId(null)}>
      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
        <div className="overflow-x-auto flex-1 flex flex-col">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="min-w-[720px] flex flex-col flex-1" onClick={e => e.stopPropagation()}>
        <div className="grid grid-cols-[minmax(160px,1.8fr)_minmax(150px,2fr)_120px_80px_minmax(120px,1.5fr)_48px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-3">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Pengguna</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Email</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Role</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Terdaftar</span>
          <span />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <UsersIcon size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada pengguna</p>
            </div>
          ) : users.map(u => (
            <div key={u.id} className="grid grid-cols-[minmax(160px,1.8fr)_minmax(150px,2fr)_120px_80px_minmax(120px,1.5fr)_48px] items-center px-6 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer group gap-3 relative">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  u.isActive ? 'bg-brand' : 'bg-ink-faint'
                }`}>
                  <span className="text-white text-xs font-semibold">{getInitials(u.name, u.email)}</span>
                </div>
                {editNameId === u.id ? (
                  <div className="flex items-center gap-1 min-w-0">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={e => setEditNameValue(e.target.value)}
                      placeholder="Nama lengkap"
                      className="text-[13px] bg-surface border border-brand rounded px-2 py-0.5 outline-none w-28"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEditName(u.id); if (e.key === 'Escape') setEditNameId(null); }}
                    />
                    <button onClick={() => saveEditName(u.id)} disabled={editNameSaving} className="text-brand hover:text-brand-hover text-xs font-semibold disabled:opacity-50">
                      {editNameSaving ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                    </button>
                    <button onClick={() => setEditNameId(null)} className="text-ink-muted hover:text-ink text-xs"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-ink truncate">{getDisplayName(u.name, u.email)}</span>
                    {u.name && <span className="text-[11px] text-ink-muted truncate">{u.email.split('@')[0]}</span>}
                  </div>
                )}
              </div>
              <span className="text-[13px] text-ink-secondary min-w-0 truncate">{u.email}</span>
              <div className="min-w-0">
                {editRoleId === u.id ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={editRoleValue}
                      onChange={e => setEditRoleValue(e.target.value)}
                      className="text-xs bg-surface border border-brand rounded px-1.5 py-1 outline-none"
                      autoFocus
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={() => saveEditRole(u.id)}
                      disabled={editRoleSaving || editRoleValue === u.role}
                      className="text-brand hover:text-brand-hover text-xs font-semibold disabled:opacity-50"
                    >
                      {editRoleSaving ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                    </button>
                    <button
                      onClick={() => setEditRoleId(null)}
                      className="text-ink-muted hover:text-ink text-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <Badge color={ROLE_COLORS[u.role] || 'neutral'}>{u.role}</Badge>
                )}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-success' : 'text-ink-faint'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-success' : 'bg-ink-faint'}`} />
                  {u.isActive ? 'Aktif' : 'Off'}
                </span>
              </div>
              <span className="text-[13px] text-ink-muted min-w-0 truncate">{formatDate(u.createdAt)}</span>
              <div className="flex justify-end relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                  className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface transition-all"
                >
                  <MoreVertical size={16} className="text-ink-muted" />
                </button>
                {openMenuId === u.id && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-raised border border-border rounded-xl shadow-lg z-10 w-44">
                    <button
                      onClick={() => startEditName(u)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-subtle transition-colors first:rounded-t-xl"
                    >
                      Ubah Nama
                    </button>
                    <button
                      onClick={() => startEditRole(u)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-subtle transition-colors border-t border-border-light"
                    >
                      Ubah Role
                    </button>
                    <button
                      onClick={() => openResetModal(u)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-subtle transition-colors border-t border-border-light"
                    >
                      Reset Password
                    </button>
                    {u.isActive ? (
                      <button
                        onClick={() => handleDeactivate(u)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-subtle transition-colors border-t border-border-light text-danger last:rounded-b-xl"
                      >
                        Nonaktifkan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(u)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-subtle transition-colors border-t border-border-light text-success last:rounded-b-xl"
                      >
                        Aktifkan Kembali
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
          </div>{/* min-w */}
        </div>{/* overflow-x */}
      </Card>
      </div>{/* click-outside trap */}

      <UserForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setResetModal(null)} />
          <div className="relative bg-surface-raised border border-border rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-ink mb-1">Reset Password</h3>
            <p className="text-xs text-ink-muted mb-4">
              Reset password untuk <strong>{resetModal.email}</strong>. User akan diminta ganti password saat login berikutnya.
            </p>

            {resetSuccess ? (
              <div className="text-sm font-medium text-success bg-success/10 px-3 py-2 rounded-lg text-center">
                Password berhasil direset!
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Password baru (min 8 karakter)"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full text-[13px] bg-surface border border-border rounded-lg px-3 py-2.5 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
                  autoFocus
                />

                {resetError && (
                  <p className="mt-2 text-xs text-danger">{resetError}</p>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setResetModal(null)}
                    className="text-sm text-ink-secondary hover:text-ink px-3 py-1.5 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetSaving || resetPassword.length < 8}
                    className="text-sm font-semibold text-white bg-brand hover:bg-brand-hover disabled:opacity-50 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {resetSaving && <Loader2 size={14} className="animate-spin" />}
                    Reset Password
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
