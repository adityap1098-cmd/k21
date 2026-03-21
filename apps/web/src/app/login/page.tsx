'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'

// Lazy import to avoid SSR issues with localStorage references
async function doLogin(email: string, password: string) {
  const { apiPost, setAccessToken } = await import('@/lib/api')
  const data = await apiPost<{ accessToken: string }>('/api/v1/auth/login', { email, password })
  if (data.success && data.data) {
    setAccessToken(data.data.accessToken)
  }
  return data
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await doLogin(email, password)

      if (!data.success || !data.data) {
        setError(data.error === 'INVALID_CREDENTIALS'
          ? 'Email atau password salah'
          : 'Terjadi kesalahan. Coba lagi.'
        )
        return
      }

      // Token already stored by doLogin
      window.location.href = '/dashboard'
    } catch {
      setError('Tidak dapat terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
    <div className="flex h-screen overflow-hidden">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-center flex-1 bg-sidebar px-[72px] py-20 gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-[52px] h-[52px] rounded-xl bg-brand flex items-center justify-center shadow-[0_4px_20px_rgba(232,93,58,0.35)]">
            <span className="text-white font-bold text-2xl">K</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-2xl tracking-tight">K21</span>
            <span className="text-[rgba(255,255,255,0.45)] text-sm">Retail ERP System</span>
          </div>
        </div>

        {/* Tagline */}
        <h1 className="text-white text-[40px] font-bold leading-[48px] tracking-[-0.04em] max-w-[640px]">
          Kelola toko Anda,{'\n'}satu platform.
        </h1>
        <p className="text-[rgba(255,255,255,0.5)] text-base leading-[26px] max-w-[640px]">
          Sistem ERP terpadu untuk manajemen penjualan, inventori, procurement, dan keuangan bisnis retail Anda.
        </p>

        {/* Decorative subtle grid */}
        <div className="mt-auto opacity-[0.04]">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="20" stroke="white" strokeWidth="0.5"/>
            <rect x="20" y="20" width="60" height="60" rx="14" stroke="white" strokeWidth="0.5"/>
            <rect x="38" y="38" width="24" height="24" rx="8" stroke="white" strokeWidth="0.5"/>
          </svg>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex items-center justify-center w-full lg:w-[560px] flex-shrink-0 bg-surface px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-[380px] flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-1.5 mb-2">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <span className="text-ink font-bold text-xl">K21</span>
            </div>
            <h2 className="text-[26px] font-bold text-ink tracking-[-0.03em]">Masuk</h2>
            <p className="text-sm text-ink-muted">Masukkan kredensial untuk melanjutkan</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-danger-muted text-danger text-[13px] font-medium animate-in">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
              </svg>
              {error}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              required
              autoComplete="email"
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-surface-raised text-[13px] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-subtle"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-ink">
                Password
              </label>
              <button type="button" className="text-xs text-brand hover:underline font-medium">
                Lupa password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-3 pr-11 rounded-lg border border-border bg-surface-raised text-[13px] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-subtle"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-secondary transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 mt-2 rounded-lg bg-brand text-white text-[15px] font-semibold press-scale transition-all duration-150 hover:bg-brand-hover disabled:opacity-50 disabled:pointer-events-none shadow-[0_2px_12px_rgba(232,93,58,0.3)]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" className="opacity-25"/>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="24" strokeLinecap="round"/>
                </svg>
                Memproses...
              </span>
            ) : 'Masuk'}
          </button>

          {/* Footer */}
          <p className="text-xs text-ink-faint text-center mt-4">
            K21 ERP v1.0 · Hak Cipta 2026
          </p>
        </form>
      </div>
    </div>
    </AppShell>
  )
}
