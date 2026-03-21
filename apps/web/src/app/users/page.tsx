'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card } from '@/components/ui'
import { UserForm } from '@/components/forms/UserForm'
import { apiGet } from '@/lib/api'
import { Plus, MoreVertical, Loader2, Users as UsersIcon } from 'lucide-react'

/* ─── Types ─── */

interface User {
  id: string; email: string; role: string; isActive: boolean
  createdAt: string; updatedAt: string
}

const ROLE_COLORS: Record<string, 'brand' | 'blue' | 'green' | 'amber' | 'purple'> = {
  'Owner': 'brand',
  'Admin': 'blue',
  'Finance': 'green',
  'Cashier': 'amber',
  'Warehouse Staff': 'purple',
}

function getInitials(email: string): string {
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Page ─── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<User[]>('/api/v1/users')
    if (res.success && res.data) setUsers(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeCount = users.filter(u => u.isActive).length
  const inactiveCount = users.filter(u => !u.isActive).length

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

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[720px] flex flex-col flex-1">
        <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
          <span className="w-[250px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Pengguna</span>
          <span className="w-[200px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Email</span>
          <span className="w-[140px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Role</span>
          <span className="w-[80px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
          <span className="flex-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Terdaftar</span>
          <span className="w-[50px]" />
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
            <div key={u.id} className="flex items-center px-5 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer group">
              <div className="w-[250px] flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  u.isActive ? 'bg-brand' : 'bg-ink-faint'
                }`}>
                  <span className="text-white text-xs font-semibold">{getInitials(u.email)}</span>
                </div>
                <span className="text-[13px] font-semibold text-ink">{u.email.split('@')[0]}</span>
              </div>
              <span className="w-[200px] text-[13px] text-ink-secondary">{u.email}</span>
              <div className="w-[140px]">
                <Badge color={ROLE_COLORS[u.role] || 'neutral'}>{u.role}</Badge>
              </div>
              <div className="w-[80px]">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-success' : 'text-ink-faint'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-success' : 'bg-ink-faint'}`} />
                  {u.isActive ? 'Aktif' : 'Off'}
                </span>
              </div>
              <span className="flex-1 text-[13px] text-ink-muted">{formatDate(u.createdAt)}</span>
              <div className="w-[50px] flex justify-end">
                <button className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface transition-all">
                  <MoreVertical size={16} className="text-ink-muted" />
                </button>
              </div>
            </div>
          ))}
        </div>
          </div>{/* min-w */}
        </div>{/* overflow-x */}
      </Card>

      <UserForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />
    </DashboardLayout>
  )
}
