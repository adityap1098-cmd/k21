'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout'
import { ProductForm } from '@/components/forms/ProductForm'
import { CategoryForm } from '@/components/forms/CategoryForm'
import { EditProductForm } from '@/components/forms/EditProductForm'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { apiGet, apiDelete } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
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

const CATEGORY_BADGE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: 'bg-brand-muted', text: 'text-brand' },
  1: { bg: 'bg-info-muted', text: 'text-info' },
  2: { bg: 'bg-purple-muted', text: 'text-purple' },
  3: { bg: 'bg-success-muted', text: 'text-success' },
  4: { bg: 'bg-warning-muted', text: 'text-warning' },
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

const ITEMS_PER_PAGE = 10

/* ─── Page ─── */

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [page, setPage] = useState(1)
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

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.name])),
    [categories]
  )

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesSku = p.variants?.some(v => v.sku.toLowerCase().includes(q))
        const matchesBarcode = p.variants?.some(v => v.barcode?.toLowerCase().includes(q))
        if (!matchesName && !matchesSku && !matchesBarcode) return false
      }
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false
      if (statusFilter === 'active' && !p.isActive) return false
      if (statusFilter === 'inactive' && p.isActive) return false
      return true
    })
  }, [products, search, categoryFilter, statusFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, categoryFilter, statusFilter])

  // Generate page numbers
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    for (let i = 1; i <= Math.min(totalPages, 5); i++) pages.push(i)
    return pages
  }, [totalPages])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in stagger-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl sm:text-[22px] font-bold text-ink leading-7">Produk</h1>
          <p className="text-[13px] text-ink-muted leading-[18px]">Kelola katalog produk dan variant</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCategory(true)}
            className="flex items-center gap-1.5 rounded-lg py-[9px] px-4 bg-surface-raised border border-border text-ink-secondary text-[13px] font-medium hover:bg-surface-subtle transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 12L2 14H4L12.5 5.5L10.5 3.5L2 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Kategori
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg py-[9px] px-4 bg-brand text-white text-[13px] font-semibold hover:bg-brand-hover transition-colors press-scale shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.1)]"
          >
            <Plus size={16} aria-hidden="true" />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 animate-in stagger-2">
        <div className="flex items-center flex-1 gap-2 px-3.5 py-2.5 bg-surface-raised border border-border rounded-lg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-subtle transition-colors">
          <Search size={16} className="text-ink-faint flex-shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama produk, SKU, atau barcode..."
            aria-label="Cari produk"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-raised border border-border rounded-lg">
          <label htmlFor="cat-filter" className="text-[13px] font-medium text-ink-secondary whitespace-nowrap">Kategori:</label>
          <select
            id="cat-filter"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-transparent text-[13px] font-medium text-ink-secondary outline-none cursor-pointer appearance-none pr-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyA1TDYgOEw5IDUiIHN0cm9rZT0iIzVBNjI3MCIgc3Ryb2tlLXdpZHRoPSIxLjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[length:12px] bg-[right_0_center] bg-no-repeat"
          >
            <option value="all">Semua</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-raised border border-border rounded-lg">
          <label htmlFor="status-filter" className="text-[13px] font-medium text-ink-secondary whitespace-nowrap">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="bg-transparent text-[13px] font-medium text-ink-secondary outline-none cursor-pointer appearance-none pr-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMyA1TDYgOEw5IDUiIHN0cm9rZT0iIzVBNjI3MCIgc3Ryb2tlLXdpZHRoPSIxLjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[length:12px] bg-[right_0_center] bg-no-repeat"
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-Aktif</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="flex flex-col flex-1 rounded-[14px] overflow-hidden bg-surface-raised border border-border shadow-[0_1px_2px_rgba(0,0,0,0.03)] animate-in stagger-3 min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <div className="min-w-[880px]">
            {/* Table Header */}
            <div className="flex items-center py-3 px-[22px] bg-surface-subtle border-b border-border">
              <span className="w-[320px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">Produk</span>
              <span className="w-[120px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">SKU</span>
              <span className="w-[120px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">Kategori</span>
              <span className="w-[100px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">Harga</span>
              <span className="w-[80px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">Stok</span>
              <span className="w-[80px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em]">PPN</span>
              <span className="w-[60px] shrink-0 text-[11px] font-semibold text-ink-muted uppercase tracking-[0.05em] text-right">Aksi</span>
            </div>

            {/* Table Body */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="text-ink-faint animate-spin" />
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <svg width="32" height="32" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" stroke="#9CA3AF" strokeWidth="1.2" />
                </svg>
                <p className="text-sm font-medium text-ink-muted">Belum ada produk</p>
                <p className="text-xs text-ink-faint">Tambah produk pertama untuk memulai</p>
              </div>
            ) : paginatedProducts.map((p, idx) => {
              const defaultVariant = p.variants?.[0]
              const totalStock = p.variants?.reduce((s, v) => s + v.stockQty, 0) ?? 0
              const isLowStock = p.variants?.some(v => v.stockQty <= v.lowStockThreshold) ?? false
              const catName = p.categoryId ? categoryMap[p.categoryId] : null
              const catIdx = categories.findIndex(c => c.id === p.categoryId)
              const catColor = CATEGORY_BADGE_COLORS[catIdx % 5] ?? CATEGORY_BADGE_COLORS[0]
              const isLastItem = idx === paginatedProducts.length - 1

              return (
                <div
                  key={p.id}
                  className={`flex items-center px-[22px] py-3.5 hover:bg-surface-subtle transition-colors cursor-pointer group ${
                    !isLastItem ? 'border-b border-border-light' : ''
                  }`}
                  onClick={() => setEditProductId(p.id)}
                >
                  {/* Product name + icon */}
                  <div className="w-[320px] shrink-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F0EDE9] flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                        <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" stroke="#9CA3AF" strokeWidth="1.2" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                      <span className="text-[11px] text-ink-muted">{p.variants?.length ?? 0} variant</span>
                    </div>
                  </div>

                  {/* SKU */}
                  <span className="w-[120px] shrink-0 font-mono text-xs text-ink-secondary">
                    {defaultVariant?.sku || '—'}
                  </span>

                  {/* Category badge */}
                  <div className="w-[120px] shrink-0">
                    {catName ? (
                      <span className={`inline-block rounded-sm py-[3px] px-2 text-[11px] font-medium ${catColor.bg} ${catColor.text}`}>
                        {catName}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </div>

                  {/* Price */}
                  <span className="w-[100px] shrink-0 text-[13px] font-medium text-ink tabular-nums">
                    {defaultVariant ? formatRp(defaultVariant.price) : '—'}
                  </span>

                  {/* Stock */}
                  <div className="w-[80px] shrink-0 flex items-center gap-1">
                    <span className={`text-[13px] font-semibold tabular-nums ${
                      isLowStock ? 'text-danger' : totalStock <= 15 ? 'text-warning' : 'text-success'
                    }`}>
                      {totalStock}
                    </span>
                    {isLowStock && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M7 2L7 9M7 11.5V12" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  {/* PPN badge */}
                  <div className="w-[80px] shrink-0">
                    <span className={`inline-block rounded-sm py-[3px] px-2 text-[11px] font-medium ${
                      p.ppnType === 'TAXABLE'
                        ? 'bg-success-muted text-success'
                        : 'bg-[rgba(122,132,144,0.1)] text-ink-muted'
                    }`}>
                      {p.ppnType === 'TAXABLE' ? 'Taxable' : 'Non-Tax'}
                    </span>
                  </div>

                  {/* Action menu */}
                  <div className="w-[60px] shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
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
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between py-3.5 px-[22px] border-t border-border mt-auto">
          <span className="text-xs text-ink-muted">
            {filtered.length > 0
              ? `Menampilkan ${startIdx}-${endIdx} dari ${filtered.length} produk`
              : '0 produk'
            }
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Halaman sebelumnya"
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft size={14} className="text-ink-faint" />
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-label={`Halaman ${n}`}
                  aria-current={n === currentPage ? 'page' : undefined}
                  className={`w-8 h-8 rounded-md text-xs font-semibold flex items-center justify-center transition-colors ${
                    n === currentPage
                      ? 'bg-brand text-white'
                      : 'border border-border text-ink-secondary hover:bg-surface-subtle'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Halaman berikutnya"
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight size={14} className="text-ink-secondary" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
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
