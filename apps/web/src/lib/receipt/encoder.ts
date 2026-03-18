import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'

export interface ReceiptData {
  storeName: string
  transactionId: string
  dateTime: string
  cashierName: string
  shiftId: string
  items: Array<{
    name: string
    qty: number
    unitPrice: number
    discountAmount: number
    lineTotal: number
  }>
  subtotal: number
  transactionDiscount: number
  total: number
  payments: Array<{ method: 'CASH' | 'TRANSFER' | 'QRIS'; amount: number; reference?: string }>
  changeDue: number
}

export function encodeReceipt(data: ReceiptData, width: 58 | 80 = 80): Uint8Array {
  const cols = width === 58 ? 32 : 48
  const encoder = new ReceiptPrinterEncoder({ columns: cols })
  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  let enc = encoder
    .initialize()
    .align('center')
    .bold(true).line(data.storeName).bold(false)
    .line(`#${data.transactionId.slice(0, 8)}`)
    .line(data.dateTime)
    .line(`Kasir: ${data.cashierName}`)
    .rule()
    .align('left')

  for (const item of data.items) {
    enc = enc.line(`${item.name}`)
    enc = enc.line(`  ${item.qty} x ${formatRp(item.unitPrice)}  ${formatRp(item.lineTotal)}`)
    if (item.discountAmount > 0) {
      enc = enc.line(`  Diskon: -${formatRp(item.discountAmount)}`)
    }
  }

  enc = enc
    .rule()
    .line(`Subtotal: ${formatRp(data.subtotal)}`)

  if (data.transactionDiscount > 0) {
    enc = enc.line(`Diskon Transaksi: -${formatRp(data.transactionDiscount)}`)
  }

  enc = enc
    .bold(true)
    .line(`TOTAL: ${formatRp(data.total)}`)
    .bold(false)

  for (const p of data.payments) {
    enc = enc.line(`${p.method}: ${formatRp(p.amount)}${p.reference ? ` (${p.reference})` : ''}`)
  }

  if (data.changeDue > 0) {
    enc = enc.line(`Kembalian: ${formatRp(data.changeDue)}`)
  }

  enc = enc.newline().newline().newline()

  return enc.encode()
}
