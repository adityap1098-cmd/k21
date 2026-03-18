import type { ReceiptData } from './encoder'

export function buildWhatsAppUrl(data: ReceiptData): string {
  const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  const lines = [
    `*${data.storeName}*`,
    `Struk: #${data.transactionId.slice(0, 8)}`,
    data.dateTime,
    `Kasir: ${data.cashierName}`,
    '',
    ...data.items.map(i =>
      `${i.name} x${i.qty}  ${formatRp(i.lineTotal)}${i.discountAmount > 0 ? ` (-${formatRp(i.discountAmount)})` : ''}`
    ),
    '',
    `Subtotal: ${formatRp(data.subtotal)}`,
    ...(data.transactionDiscount > 0 ? [`Diskon: -${formatRp(data.transactionDiscount)}`] : []),
    `*TOTAL: ${formatRp(data.total)}*`,
    '',
    ...data.payments.map(p => `${p.method}: ${formatRp(p.amount)}`),
    ...(data.changeDue > 0 ? [`Kembalian: ${formatRp(data.changeDue)}`] : []),
  ]
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
}
