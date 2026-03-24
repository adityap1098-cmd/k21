import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'

export interface ReceiptData {
  storeName: string
  storeAddress: string
  storePhone: string
  transactionId: string
  dateTime: string
  cashierName: string
  shiftId: string
  customerName?: string
  items: Array<{
    name: string
    qty: number
    unit?: string
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

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

export function encodeReceipt(data: ReceiptData, width: 58 | 80 = 80): Uint8Array {
  const cols = width === 58 ? 32 : 48
  const encoder = new ReceiptPrinterEncoder({ columns: cols })
  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  let enc = encoder
    .initialize()
    .align('center')
    .bold(true).line(data.storeName).bold(false)
    .line(data.storeAddress)
    .line(`No. Telp ${data.storePhone}`)
    .rule()
    .align('left')

  // Date & cashier row
  enc = enc.line(`${data.dateTime}`)
  enc = enc.line(`Kasir: ${data.cashierName}`)
  if (data.customerName) {
    enc = enc.line(`Pelanggan: ${data.customerName}`)
  }
  enc = enc.line(`No. ${data.transactionId.slice(0, 12)}`)
  enc = enc.rule()

  // Items — numbered
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    const unit = item.unit || ''
    enc = enc
      .bold(true).line(`${i + 1}. ${item.name}`).bold(false)
      .line(`  ${item.qty}${unit ? ' ' + unit : ''} x ${formatRp(item.unitPrice)}${' '.repeat(Math.max(1, cols - 6 - `${item.qty}${unit ? ' ' + unit : ''} x ${formatRp(item.unitPrice)}`.length - formatRp(item.lineTotal).length))}${formatRp(item.lineTotal)}`)
    if (item.discountAmount > 0) {
      enc = enc.line(`  Diskon: -${formatRp(item.discountAmount)}`)
    }
  }

  enc = enc.rule()

  // Totals
  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)
  enc = enc.line(`Total QTY : ${totalQty}`)
  enc = enc.newline()
  enc = enc.line(`Sub Total${' '.repeat(Math.max(1, cols - 9 - formatRp(data.subtotal).length))}${formatRp(data.subtotal)}`)

  if (data.transactionDiscount > 0) {
    enc = enc.line(`Diskon${' '.repeat(Math.max(1, cols - 6 - (`-${formatRp(data.transactionDiscount)}`).length))}-${formatRp(data.transactionDiscount)}`)
  }

  enc = enc
    .bold(true)
    .line(`Total${' '.repeat(Math.max(1, cols - 5 - formatRp(data.total).length))}${formatRp(data.total)}`)
    .bold(false)

  // Payments
  for (const p of data.payments) {
    const label = `Bayar (${METHOD_LABEL[p.method] || p.method})${p.reference ? ` ${p.reference}` : ''}`
    enc = enc.line(`${label}${' '.repeat(Math.max(1, cols - label.length - formatRp(p.amount).length))}${formatRp(p.amount)}`)
  }

  enc = enc.line(`Kembali${' '.repeat(Math.max(1, cols - 7 - formatRp(data.changeDue).length))}${formatRp(data.changeDue)}`)

  // Footer
  enc = enc
    .newline()
    .align('center')
    .line('Terimakasih Telah Berbelanja')
    .newline()
    .newline()
    .newline()

  return enc.encode()
}
