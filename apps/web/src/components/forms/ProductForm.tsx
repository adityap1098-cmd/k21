'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { apiPost } from '@/lib/api'

interface Category {
  id: string; name: string
}

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  categories: Category[]
}

export function ProductForm({ open, onClose, onCreated, categories }: ProductFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [ppnType, setPpnType] = useState('TAXABLE')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [defaultCostPrice, setDefaultCostPrice] = useState('')
  const [description, setDescription] = useState('')

  function reset() {
    setName('')
    setCategoryId('')
    setPpnType('TAXABLE')
    setDefaultPrice('')
    setDefaultCostPrice('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !categoryId || !defaultPrice) return

    setLoading(true)
    try {
      const body = {
        name: name.trim(),
        categoryId,
        ppnType,
        defaultPrice: parseInt(defaultPrice) || 0,
        defaultCostPrice: parseInt(defaultCostPrice) || 0,
        description: description.trim() || undefined,
      }

      const res = await apiPost('/api/v1/products', body)
      if (res.success) {
        toast('Produk berhasil ditambahkan')
        reset()
        onCreated()
        onClose()
      } else {
        toast(res.error || 'Gagal menambahkan produk', 'error')
      }
    } catch {
      toast('Terjadi kesalahan', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Produk" description="Buat produk baru dengan variant default" width="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nama Produk"
          placeholder="contoh: Kaos Polos Premium"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <Select
          label="Kategori"
          options={[{ label: '— Pilih kategori —', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]}
          value={categoryId}
          onChange={setCategoryId}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Harga Jual (Rp)"
            type="number"
            placeholder="89000"
            value={defaultPrice}
            onChange={e => setDefaultPrice(e.target.value)}
            required
          />
          <Input
            label="Harga Beli (Rp)"
            type="number"
            placeholder="45000"
            value={defaultCostPrice}
            onChange={e => setDefaultCostPrice(e.target.value)}
          />
        </div>

        <Select
          label="Klasifikasi PPN"
          options={[
            { label: 'Kena Pajak (Taxable)', value: 'TAXABLE' },
            { label: 'Tidak Kena Pajak', value: 'NON_TAXABLE' },
          ]}
          value={ppnType}
          onChange={setPpnType}
        />

        <Input
          label="Deskripsi (opsional)"
          placeholder="Deskripsi singkat produk"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <p className="text-xs text-ink-muted">
          Variant default akan dibuat otomatis dengan SKU auto-generate. Tambah variant lain setelah produk dibuat.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-light">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading || !name.trim() || !categoryId || !defaultPrice}>
            {loading ? 'Menyimpan...' : 'Simpan Produk'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
