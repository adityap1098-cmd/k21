'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { apiPost } from '@/lib/api'
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react'
import { T27Logo } from '@/components/ui/Logo'

export default function ChangePasswordPage() {
  const { user, logout } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // Inline feedback instead of toast (since no ToastProvider wrapper here)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const isForced = user?.mustChangePassword === true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (newPassword.length < 8) {
      setFeedback({ type: 'error', msg: 'Password baru minimal 8 karakter' })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', msg: 'Konfirmasi password tidak cocok' })
      return
    }
    if (currentPassword === newPassword) {
      setFeedback({ type: 'error', msg: 'Password baru harus berbeda dari password lama' })
      return
    }

    setLoading(true)
    try {
      const res = await apiPost('/api/v1/auth/change-password', {
        currentPassword,
        newPassword,
      })

      if (res.success) {
        setFeedback({ type: 'success', msg: 'Password berhasil diubah! Mengalihkan ke halaman login...' })
        setTimeout(() => logout(), 2000)
      } else {
        const err = typeof res.error === 'string' ? res.error : JSON.stringify(res.error)
        const msg = err.includes('WRONG_PASSWORD') || err.includes('Wrong password')
          ? 'Password lama salah'
          : err.includes('8 char') || err.includes('8 karakter')
            ? 'Password baru minimal 8 karakter'
            : err || 'Gagal mengubah password'
        setFeedback({ type: 'error', msg })
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Terjadi kesalahan jaringan' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <T27Logo size={48} variant="dark" />
        </div>

        {/* Card */}
        <div className="bg-surface-raised border border-border rounded-2xl p-6 shadow-lg">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-3">
              <Lock size={24} className="text-brand" />
            </div>
            <h1 className="text-lg font-bold text-ink">
              {isForced ? 'Ganti Password' : 'Ubah Password'}
            </h1>
            <p className="text-xs text-ink-muted mt-1 text-center max-w-xs">
              {isForced
                ? 'Anda harus mengganti password default sebelum melanjutkan'
                : 'Masukkan password lama dan password baru Anda'}
            </p>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-success/10 text-success'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {feedback.msg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-muted">Password Lama</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password lama"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-muted">Password Baru</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-[11px] text-amber-500">Minimal 8 karakter ({8 - newPassword.length} lagi)</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-muted">Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password baru"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-[11px] text-red-400">Password tidak cocok</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-hover disabled:opacity-40 transition-all mt-1 shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Simpan Password Baru
                </>
              )}
            </button>

            {!isForced && (
              <button
                type="button"
                onClick={() => window.history.back()}
                className="text-sm text-ink-muted hover:text-ink transition-colors text-center"
              >
                Kembali
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
