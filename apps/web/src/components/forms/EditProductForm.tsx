'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Input, Select, Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { Plus, Trash2 } from 'lucide-react'

interface Category { id: string; name: string }

interface Variant {
  id: string; sku: string; barcode: string | null
  price: number; costPrice: number; stockQty: number
  lowStockThreshold: number; attributes: Record<string, string> | null
}

interface Product {
  id: string; name: string; categoryId: string | null
  ppnType: string; isActive: boolean; variants?: Variant[]
}

interface EditProductFormProps {
  open: boolean
  onClose: () => void
  onUpdated: () => void
  productId: string | null
  categories: Category[]
}

export function EditProductForm({ open, onClose, onUpdated, productId, categories }: EditProductFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [ppnType, setPpnType] = useState('TAXABLE')
  const [isActive, setIsActive] = useState(true)

  // Load product
  useEffect(() => {
    if (!open || !productId) return
    setLoading(true)
    apiGet<Product>(`/api/v1/products/${productId}`).then(res => {
      if (res.success && res.data) {
        const p = res.data
        setProduct(p)
        setName(p.name)
        setCategoryId(p.categoryId || '')
        setPpnType(p.ppnType)
        setIsActive(p.isActive)
      }
      setLoading(false)
    })
  }, [open, productId])

  async function handleSave() {
    if (!productId) return
    setError('')
    setSaving(true)
    try {
      const res = await apiPatch(`/api/v1/products/${productId}`, {
        name: name.trim(),
        categoryId: categoryId || undefined,
        ppnType,
        isActive,
      })
      if (!res.success) {
        setError((res.data as { error?: string } | null)?.error ?? 'Gagal menyimpan perubahan')
        return
      }
      toast('Produk berhasil diupdate')
      onUpdated()
      onClose()
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateVariant(variantId: string, field: string, value: number) {
    if (!productId) return
    // Validate negative prices/costs
    if (field === 'price' && value < 0) {
      setError('Harga jual tidak boleh negatif')
      return
    }
    if (field === 'costPrice' && value < 0) {
      setError('Harga pokok tidak boleh negatif')
      return
    }
    setError('')
    const res = await apiPatch(`/api/v1/products/${productId}/variants/${variantId}`, { [field]: value })
    if (res.success) {
      toast('Variant diupdate')
      const reload = await apiGet<Product>(`/api/v1/products/${productId}`)
      if (reload.success && reload.data) setProduct(reload.data)
    } else {
      setError(res.error || 'Gagal update variant')
    }
  }

  async function handleAdjustStock(variantId: string, qty: number, reason: string) {
    // qty is signed: positive = add stock, negative = remove stock
    // Get user ID from JWT token
    const token = (await import('@/lib/api')).getAccessToken()
    let userId: string | undefined
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        userId = payload.sub
      } catch { /* ignore */ }
    }

    const res = await apiPost('/api/v1/inventory/movements', {
      variantId,
      movementType: 'ADJUSTMENT',
      qty,
      reason,
      approvedBy: userId,
      reference: qty > 0 ? `ADJUST +${Math.abs(qty)}` : `ADJUST -${Math.abs(qty)}`,
    })
    if (res.success) {
      toast(`Stok di-adjust ${qty > 0 ? '+' : ''}${qty}`)
      // Reload product to get updated stockQty
      if (productId) {
        const reload = await apiGet<Product>(`/api/v1/products/${productId}`)
        if (reload.success && reload.data) setProduct(reload.data)
      }
      onUpdated() // Refresh products list
    } else {
      toast(res.error || 'Gagal adjust stok', 'error')
    }
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title="Edit Produk" width="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !product ? (
        <p className="text-sm text-ink-muted text-center py-8">Produk tidak ditemukan</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 bg-danger-muted text-danger text-sm rounded border border-danger/20">
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nama Produk" value={name} onChange={e => setName(e.target.value)} />
            <Select
              label="Kategori"
              options={[{ label: '— Pilih —', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="PPN"
              options={[
                { label: 'Taxable', value: 'TAXABLE' },
                { label: 'Non-Taxable', value: 'NON_TAXABLE' },
              ]}
              value={ppnType}
              onChange={setPpnType}
            />
            <Select
              label="Status"
              options={[
                { label: 'Aktif', value: 'true' },
                { label: 'Non-Aktif', value: 'false' },
              ]}
              value={String(isActive)}
              onChange={v => setIsActive(v === 'true')}
            />
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>

          {/* Variants */}
          <div className="border-t border-border-light pt-4">
            <h3 className="text-sm font-semibold text-ink mb-3">
              Variant ({product.variants?.length || 0})
            </h3>

            {product.variants?.map(v => (
              <VariantRow
                key={v.id}
                variant={v}
                onUpdate={(field, value) => handleUpdateVariant(v.id, field, value)}
                onAdjustStock={handleAdjustStock}
              />
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-border-light">
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ─── Variant Row ─── */

function VariantRow({ variant, onUpdate, onAdjustStock }: {
  variant: Variant
  onUpdate: (field: string, value: number) => void
  onAdjustStock: (variantId: string, qty: number, reason: string) => void
}) {
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  function startEdit(field: string, currentValue: number) {
    setEditField(field)
    setEditValue(String(currentValue))
  }

  function saveEdit() {
    if (editField) {
      onUpdate(editField, parseInt(editValue) || 0)
      setEditField(null)
    }
  }

  const attrs = variant.attributes ? Object.values(variant.attributes).join(' / ') : 'Default'

  return (
    <>
    <div className="flex items-center gap-3 py-3 border-b border-border-light last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink truncate">{attrs}</p>
        <p className="text-[11px] text-ink-muted font-mono">{variant.sku}</p>
      </div>

      {/* Price */}
      <div className="w-24">
        {editField === 'price' ? (
          <input
            autoFocus
            type="number"
            min="0"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            className="w-full px-2 py-1 text-xs border border-brand rounded bg-surface-raised text-ink outline-none"
          />
        ) : (
          <button onClick={() => startEdit('price', variant.price)} className="text-xs font-medium text-ink hover:text-brand transition-colors tabular-nums">
            Rp {variant.price.toLocaleString('id-ID')}
          </button>
        )}
        <p className="text-[10px] text-ink-faint">Harga</p>
      </div>

      {/* Cost */}
      <div className="w-24">
        {editField === 'costPrice' ? (
          <input
            autoFocus
            type="number"
            min="0"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            className="w-full px-2 py-1 text-xs border border-brand rounded bg-surface-raised text-ink outline-none"
          />
        ) : (
          <button onClick={() => startEdit('costPrice', variant.costPrice)} className="text-xs font-medium text-ink-secondary hover:text-brand transition-colors tabular-nums">
            Rp {variant.costPrice.toLocaleString('id-ID')}
          </button>
        )}
        <p className="text-[10px] text-ink-faint">Modal</p>
      </div>

      {/* Stock + Adjust */}
      <div className="w-16 text-center">
        <button
          onClick={() => setShowAdjust(!showAdjust)}
          className={`text-xs font-semibold tabular-nums hover:text-brand transition-colors ${
            variant.stockQty <= variant.lowStockThreshold ? 'text-danger' : 'text-success'
          }`}
          title="Klik untuk adjust stok"
        >
          {variant.stockQty}
        </button>
        <p className="text-[10px] text-ink-faint">Stok</p>
      </div>
    </div>

    {/* Adjust stock panel */}
    {showAdjust && (
      <div className="flex items-end gap-2 px-3 pb-3 -mt-1 animate-in" style={{ animationDuration: '150ms' }}>
        <div className="flex-shrink-0">
          <p className="text-[10px] text-ink-muted mb-1">Jumlah (+/-)</p>
          <input
            type="number"
            placeholder="+10 atau -5"
            value={adjustQty}
            onChange={e => setAdjustQty(e.target.value)}
            className="w-24 px-2 py-1.5 text-xs border border-border rounded-md bg-surface-raised text-ink outline-none"
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-ink-muted mb-1">Alasan (wajib)</p>
          <input
            placeholder="Stok opname / koreksi / dll"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-surface-raised text-ink outline-none"
          />
        </div>
        <button
          onClick={() => {
            const qty = parseInt(adjustQty)
            if (!qty || !adjustReason.trim()) return
            onAdjustStock(variant.id, qty, adjustReason.trim())
            setAdjustQty('')
            setAdjustReason('')
            setShowAdjust(false)
          }}
          disabled={!adjustQty || !adjustReason.trim()}
          className="px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Adjust
        </button>
        <button
          onClick={() => setShowAdjust(false)}
          className="px-2 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Batal
        </button>
      </div>
    )}
    </>
  )
}
