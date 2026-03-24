'use client'
import { useState } from 'react'
import type { ReceiptData } from '@/lib/receipt/encoder'
import { encodeReceipt } from '@/lib/receipt/encoder'
import { connectPrinter, printReceipt, isPrinterConnected } from '@/lib/receipt/webserial'
import { buildWhatsAppUrl } from '@/lib/receipt/whatsapp'
import { T27Logo } from '@/components/ui/Logo'

interface Props {
  isOpen: boolean
  receiptData: ReceiptData | null
  onClose: () => void
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

export function ReceiptModal({ isOpen, receiptData, onClose }: Props) {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  async function handlePrint() {
    if (!receiptData) return
    setIsPrinting(true)
    setPrintError(null)

    try {
      if (!isPrinterConnected()) {
        await connectPrinter()
      }
      const encoded = encodeReceipt(receiptData, 80)
      await printReceipt(encoded)
    } catch (err) {
      const serialError = err instanceof Error ? err.message : String(err)
      if (serialError === 'PRINTER_NOT_CONNECTED' || serialError.includes('NotFoundError')) {
        window.print()
      } else {
        setPrintError('Gagal mencetak via Serial. Menggunakan printer browser...')
        window.print()
      }
    } finally {
      setIsPrinting(false)
    }
  }

  function handleWhatsApp() {
    if (!receiptData) return
    const url = buildWhatsAppUrl(receiptData)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isOpen || !receiptData) return null

  const totalQty = receiptData.items.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-[400px] mx-4 max-h-[92vh] flex flex-col">

        {/* ─── Invoice paper ─── */}
        <div className="overflow-y-auto flex-1">
          <div className="bg-white text-[#1a1a1a] rounded-t-xl">

            {/* Header — Logo + Store Info */}
            <div className="text-center pt-5 pb-4 px-5">
              <T27Logo size={72} variant="light" className="mx-auto mb-2" />
              <h2 className="text-[15px] font-bold tracking-tight mt-1">{receiptData.storeName}</h2>
              <p className="text-[11px] text-[#666] mt-0.5 leading-[16px]">{receiptData.storeAddress}</p>
              <p className="text-[11px] text-[#666]">Telp. {receiptData.storePhone}</p>
            </div>

            {/* ─── Invoice Details (labeled rows like the reference) ─── */}
            <div className="mx-4 border-t border-[#e5e5e5]" />
            <div className="px-5 py-3 space-y-1.5 text-[12px]">
              <div className="flex">
                <span className="w-[110px] text-[#888] shrink-0">Kode Invoice</span>
                <span className="text-[#888] mr-1">:</span>
                <span className="font-mono font-semibold text-[11px]">{receiptData.transactionId.slice(0, 16).toUpperCase()}</span>
              </div>
              <div className="flex">
                <span className="w-[110px] text-[#888] shrink-0">Tanggal</span>
                <span className="text-[#888] mr-1">:</span>
                <span>{receiptData.dateTime}</span>
              </div>
              <div className="flex">
                <span className="w-[110px] text-[#888] shrink-0">Kasir</span>
                <span className="text-[#888] mr-1">:</span>
                <span>{receiptData.cashierName.slice(0, 16)}</span>
              </div>
              {receiptData.customerName && (
                <div className="flex">
                  <span className="w-[110px] text-[#888] shrink-0">Pelanggan</span>
                  <span className="text-[#888] mr-1">:</span>
                  <span>{receiptData.customerName}</span>
                </div>
              )}
              <div className="flex">
                <span className="w-[110px] text-[#888] shrink-0">Metode Bayar</span>
                <span className="text-[#888] mr-1">:</span>
                <span>{receiptData.payments.map(p => METHOD_LABELS[p.method] || p.method).join(', ')}</span>
              </div>
            </div>

            {/* ─── Item List ─── */}
            <div className="mx-4 border-t border-[#e5e5e5]" />
            <div className="px-5 py-3 space-y-3">
              {receiptData.items.map((item, i) => (
                <div key={i}>
                  <p className="text-[12px] font-bold leading-[16px]">{item.name}</p>
                  <div className="flex justify-between text-[11px] text-[#555] mt-0.5">
                    <span>{item.qty}{item.unit ? ' ' + item.unit : ''} x {formatRp(item.unitPrice)}</span>
                    <span className="text-[#1a1a1a] tabular-nums">{formatRp(item.lineTotal)}</span>
                  </div>
                  {item.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-red-500 mt-0.5">
                      <span>Diskon item</span>
                      <span>-{formatRp(item.discountAmount)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ─── Totals ─── */}
            <div className="mx-4 border-t border-[#e5e5e5]" />
            <div className="px-5 py-3 text-[12px] space-y-1">
              <div className="flex justify-between text-[#888]">
                <span>Total QTY</span>
                <span className="text-[#1a1a1a]">{totalQty}</span>
              </div>
              <div className="flex justify-between">
                <span>Sub Total</span>
                <span className="tabular-nums">{formatRp(receiptData.subtotal)}</span>
              </div>
              {receiptData.transactionDiscount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Diskon</span>
                  <span className="tabular-nums">-{formatRp(receiptData.transactionDiscount)}</span>
                </div>
              )}

              {/* Total — highlighted */}
              <div className="flex justify-between font-bold text-[15px] pt-1.5 mt-1.5 border-t border-[#e5e5e5]">
                <span>Total Pembayaran</span>
                <span className="tabular-nums">{formatRp(receiptData.total)}</span>
              </div>
            </div>

            {/* ─── Payment breakdown ─── */}
            <div className="mx-4 border-t border-[#e5e5e5]" />
            <div className="px-5 py-3 text-[12px] space-y-1">
              {receiptData.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[#888]">Bayar ({METHOD_LABELS[p.method] || p.method}){p.reference ? ` - ${p.reference}` : ''}</span>
                  <span className="tabular-nums">{formatRp(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-[#888]">Kembali</span>
                <span className="tabular-nums">{formatRp(receiptData.changeDue)}</span>
              </div>

              {/* Status */}
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#e5e5e5]">
                <span className="font-medium text-[#888]">Status</span>
                <span className="text-[#16A34A] font-bold text-[13px]">LUNAS</span>
              </div>
            </div>

            {/* ─── Footer ─── */}
            <div className="mx-4 border-t border-[#e5e5e5]" />
            <div className="text-center py-4 px-5">
              <p className="text-[12px] font-medium text-[#444]">Terimakasih Telah Berbelanja</p>
              <p className="text-[10px] text-[#999] mt-1">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
            </div>
          </div>
        </div>

        {/* ─── Action buttons ─── */}
        <div className="p-4 space-y-2.5 shrink-0 border-t border-border bg-surface-raised rounded-b-xl">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-ink hover:bg-surface-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {isPrinting ? 'Mencetak...' : 'Cetak Struk'}
          </button>

          {printError && <p className="text-xs text-warning text-center">{printError}</p>}

          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Bagikan via WhatsApp
          </button>

          <button
            onClick={onClose}
            className="w-full bg-brand text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-hover transition-colors"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  )
}
