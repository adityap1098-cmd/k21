'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { apiPost, apiGet } from '@/lib/api'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react'

interface CashTx {
  id: string
  type: 'IN' | 'OUT'
  amount: number
  description: string
  createdAt: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  shiftId: string | undefined
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function CashTransactionModal({ isOpen, onClose, shiftId }: Props) {
  const { toast } = useToast()
  const [type, setType] = useState<'OUT' | 'IN'>('OUT')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<CashTx[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!shiftId) return
    setHistoryLoading(true)
    try {
      const res = await apiGet<CashTx[]>(`/api/v1/shifts/${shiftId}/cash-transactions`)
      if (res.success && res.data) setHistory(res.data)
    } catch { /* silent */ }
    setHistoryLoading(false)
  }, [shiftId])

  useEffect(() => {
    if (isOpen && shiftId) fetchHistory()
  }, [isOpen, shiftId, fetchHistory])

  function reset() {
    setAmount('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(amount, 10)
    if (!num || num <= 0) {
      toast('Nominal harus lebih dari 0', 'error')
      return
    }
    if (!description.trim()) {
      toast('Keterangan harus diisi', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost('/api/v1/shifts/cash-transaction', {
        shiftId,
        type,
        amount: num,
        description: description.trim(),
      })

      if (res.success) {
        toast(type === 'OUT' ? 'Pengeluaran berhasil dicatat' : 'Pemasukan berhasil dicatat')
        reset()
        fetchHistory()
      } else {
        toast(res.error || 'Gagal mencatat', 'error')
      }
    } catch {
      toast('Terjadi kesalahan', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalIn = history.filter(t => t.type === 'IN').reduce((s, t) => s + t.amount, 0)
  const totalOut = history.filter(t => t.type === 'OUT').reduce((s, t) => s + t.amount, 0)

  return (
    <Modal open={isOpen} onClose={onClose} title="Kas Masuk / Keluar" description="Catat pemasukan atau pengeluaran kas di luar transaksi POS">
      <div className="flex flex-col gap-4">
        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('OUT')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              type === 'OUT'
                ? 'bg-red-500/10 text-red-400 ring-2 ring-red-500/30'
                : 'bg-surface-subtle text-ink-muted hover:bg-surface-raised'
            }`}
          >
            <ArrowUpCircle size={16} />
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setType('IN')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              type === 'IN'
                ? 'bg-success/10 text-success ring-2 ring-success/30'
                : 'bg-surface-subtle text-ink-muted hover:bg-surface-raised'
            }`}
          >
            <ArrowDownCircle size={16} />
            Pemasukan
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-muted">Nominal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted font-medium">Rp</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-ink font-mono placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-muted">Keterangan</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'OUT' ? 'Contoh: Beli bensin test ride' : 'Contoh: Terima titipan kas'}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount || !description.trim()}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 shadow-sm ${
              type === 'OUT'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-success text-white hover:bg-success/90'
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {type === 'OUT' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                {type === 'OUT' ? 'Catat Pengeluaran' : 'Catat Pemasukan'}
              </>
            )}
          </button>
        </form>

        {/* Summary */}
        {(totalIn > 0 || totalOut > 0) && (
          <div className="flex gap-3">
            {totalIn > 0 && (
              <div className="flex-1 bg-success/10 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-success font-medium uppercase">Masuk</p>
                <p className="text-sm font-bold text-success font-mono">{formatRp(totalIn)}</p>
              </div>
            )}
            {totalOut > 0 && (
              <div className="flex-1 bg-red-500/10 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-red-400 font-medium uppercase">Keluar</p>
                <p className="text-sm font-bold text-red-400 font-mono">{formatRp(totalOut)}</p>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-ink-muted">Riwayat Shift Ini</p>
          <div className="max-h-[160px] overflow-y-auto rounded-lg border border-border-light">
            {historyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-ink-faint" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-xs text-ink-faint">Belum ada transaksi kas</div>
            ) : (
              history.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-3 py-2 border-b border-border-light last:border-b-0 hover:bg-surface-subtle/50">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'OUT' ? 'bg-red-500/10' : 'bg-success/10'
                  }`}>
                    {tx.type === 'OUT'
                      ? <ArrowUpCircle size={14} className="text-red-400" />
                      : <ArrowDownCircle size={14} className="text-success" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{tx.description}</p>
                    <p className="text-[10px] text-ink-faint">{formatTime(tx.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-bold font-mono shrink-0 ${
                    tx.type === 'OUT' ? 'text-red-400' : 'text-success'
                  }`}>
                    {tx.type === 'OUT' ? '-' : '+'}{formatRp(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
