'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { apiPost } from '@/lib/api'
import { Trash2 } from 'lucide-react'

interface Category {
  id: string; name: string
}

interface CategoryFormProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  categories: Category[]
}

export function CategoryForm({ open, onClose, onCreated, categories }: CategoryFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const res = await apiPost('/api/v1/categories', { name: name.trim() })
      if (res.success) {
        toast('Kategori berhasil ditambahkan')
        setName('')
        onCreated()
      } else {
        toast(res.error || 'Gagal menambahkan kategori', 'error')
      }
    } catch {
      toast('Terjadi kesalahan', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Kelola Kategori" description="Tambah dan lihat kategori produk">
      {/* Add form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-3 mb-5">
        <div className="flex-1">
          <Input
            label="Nama Kategori Baru"
            placeholder="contoh: Elektronik"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading || !name.trim()} size="md">
          {loading ? '...' : 'Tambah'}
        </Button>
      </form>

      {/* Existing categories */}
      <div className="border-t border-border-light pt-4">
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Kategori ({categories.length})</span>
        <div className="flex flex-col mt-3 gap-1">
          {categories.length === 0 ? (
            <p className="text-sm text-ink-faint py-4 text-center">Belum ada kategori</p>
          ) : categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-subtle transition-colors">
              <span className="text-[13px] font-medium text-ink">{c.name}</span>
              <span className="text-[11px] text-ink-faint font-mono">{c.id.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 mt-2 border-t border-border-light">
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      </div>
    </Modal>
  )
}
