'use client'
import { useState } from 'react'
import type { ReceiptData } from '@/lib/receipt/encoder'
import { encodeReceipt } from '@/lib/receipt/encoder'
import { connectPrinter, printReceipt, isPrinterConnected } from '@/lib/receipt/webserial'
import { buildWhatsAppUrl } from '@/lib/receipt/whatsapp'

interface Props {
  isOpen: boolean
  receiptData: ReceiptData | null
  onClose: () => void
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
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
        // MUST be called from onClick — Web Serial user gesture requirement
        await connectPrinter()
      }
      const encoded = encodeReceipt(receiptData, 80)
      await printReceipt(encoded)
    } catch (err) {
      // Fallback to browser print if Web Serial fails
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="p-6 text-center border-b">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Transaksi Selesai</h2>
        </div>

        {/* Summary */}
        <div className="p-4 space-y-2 border-b">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">ID Transaksi</span>
            <span className="font-mono text-xs">#{receiptData.transactionId.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Kasir</span>
            <span>{receiptData.cashierName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Waktu</span>
            <span>{receiptData.dateTime}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatRp(receiptData.total)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 space-y-3">
          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {isPrinting ? 'Mencetak...' : (isPrinterConnected() ? 'Cetak Struk' : 'Hubungkan Printer & Cetak')}
          </button>

          {printError && (
            <p className="text-xs text-amber-600 text-center">{printError}</p>
          )}

          {/* WhatsApp share */}
          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-600"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Bagikan via WhatsApp
          </button>

          {/* New transaction */}
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700"
          >
            Transaksi Baru
          </button>

          <p className="text-xs text-gray-400 text-center">
            Printer tidak terhubung? Klik Cetak untuk menggunakan printer default browser
          </p>
        </div>
      </div>
    </div>
  )
}
