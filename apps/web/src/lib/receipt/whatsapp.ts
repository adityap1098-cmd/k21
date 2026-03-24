import type { ReceiptData } from './encoder'

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

export function buildWhatsAppUrl(data: ReceiptData): string {
  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)

  const lines = [
    `*${data.storeName}*`,
    data.storeAddress,
    `Telp: ${data.storePhone}`,
    '─────────────────',
    `${data.dateTime}`,
    `Kasir: ${data.cashierName}`,
    ...(data.customerName ? [`Pelanggan: ${data.customerName}`] : []),
    `No. ${data.transactionId.slice(0, 12)}`,
    '─────────────────',
    '',
    ...data.items.flatMap((i, idx) => {
      const lines = [
        `*${idx + 1}. ${i.name}*`,
        `   ${i.qty}${i.unit ? ' ' + i.unit : ''} x ${formatRp(i.unitPrice)}  →  ${formatRp(i.lineTotal)}`,
      ]
      if (i.discountAmount > 0) {
        lines.push(`   Diskon: -${formatRp(i.discountAmount)}`)
      }
      return lines
    }),
    '',
    '─────────────────',
    `Total QTY: ${totalQty}`,
    '',
    `Sub Total: ${formatRp(data.subtotal)}`,
    ...(data.transactionDiscount > 0 ? [`Diskon: -${formatRp(data.transactionDiscount)}`] : []),
    `*Total: ${formatRp(data.total)}*`,
    '',
    ...data.payments.map(p => `Bayar (${METHOD_LABEL[p.method] || p.method})${p.reference ? ' ' + p.reference : ''}: ${formatRp(p.amount)}`),
    `Kembali: ${formatRp(data.changeDue)}`,
    '',
    '─────────────────',
    '_Terimakasih Telah Berbelanja_',
  ]
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
}
