'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { apiPost } from '@/lib/api'

interface UserFormProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const ROLES = [
  { label: 'Owner', value: 'Owner' },
  { label: 'Admin', value: 'Admin' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Cashier', value: 'Cashier' },
  { label: 'Warehouse Staff', value: 'Warehouse Staff' },
]

export function UserForm({ open, onClose, onCreated }: UserFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Cashier')

  function reset() {
    setName('')
    setEmail('')
    setPassword('')
    setRole('Cashier')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    if (password.length < 8) {
      toast('Password minimal 8 karakter', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost('/api/v1/users', { name: name.trim() || undefined, email, password, role })
      if (res.success) {
        toast('Pengguna berhasil ditambahkan')
        reset()
        onCreated()
        onClose()
      } else {
        const msg = res.error === 'EMAIL_EXISTS'
          ? 'Email sudah terdaftar'
          : res.error?.includes('8 character')
            ? 'Password minimal 8 karakter'
            : res.error || 'Gagal menambahkan'
        toast(msg, 'error')
      }
    } catch {
      toast('Terjadi kesalahan', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Pengguna" description="Buat akun baru untuk karyawan">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nama"
          type="text"
          placeholder="Nama lengkap karyawan"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="Minimal 8 karakter"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <Select
          label="Role"
          options={ROLES}
          value={role}
          onChange={setRole}
        />
        <p className="text-xs text-ink-muted">
          Pengguna baru akan diminta mengganti password saat login pertama.
        </p>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-light">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading || !email || !password}>
            {loading ? 'Menyimpan...' : 'Tambah Pengguna'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
