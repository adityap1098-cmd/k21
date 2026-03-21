'use client'

import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import {
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Warehouse,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ShoppingBag,
  Wallet,
  Menu,
  X,
} from 'lucide-react'

/* ─── Nav items ─── */

const NAV_MAIN = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/pos',          label: 'Point of Sale',  icon: MonitorSmartphone },
  { href: '/products',     label: 'Produk',         icon: Package },
  { href: '/inventory',    label: 'Inventori',      icon: Warehouse },
  { href: '/procurement',  label: 'Procurement',    icon: FileText },
  { href: '/warehouse',    label: 'Warehouse',      icon: Warehouse },
  { href: '/marketplace',  label: 'Marketplace',    icon: ShoppingBag },
  { href: '/reports',      label: 'Laporan',        icon: BarChart3 },
]

const NAV_ADMIN = [
  { href: '/payroll',  label: 'Payroll',    icon: Wallet },
  { href: '/users',    label: 'Pengguna',   icon: Users },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
]

/* ─── Sidebar ─── */

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const initials = user?.sub ? user.sub.slice(0, 2).toUpperCase() : 'AD'
  const role = user?.role || 'Owner'
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close on escape
  useEffect(() => {
    if (!mobileOpen) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [mobileOpen])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-sidebar text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-[rgba(0,0,0,0.5)] backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col w-[220px] h-screen flex-shrink-0 bg-sidebar px-4 py-6 gap-1 overflow-y-auto z-50',
        // Desktop: always visible
        'lg:relative lg:translate-x-0',
        // Mobile: slide-in drawer
        'fixed top-0 left-0 transition-transform duration-200 ease-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )} aria-label="Navigasi utama">
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
          className="lg:hidden absolute top-4 right-4 p-1 rounded-md text-ink-muted hover:text-white transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 mb-2 px-1">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(232,93,58,0.3)]">
            <span className="text-white font-bold text-base">K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-[15px] leading-[18px]">K21</span>
            <span className="text-ink-muted text-[11px] leading-[14px]">Retail ERP</span>
          </div>
        </Link>

        {/* Main nav */}
        <nav aria-label="Menu Utama">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted px-3 mt-5 mb-2 block">
            Menu Utama
          </span>
          {NAV_MAIN.map(item => (
            <NavItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        {/* Admin nav */}
        <nav aria-label="Administrasi">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted px-3 mt-5 mb-2 block">
            Administrasi
          </span>
          {NAV_ADMIN.map(item => (
            <NavItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        {/* Theme + User profile — pushed to bottom */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-between px-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-[rgba(255,255,255,0.06)]">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">{initials}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-white text-xs font-medium truncate">{user?.sub || 'User'}</span>
              <span className="text-ink-muted text-[11px] leading-[14px]">{role}</span>
            </div>
            <button
              onClick={logout}
              className="text-ink-muted hover:text-white transition-colors p-1 rounded"
              aria-label="Logout"
            >
              <LogOut size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

/* ─── NavItem ─── */

function NavItem({ item, active }: { item: typeof NAV_MAIN[0]; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={clsx(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium',
        'transition-colors duration-150',
        active
          ? 'bg-sidebar-active text-brand'
          : 'text-ink-muted hover:bg-sidebar-hover hover:text-[#c4c9d0]',
      )}
    >
      <Icon size={18} strokeWidth={active ? 2 : 1.5} />
      {item.label}
    </Link>
  )
}
