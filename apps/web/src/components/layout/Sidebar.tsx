'use client'

import { clsx } from 'clsx'
import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { T27LogoCompact } from '@/components/ui/Logo'
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
  KeyRound,
  ClockArrowUp,
  Bell,
  ScrollText,
  Truck,
} from 'lucide-react'

/* ─── Types ─── */

type Role = 'Owner' | 'Admin' | 'Finance' | 'Warehouse Staff' | 'Cashier'

interface NavItemDef {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles?: Role[] // if undefined → visible to all roles
}

/* ─── Nav items with role visibility ─── */

const NAV_MAIN: NavItemDef[] = [
  { href: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/pos',          label: 'Point of Sale',   icon: MonitorSmartphone, roles: ['Owner', 'Admin', 'Cashier'] },
  { href: '/shift-history', label: 'Riwayat Shift',  icon: ClockArrowUp,      roles: ['Owner', 'Admin', 'Cashier', 'Finance'] },
  { href: '/products',     label: 'Produk',          icon: Package,           roles: ['Owner', 'Admin', 'Warehouse Staff'] },
  { href: '/inventory',    label: 'Inventori',       icon: Warehouse,         roles: ['Owner', 'Admin', 'Warehouse Staff'] },
  { href: '/suppliers',    label: 'Supplier',        icon: Truck,             roles: ['Owner', 'Admin', 'Warehouse Staff', 'Finance'] },
  { href: '/procurement',  label: 'Procurement',     icon: FileText,          roles: ['Owner', 'Admin', 'Warehouse Staff', 'Finance'] },
  { href: '/warehouse',    label: 'Warehouse',       icon: Warehouse,         roles: ['Owner', 'Admin', 'Warehouse Staff'] },
  { href: '/marketplace',  label: 'Marketplace',     icon: ShoppingBag,       roles: ['Owner', 'Admin'] },
  { href: '/reports',      label: 'Laporan',         icon: BarChart3,         roles: ['Owner', 'Admin', 'Finance'] },
]

const NAV_ADMIN: NavItemDef[] = [
  { href: '/payroll',    label: 'Payroll',    icon: Wallet,     roles: ['Owner', 'Finance'] },
  { href: '/audit-logs', label: 'Audit Log',  icon: ScrollText, roles: ['Owner', 'Admin'] },
  { href: '/users',      label: 'Pengguna',   icon: Users,      roles: ['Owner', 'Admin'] },
  { href: '/settings',   label: 'Pengaturan', icon: Settings,   roles: ['Owner', 'Admin'] },
]

/* ─── Sidebar ─── */

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const displayName = user?.name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const role = (user?.role || 'Cashier') as Role
  const [mobileOpen, setMobileOpen] = useState(false)

  // Filter nav items by role
  const mainItems = useMemo(
    () => NAV_MAIN.filter(item => !item.roles || item.roles.includes(role)),
    [role],
  )
  const adminItems = useMemo(
    () => NAV_ADMIN.filter(item => !item.roles || item.roles.includes(role)),
    [role],
  )

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
        'flex flex-col w-[220px] h-dvh flex-shrink-0 bg-sidebar px-4 py-6 gap-1 overflow-y-auto z-50',
        'lg:relative lg:translate-x-0',
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
          <T27LogoCompact size={36} />
          <div className="flex flex-col">
            <span className="text-white font-bold text-[14px] leading-[18px]">Teladan27</span>
            <span className="text-[#C5A44E] text-[11px] font-semibold leading-[14px]">Motor</span>
          </div>
        </Link>

        {/* Main nav */}
        <nav aria-label="Menu Utama">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted px-3 mt-5 mb-2 block">
            Menu Utama
          </span>
          {mainItems.map(item => (
            <NavItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        {/* Admin nav — only show section if there are visible items */}
        {adminItems.length > 0 && (
          <nav aria-label="Administrasi">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted px-3 mt-5 mb-2 block">
              Administrasi
            </span>
            {adminItems.map(item => (
              <NavItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </nav>
        )}

        {/* Theme + User profile — pushed to bottom */}
        <div className="mt-auto flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between px-3">
            <ThemeToggle />
            <NotificationBell />
          </div>
          <Link
            href="/change-password"
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150',
              pathname.startsWith('/change-password')
                ? 'bg-sidebar-active text-brand'
                : 'text-ink-muted hover:bg-sidebar-hover hover:text-[#c4c9d0]',
            )}
          >
            <KeyRound size={16} strokeWidth={1.5} />
            Ganti Password
          </Link>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-[rgba(255,255,255,0.06)]">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">{initials}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-white text-xs font-medium truncate">{displayName}</span>
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

function NavItem({ item, active }: { item: NavItemDef; active: boolean }) {
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
