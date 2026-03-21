'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, Input, Select } from '@/components/ui'
import { ProductForm } from '@/components/forms/ProductForm'
import { CategoryForm } from '@/components/forms/CategoryForm'
import { EditProductForm } from '@/components/forms/EditProductForm'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { apiGet, apiDelete } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  Plus,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FolderOpen,
  Loader2,
} from 'lucide-react'

/* ─── Types ─── */

interface ProductVariant {
  id: string; sku: string; barcode: string | null
  price: number; costPrice: number; stockQty: number
  lowStockThreshold: number; attributes: Record<string, string> | null
}

interface Product {
  id: string; name: string; categoryId: string | null
  ppnType: 'TAXABLE' | 'NON_TAXABLE'; isActive: boolean
  variants?: ProductVariant[]
}

interface Category {
  id: string; name: string
}

const CATEGORY_COLORS: Record<number, 'brand' | 'blue' | 'purple' | 'green' | 'amber'> = {
  0: 'brand', 1: 'blue', 2: 'purple', 3: 'green', 4: 'amber',
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/* ─── Page ─── */

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showCategory, setShowCategory] = useState(false)
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      apiGet<Product[]>('/api/v1/products?variants=true'),
      apiGet<Category[]>('/api/v1/categories'),
    ])
    if (prodRes.success && prodRes.data) setProducts(prodRes.data)
    if (catRes.success && catRes.data) setCategories(catRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const categoryOptions = [
    { label: 'Semua', value: 'all' },
    ...categories.map(c => ({ label: c.name, value: c.id })),
  ]

  const filtered = products.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const matchesName = p.name.toLowerCase().includes(q)
      const matchesSku = p.variants?.some(v => v.sku.toLowerCase().includes(q))
      if (!matchesName && !matchesSku) return false
    }
    if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false
    return true
  })

  return (
    <DashboardLayout>
      <PageHeader
        title="Produk"
        subtitle="Kelola katalog produk dan variant"
        actions={
          <>
            <Button variant="secondary" icon={<FolderOpen size={15} />} onClick={() => setShowCategory(true)}>Kategori</Button>
            <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Tambah Produk</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in stagger-2">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Cari nama produk, SKU, atau barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select
            label="Kategori:"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
      </div>

      {/* Table */}
      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3 min-h-[400px]">
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            {/* Header */}
            <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
          <span className="w-[320px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Produk</span>
          <span className="w-[120px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">SKU</span>
          <span className="w-[120px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Kategori</span>
          <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Harga</span>
          <span className="w-[80px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Stok</span>
          <span className="w-[80px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">PPN</span>
          <span className="w-[60px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Aksi</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Package size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada produk</p>
              <p className="text-xs text-ink-faint">Tambah produk pertama untuk memulai</p>
            </div>
          ) : filtered.map(p => {
            const defaultVariant = p.variants?.[0]
            const totalStock = p.variants?.reduce((s, v) => s + v.stockQty, 0) ?? 0
            const isLowStock = p.variants?.some(v => v.stockQty <= v.lowStockThreshold) ?? false
            const catName = p.categoryId ? categoryMap[p.categoryId] : null
            const catIdx = categories.findIndex(c => c.id === p.categoryId)

            return (
              <div
                key={p.id}
                className="flex items-center px-5 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer group"
                onClick={() => setEditProductId(p.id)}
              >
                <div className="w-[320px] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center flex-shrink-0 border border-border-light">
                    <Package size={18} className="text-ink-faint" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                    <span className="text-[11px] text-ink-muted">{p.variants?.length ?? 0} variant</span>
                  </div>
                </div>
                <span className="w-[120px] font-mono text-xs text-ink-secondary">
                  {defaultVariant?.sku || '—'}
                </span>
                <div className="w-[120px]">
                  {catName ? (
                    <Badge color={CATEGORY_COLORS[catIdx % 5]}>{catName}</Badge>
                  ) : (
                    <span className="text-xs text-ink-faint">—</span>
                  )}
                </div>
                <span className="w-[100px] text-[13px] font-medium text-ink tabular-nums">
                  {defaultVariant ? formatRp(defaultVariant.price) : '—'}
                </span>
                <div className="w-[80px] flex items-center gap-1">
                  <span className={`text-[13px] font-semibold tabular-nums ${
                    isLowStock ? 'text-danger' : totalStock <= 15 ? 'text-warning' : 'text-success'
                  }`}>
                    {totalStock}
                  </span>
                  {isLowStock && <AlertTriangle size={13} className="text-danger" />}
                </div>
                <div className="w-[80px]">
                  <Badge color={p.ppnType === 'TAXABLE' ? 'green' : 'neutral'}>
                    {p.ppnType === 'TAXABLE' ? 'Taxable' : 'Non-Tax'}
                  </Badge>
                </div>
                <div className="w-[60px] flex justify-end">
                  <ActionMenu items={[
                    { label: 'Edit Produk', onClick: () => setEditProductId(p.id) },
                    { label: 'Hapus', onClick: async () => {
                      if (!confirm(`Hapus ${p.name}?`)) return
                      const res = await apiDelete(`/api/v1/products/${p.id}`)
                      if (res.success) { toast('Produk dihapus'); loadData() }
                      else toast(res.error || 'Gagal hapus', 'error')
                    }, danger: true },
                  ]} />
                </div>
              </div>
            )
          })}
        </div>
          </div>{/* close min-w */}
        </div>{/* close overflow-x */}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border mt-auto">
          <span className="text-xs text-ink-muted">
            {filtered.length} produk
          </span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors">
              <ChevronLeft size={14} className="text-ink-faint" />
            </button>
            <button className="w-8 h-8 rounded-md bg-brand text-white text-xs font-semibold flex items-center justify-center">1</button>
            <button className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors">
              <ChevronRight size={14} className="text-ink-secondary" />
            </button>
          </div>
        </div>
      </Card>

      <ProductForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
        categories={categories}
      />

      <CategoryForm
        open={showCategory}
        onClose={() => setShowCategory(false)}
        onCreated={loadData}
        categories={categories}
      />

      <EditProductForm
        open={editProductId !== null}
        onClose={() => setEditProductId(null)}
        onUpdated={loadData}
        productId={editProductId}
        categories={categories}
      />
    </DashboardLayout>
  )
}
