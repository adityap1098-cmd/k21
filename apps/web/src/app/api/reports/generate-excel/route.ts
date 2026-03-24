import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

/* ── Colour palette ──────────────────────────────────────────────────────── */
const C_BRAND       = 'FFE8631A'
const C_BRAND_LIGHT = 'FFFDF0E8'
const C_DARK        = 'FF1A1A1A'
const C_GREY_HEADER = 'FFF2F2F2'
const C_GREY_ALT    = 'FFFAFAFA'
const C_GREEN       = 'FF166534'
const C_GREEN_LIGHT = 'FFF0FDF4'
const C_RED         = 'FF991B1B'
const C_RED_LIGHT   = 'FFFFF1F2'
const C_BLUE        = 'FF1E40AF'
const C_PURPLE      = 'FF6B21A8'
const C_PURPLE_LIGHT= 'FFFAF5FF'
const C_ORANGE_MED  = 'FFE97316'
const C_WHITE       = 'FFFFFFFF'
const FONT_NAME     = 'Arial'

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmtRp(n: number | null | undefined): string {
  const v = Math.abs(Number(n) || 0)
  return `Rp ${v.toLocaleString('id-ID')}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    const dt = new Date(String(iso))
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()} ${String(dt.getUTCHours()).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}`
  } catch { return String(iso) }
}

function fmtPeriod(iso: string): string {
  try {
    const dt = new Date(iso)
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
    return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
  } catch { return iso }
}

type H = 'left' | 'center' | 'right'

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFCCCCCC' } }
  return { top: s, bottom: s, left: s, right: s }
}

/* ── Company header (4 rows) ─────────────────────────────────────────── */
function writeCompanyHeader(ws: ExcelJS.Worksheet, title: string, periodLabel: string, generatedAt: string, lastCol: string) {
  ws.getRow(1).height = 30
  ws.getRow(2).height = 16
  ws.getRow(3).height = 14
  ws.getRow(4).height = 20
  ws.getRow(5).height = 6

  // Row 1: Company name
  ws.mergeCells(`A1:${lastCol}1`)
  const c1 = ws.getCell('A1')
  c1.value = 'TELADAN27 MOTOR'
  c1.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: C_BRAND } }
  c1.alignment = { horizontal: 'left', vertical: 'middle' }
  c1.fill = solidFill(C_BRAND_LIGHT)

  // Row 2: Address
  ws.mergeCells(`A2:${lastCol}2`)
  const c2 = ws.getCell('A2')
  c2.value = 'Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat  |  Telp: +62 858-4622-2290'
  c2.font = { name: FONT_NAME, size: 9, color: { argb: 'FF555555' } }
  c2.alignment = { horizontal: 'left', vertical: 'middle' }
  c2.fill = solidFill(C_BRAND_LIGHT)

  // Row 3: Separator bar
  ws.mergeCells(`A3:${lastCol}3`)
  ws.getCell('A3').fill = solidFill(C_BRAND)

  // Row 4: Title + period
  ws.mergeCells('A4:D4')
  const c4a = ws.getCell('A4')
  c4a.value = title.toUpperCase()
  c4a.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: C_DARK } }
  c4a.alignment = { horizontal: 'left', vertical: 'middle' }

  ws.mergeCells(`E4:${lastCol}4`)
  const c4b = ws.getCell('E4')
  c4b.value = `${periodLabel}    |    Digenerate: ${generatedAt}`
  c4b.font = { name: FONT_NAME, size: 9, italic: true, color: { argb: 'FF666666' } }
  c4b.alignment = { horizontal: 'right', vertical: 'middle' }
}

/* ── Section title row ───────────────────────────────────────────────── */
function writeSectionTitle(ws: ExcelJS.Worksheet, row: number, label: string, colorArgb: string, mergeTo: string) {
  ws.mergeCells(`A${row}:${mergeTo}${row}`)
  const c = ws.getCell(`A${row}`)
  c.value = label
  c.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: C_WHITE } }
  c.fill = solidFill(colorArgb)
  c.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(row).height = 18
}

/* ── Table header row ────────────────────────────────────────────────── */
function writeTableHeader(ws: ExcelJS.Worksheet, row: number, cols: string[]) {
  const border = thinBorder()
  cols.forEach((label, i) => {
    const c = ws.getCell(row, i + 1)
    c.value = label
    c.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: 'FF444444' } }
    c.fill = solidFill(C_GREY_HEADER)
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = border
  })
  ws.getRow(row).height = 16
}

/* ── Data row ────────────────────────────────────────────────────────── */
function writeDataRow(
  ws: ExcelJS.Worksheet, row: number, values: (string | number)[],
  opts: { alt?: boolean; aligns?: H[]; bold?: boolean } = {}
) {
  const bg = solidFill(opts.alt ? C_GREY_ALT : C_WHITE)
  const border = thinBorder()
  values.forEach((val, i) => {
    const c = ws.getCell(row, i + 1)
    c.value = val
    c.font = { name: FONT_NAME, bold: !!opts.bold, size: 9, color: { argb: C_DARK } }
    c.fill = bg
    c.border = border
    const h = opts.aligns?.[i] ?? 'left'
    c.alignment = { horizontal: h, vertical: 'middle', wrapText: true }
  })
  ws.getRow(row).height = 15
}

/* ── Total row ───────────────────────────────────────────────────────── */
function writeTotalRow(ws: ExcelJS.Worksheet, row: number, label: string, valueStr: string, mergeEnd: number, valCol: number) {
  ws.mergeCells(row, 1, row, mergeEnd)
  const cLabel = ws.getCell(row, 1)
  cLabel.value = label
  cLabel.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: C_DARK } }
  cLabel.fill = solidFill(C_GREY_HEADER)
  cLabel.alignment = { horizontal: 'left', vertical: 'middle' }
  cLabel.border = thinBorder()

  const cVal = ws.getCell(row, valCol)
  cVal.value = valueStr
  cVal.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: C_DARK } }
  cVal.fill = solidFill(C_GREY_HEADER)
  cVal.alignment = { horizontal: 'right', vertical: 'middle' }
  cVal.border = thinBorder()
  ws.getRow(row).height = 16
}

/* ── Net box (profit/loss highlight) ─────────────────────────────────── */
function writeNetBox(ws: ExcelJS.Worksheet, row: number, label: string, valueStr: string, positive: boolean) {
  const color = positive ? C_GREEN : C_RED
  const light = positive ? C_GREEN_LIGHT : C_RED_LIGHT

  ws.mergeCells(`A${row}:D${row}`)
  const cL = ws.getCell(`A${row}`)
  cL.value = label
  cL.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: color } }
  cL.fill = solidFill(light)
  cL.alignment = { horizontal: 'left', vertical: 'middle' }
  cL.border = thinBorder()

  ws.mergeCells(`E${row}:G${row}`)
  const cR = ws.getCell(`E${row}`)
  cR.value = valueStr
  cR.font = { name: FONT_NAME, bold: true, size: 14, color: { argb: color } }
  cR.fill = solidFill(light)
  cR.alignment = { horizontal: 'right', vertical: 'middle' }
  cR.border = thinBorder()
  ws.getRow(row).height = 30
}

/* ── Set column widths ───────────────────────────────────────────────── */
function setColWidths(ws: ExcelJS.Worksheet, widths: Record<string, number>) {
  Object.entries(widths).forEach(([col, w]) => {
    ws.getColumn(col).width = w
  })
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Sheet builders                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

interface PnlItem { code: string; name: string; amount: number }
interface PnlData { revenue: PnlItem[]; expenses: PnlItem[]; netIncome: number }
interface BalItem { code: string; name: string; balance: number }
interface BalData { assets: BalItem[]; liabilities: BalItem[]; equity: BalItem[]; totalAssets: number; totalLiabilitiesAndEquity: number; isBalanced: boolean }
interface CfItem { sourceType: string; netFlow: number }
interface CfData { operating: CfItem[]; totalNetFlow: number }
interface PosRow { createdAt?: string; clientUuid?: string; itemCount?: number; subtotal?: number; discountAmount?: number; total?: number; paymentMethods?: string; itemsSummary?: string }
interface SvcRow { orderNumber?: string; platNomor?: string; brand?: string; model?: string; estimatedCost?: number; totalBayar?: number; metodeBayar?: string; paymentStatus?: string; itemsSummary?: string }
interface MechRow { mechanicName: string; totalOrders: number; completedOrders: number; inProgressOrders: number; totalRevenue: number; avgRevenue: number }

interface ExportData {
  period: { startDate: string; endDate: string }
  pnl: PnlData
  balance: BalData
  cashflow: CfData
  posTransactions: PosRow[]
  serviceTransactions: SvcRow[]
  mechanicSummary?: MechRow[]
}

const SOURCE_LABELS: Record<string, string> = {
  POS_SALE: 'Penjualan Retail', MARKETPLACE_SALE: 'Penjualan Marketplace',
  PURCHASE: 'Pembelian Barang', SUPPLIER_PAYMENT: 'Pembayaran Supplier',
  PAYROLL: 'Gaji Karyawan', VOID: 'Void / Pembatalan',
  SERVICE_COMPLETION: 'Pendapatan Jasa', CASH_RECEIPT: 'Penerimaan Kas',
}

function buildSummary(wb: ExcelJS.Workbook, data: ExportData, startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Ringkasan')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 22, B: 18, C: 18, D: 18, E: 18, F: 18, G: 18 })
  writeCompanyHeader(ws, 'Ringkasan Laporan Keuangan', `Periode ${startL} s/d ${endL}`, gen, 'G')

  const { pnl, balance: bal, cashflow: cf, posTransactions: pos, serviceTransactions: svc } = data
  const totalRev = pnl.revenue.reduce((s, r) => s + (r.amount || 0), 0)
  const totalExp = pnl.expenses.reduce((s, e) => s + (e.amount || 0), 0)

  let row = 6
  writeSectionTitle(ws, row, '  RINGKASAN EKSEKUTIF', C_BRAND, 'G'); row++
  writeTableHeader(ws, row, ['Metrik', 'Nilai', 'Keterangan', '', '', '', '']); row++

  const kpis: [string, string, string][] = [
    ['Total Pendapatan', fmtRp(totalRev), 'Seluruh sumber pendapatan'],
    ['Total Beban', fmtRp(totalExp), 'Seluruh beban usaha'],
    ['Laba / Rugi Bersih', fmtRp(pnl.netIncome), 'Laba bersih = Pendapatan - Beban'],
    ['Total Aset', fmtRp(bal.totalAssets), 'Posisi aset per akhir periode'],
    ['Kewajiban + Ekuitas', fmtRp(bal.totalLiabilitiesAndEquity), 'Harus sama dengan Total Aset'],
    ['Net Arus Kas', fmtRp(cf.totalNetFlow), 'Arus kas bersih operasional'],
    ['Jml Transaksi Retail', `${(pos || []).length} transaksi`, 'POS penjualan retail selesai'],
    ['Jml Order Jasa', `${(svc || []).length} order`, 'Total order bengkel periode ini'],
  ]
  kpis.forEach(([label, val, note], i) => {
    writeDataRow(ws, row, [label, val, note, '', '', '', ''], { alt: i % 2 === 0 }); row++
  })

  row++
  writeSectionTitle(ws, row, '  STATUS NERACA', C_BLUE, 'G'); row++
  ws.mergeCells(`A${row}:G${row}`)
  const cBal = ws.getCell(`A${row}`)
  cBal.value = `${bal.isBalanced ? '✓ NERACA SEIMBANG' : '✗ NERACA TIDAK SEIMBANG'}  —  Total Aset = ${fmtRp(bal.totalAssets)}  |  Kewajiban + Ekuitas = ${fmtRp(bal.totalLiabilitiesAndEquity)}`
  cBal.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: bal.isBalanced ? C_GREEN : C_RED } }
  cBal.fill = solidFill(bal.isBalanced ? C_GREEN_LIGHT : C_RED_LIGHT)
  cBal.alignment = { horizontal: 'left', vertical: 'middle' }
  cBal.border = thinBorder()
  ws.getRow(row).height = 22
}

function buildPnl(wb: ExcelJS.Workbook, pnl: PnlData, startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Laba Rugi')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 10, B: 30, C: 20, D: 10, E: 10, F: 10, G: 10 })
  writeCompanyHeader(ws, 'Laporan Laba Rugi (Profit & Loss)', `Periode ${startL} s/d ${endL}`, gen, 'G')

  const totalRev = pnl.revenue.reduce((s, r) => s + (r.amount || 0), 0)
  const totalExp = pnl.expenses.reduce((s, e) => s + (e.amount || 0), 0)
  let row = 6

  // Revenue
  writeSectionTitle(ws, row, '  I.  PENDAPATAN', C_GREEN, 'G'); row++
  writeTableHeader(ws, row, ['Kode', 'Keterangan', 'Jumlah', '', '', '', '']); row++
  if (pnl.revenue.length) {
    pnl.revenue.forEach((item, i) => {
      writeDataRow(ws, row, [item.code, item.name, fmtRp(item.amount), '', '', '', ''],
        { alt: i % 2 === 0, aligns: ['center', 'left', 'right', 'left', 'left', 'left', 'left'] }); row++
    })
  } else {
    ws.mergeCells(`A${row}:G${row}`)
    const c = ws.getCell(`A${row}`); c.value = '(Tidak ada data pendapatan)'; c.font = { name: FONT_NAME, italic: true, color: { argb: 'FFAAAAAA' } }; c.alignment = { horizontal: 'center' }; row++
  }
  writeTotalRow(ws, row, 'TOTAL PENDAPATAN', fmtRp(totalRev), 2, 3); row += 2

  // Expenses
  writeSectionTitle(ws, row, '  II.  BEBAN USAHA', C_RED, 'G'); row++
  writeTableHeader(ws, row, ['Kode', 'Keterangan', 'Jumlah', '', '', '', '']); row++
  if (pnl.expenses.length) {
    pnl.expenses.forEach((item, i) => {
      writeDataRow(ws, row, [item.code, item.name, fmtRp(item.amount), '', '', '', ''],
        { alt: i % 2 === 0, aligns: ['center', 'left', 'right', 'left', 'left', 'left', 'left'] }); row++
    })
  } else {
    ws.mergeCells(`A${row}:G${row}`)
    const c = ws.getCell(`A${row}`); c.value = '(Tidak ada beban)'; c.font = { name: FONT_NAME, italic: true, color: { argb: 'FFAAAAAA' } }; c.alignment = { horizontal: 'center' }; row++
  }
  writeTotalRow(ws, row, 'TOTAL BEBAN', fmtRp(totalExp), 2, 3); row += 2

  // Net
  const net = pnl.netIncome
  writeNetBox(ws, row, `  ${net >= 0 ? 'LABA' : 'RUGI'} BERSIH`, fmtRp(net), net >= 0); row += 2

  // Margin
  const margin = totalRev > 0 ? (net / totalRev * 100) : 0
  ws.mergeCells(`A${row}:G${row}`)
  const cm = ws.getCell(`A${row}`)
  cm.value = `Margin Bersih: ${margin.toFixed(1)}%    |    Pendapatan: ${fmtRp(totalRev)}    |    Beban: ${fmtRp(totalExp)}`
  cm.font = { name: FONT_NAME, size: 9, italic: true, color: { argb: 'FF777777' } }
  cm.alignment = { horizontal: 'right', vertical: 'middle' }
}

function buildBalance(wb: ExcelJS.Workbook, bal: BalData, endL: string, gen: string) {
  const ws = wb.addWorksheet('Neraca')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 10, B: 28, C: 20, D: 6, E: 10, F: 28, G: 20 })
  writeCompanyHeader(ws, 'Neraca (Balance Sheet)', `Per Tanggal ${endL}`, gen, 'G')

  let row = 6

  // Assets
  writeSectionTitle(ws, row, '  ASET', C_BLUE, 'C'); row++
  writeTableHeader(ws, row, ['Kode', 'Keterangan', 'Saldo']); row++
  if (bal.assets.length) {
    bal.assets.forEach((a, i) => {
      writeDataRow(ws, row, [a.code, a.name, fmtRp(a.balance)], { alt: i % 2 === 0, aligns: ['center', 'left', 'right'] }); row++
    })
  } else { ws.getCell(`A${row}`).value = '-'; ws.getCell(`B${row}`).value = 'Tidak ada aset'; row++ }
  writeTotalRow(ws, row, 'TOTAL ASET', fmtRp(bal.totalAssets), 2, 3); row += 2

  // Liabilities
  writeSectionTitle(ws, row, '  KEWAJIBAN', C_ORANGE_MED, 'C'); row++
  writeTableHeader(ws, row, ['Kode', 'Keterangan', 'Saldo']); row++
  if (bal.liabilities.length) {
    bal.liabilities.forEach((l, i) => {
      writeDataRow(ws, row, [l.code, l.name, fmtRp(l.balance)], { alt: i % 2 === 0, aligns: ['center', 'left', 'right'] }); row++
    })
  } else { ws.getCell(`A${row}`).value = '-'; ws.getCell(`B${row}`).value = 'Tidak ada kewajiban'; row++ }
  row++

  // Equity
  writeSectionTitle(ws, row, '  EKUITAS', C_PURPLE, 'C'); row++
  writeTableHeader(ws, row, ['Kode', 'Keterangan', 'Saldo']); row++
  bal.equity.forEach((e, i) => {
    writeDataRow(ws, row, [e.code, e.name, fmtRp(e.balance)], { alt: i % 2 === 0, aligns: ['center', 'left', 'right'] }); row++
  })
  row++
  writeTotalRow(ws, row, 'KEWAJIBAN + EKUITAS', fmtRp(bal.totalLiabilitiesAndEquity), 2, 3); row += 2

  // Balance check
  ws.mergeCells(`A${row}:C${row}`)
  const cb = ws.getCell(`A${row}`)
  cb.value = `${bal.isBalanced ? '✓ SEIMBANG' : '✗ TIDAK SEIMBANG'}  —  Aset = ${fmtRp(bal.totalAssets)}  vs  Kewajiban+Ekuitas = ${fmtRp(bal.totalLiabilitiesAndEquity)}`
  cb.font = { name: FONT_NAME, bold: true, size: 9, color: { argb: bal.isBalanced ? C_GREEN : C_RED } }
  cb.fill = solidFill(bal.isBalanced ? C_GREEN_LIGHT : C_RED_LIGHT)
  cb.alignment = { horizontal: 'center', vertical: 'middle' }
  cb.border = thinBorder()
  ws.getRow(row).height = 20
}

function buildCashFlow(wb: ExcelJS.Workbook, cf: CfData, startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Arus Kas')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 32, B: 20, C: 16, D: 16, E: 16, F: 16, G: 16 })
  writeCompanyHeader(ws, 'Laporan Arus Kas', `Periode ${startL} s/d ${endL}`, gen, 'G')

  let row = 6
  writeSectionTitle(ws, row, '  AKTIVITAS OPERASIONAL', C_BLUE, 'G'); row++
  writeTableHeader(ws, row, ['Sumber / Penggunaan Kas', 'Arus Kas', '', '', '', '', '']); row++

  cf.operating.forEach((item, i) => {
    const label = SOURCE_LABELS[item.sourceType] ?? item.sourceType.replace(/_/g, ' ')
    const net = item.netFlow
    const valStr = `${net >= 0 ? '+' : '-'}${fmtRp(net)}`
    writeDataRow(ws, row, [label, valStr, '', '', '', '', ''], { alt: i % 2 === 0, aligns: ['left', 'right', 'left', 'left', 'left', 'left', 'left'] })
    ws.getCell(row, 2).font = { name: FONT_NAME, bold: true, size: 9, color: { argb: net >= 0 ? C_GREEN : C_RED } }
    row++
  })

  row++
  const net = cf.totalNetFlow
  writeNetBox(ws, row, `  NET ARUS KAS BERSIH  (${net >= 0 ? 'Positif ↑' : 'Negatif ↓'})`, `${net >= 0 ? '+' : '-'}${fmtRp(net)}`, net >= 0)
}

function buildPosTransactions(wb: ExcelJS.Workbook, posRows: PosRow[], startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Penjualan Retail')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 12, B: 20, C: 12, D: 12, E: 16, F: 12, G: 28 })
  writeCompanyHeader(ws, 'Penjualan Retail — Detail Transaksi', `Periode ${startL} s/d ${endL}`, gen, 'G')

  let row = 6
  writeSectionTitle(ws, row, `  TOTAL ${posRows.length} TRANSAKSI`, C_BRAND, 'G'); row++
  writeTableHeader(ws, row, ['Tanggal', 'No. Transaksi', 'Item', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar']); row++

  let grandSub = 0, grandDisc = 0, grandTotal = 0
  posRows.forEach((t, i) => {
    const sub = Number(t.subtotal) || 0
    const disc = Number(t.discountAmount) || 0
    const tot = Number(t.total) || 0
    grandSub += sub; grandDisc += disc; grandTotal += tot

    writeDataRow(ws, row, [
      fmtDate(t.createdAt),
      String(t.clientUuid ?? '').slice(-12),
      String(t.itemCount ?? '?'),
      fmtRp(sub),
      disc ? fmtRp(disc) : '-',
      fmtRp(tot),
      String(t.paymentMethods || 'CASH'),
    ], { alt: i % 2 === 0, aligns: ['left', 'left', 'center', 'right', 'right', 'right', 'left'] })
    row++
  })

  row++
  writeSectionTitle(ws, row, '  REKAPITULASI TOTAL', C_DARK, 'G'); row++
  writeDataRow(ws, row, ['TOTAL', `${posRows.length} transaksi`, '', fmtRp(grandSub), fmtRp(grandDisc), fmtRp(grandTotal), ''],
    { bold: true, aligns: ['center', 'center', 'center', 'right', 'right', 'right', 'left'] })
  ws.getCell(row, 6).fill = solidFill(C_GREEN_LIGHT)
  ws.getCell(row, 6).font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C_GREEN } }
}

function buildServiceTransactions(wb: ExcelJS.Workbook, svcRows: SvcRow[], startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Penjualan Jasa')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 14, B: 14, C: 16, D: 14, E: 12, F: 16, G: 26 })
  writeCompanyHeader(ws, 'Penjualan Jasa — Detail Order Bengkel', `Periode ${startL} s/d ${endL}`, gen, 'G')

  let row = 6
  writeSectionTitle(ws, row, `  TOTAL ${svcRows.length} ORDER BENGKEL`, C_PURPLE, 'G'); row++
  writeTableHeader(ws, row, ['No. Order', 'Plat / Kendaraan', 'Estimasi', 'Total Bayar', 'Metode', 'Status', 'Items']); row++

  let grandTotal = 0
  svcRows.forEach((s, i) => {
    const paid = Number(s.totalBayar) || 0
    grandTotal += paid

    writeDataRow(ws, row, [
      String(s.orderNumber ?? ''),
      `${s.platNomor ?? ''} (${s.brand ?? ''} ${s.model ?? ''})`,
      Number(s.estimatedCost) ? fmtRp(Number(s.estimatedCost)) : '-',
      fmtRp(paid),
      String(s.metodeBayar ?? '-'),
      String(s.paymentStatus ?? ''),
      String(s.itemsSummary ?? '-'),
    ], { alt: i % 2 === 0, aligns: ['left', 'left', 'right', 'right', 'left', 'center', 'left'] })
    row++
  })

  row++
  writeSectionTitle(ws, row, '  REKAPITULASI TOTAL', C_DARK, 'G'); row++
  writeDataRow(ws, row, ['TOTAL', `${svcRows.length} order`, '', fmtRp(grandTotal), '', '', ''],
    { bold: true, aligns: ['center', 'center', 'center', 'right', 'left', 'left', 'left'] })
  ws.getCell(row, 4).fill = solidFill(C_PURPLE_LIGHT)
  ws.getCell(row, 4).font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C_PURPLE } }
}

function buildMechanicSummary(wb: ExcelJS.Workbook, mechRows: MechRow[], startL: string, endL: string, gen: string) {
  const ws = wb.addWorksheet('Rekap Mekanik')
  ws.views = [{ showGridLines: false }]
  setColWidths(ws, { A: 24, B: 14, C: 14, D: 14, E: 18, F: 18, G: 14 })
  writeCompanyHeader(ws, 'Rekap Kinerja Mekanik', `Periode ${startL} s/d ${endL}`, gen, 'G')

  let row = 6
  writeSectionTitle(ws, row, `  TOTAL ${mechRows.length} MEKANIK`, C_BLUE, 'G'); row++
  writeTableHeader(ws, row, ['Nama Mekanik', 'Total Order', 'Selesai', 'Dalam Proses', 'Total Pendapatan', 'Rata-rata / Order', 'Completion %']); row++

  let grandOrders = 0, grandCompleted = 0, grandRevenue = 0

  mechRows.forEach((m, i) => {
    const completionPct = m.totalOrders > 0 ? ((m.completedOrders / m.totalOrders) * 100).toFixed(0) + '%' : '-'
    grandOrders += m.totalOrders
    grandCompleted += m.completedOrders
    grandRevenue += m.totalRevenue

    writeDataRow(ws, row, [
      m.mechanicName,
      m.totalOrders,
      m.completedOrders,
      m.inProgressOrders,
      fmtRp(m.totalRevenue),
      fmtRp(m.avgRevenue),
      completionPct,
    ], { alt: i % 2 === 0, aligns: ['left', 'center', 'center', 'center', 'right', 'right', 'center'] })

    // Color code completion rate
    const pctNum = m.totalOrders > 0 ? (m.completedOrders / m.totalOrders) * 100 : 0
    if (pctNum >= 80) {
      ws.getCell(row, 7).font = { name: FONT_NAME, bold: true, size: 9, color: { argb: C_GREEN } }
    } else if (pctNum < 50) {
      ws.getCell(row, 7).font = { name: FONT_NAME, bold: true, size: 9, color: { argb: C_RED } }
    }
    row++
  })

  // Grand total
  row++
  writeSectionTitle(ws, row, '  REKAPITULASI TOTAL', C_DARK, 'G'); row++
  const grandCompletionPct = grandOrders > 0 ? ((grandCompleted / grandOrders) * 100).toFixed(0) + '%' : '-'
  const grandAvg = grandOrders > 0 ? Math.round(grandRevenue / grandOrders) : 0
  writeDataRow(ws, row, [
    'TOTAL SEMUA MEKANIK',
    grandOrders,
    grandCompleted,
    grandOrders - grandCompleted,
    fmtRp(grandRevenue),
    fmtRp(grandAvg),
    grandCompletionPct,
  ], { bold: true, aligns: ['left', 'center', 'center', 'center', 'right', 'right', 'center'] })
  ws.getCell(row, 5).fill = solidFill(C_GREEN_LIGHT)
  ws.getCell(row, 5).font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C_GREEN } }

  // Top performer highlight
  if (mechRows.length > 0) {
    row += 2
    const top = mechRows[0] // already sorted by totalRevenue DESC
    ws.mergeCells(`A${row}:G${row}`)
    const cTop = ws.getCell(`A${row}`)
    cTop.value = `⭐ Top Mekanik: ${top.mechanicName}  —  ${top.totalOrders} order  |  ${fmtRp(top.totalRevenue)} pendapatan  |  Completion ${top.totalOrders > 0 ? ((top.completedOrders / top.totalOrders) * 100).toFixed(0) : 0}%`
    cTop.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C_BRAND } }
    cTop.fill = solidFill(C_BRAND_LIGHT)
    cTop.alignment = { horizontal: 'left', vertical: 'middle' }
    cTop.border = thinBorder()
    ws.getRow(row).height = 24
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Route handler                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  let body: { startDate?: string; endDate?: string; success?: boolean; data?: ExportData }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data = body.data
  if (!data) {
    return NextResponse.json({ error: 'Missing data in body' }, { status: 400 })
  }

  try {
    const startL = fmtPeriod(data.period.startDate)
    const endL   = fmtPeriod(data.period.endDate)
    const gen    = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Teladan27 Motor ERP'

    buildSummary(wb, data, startL, endL, gen)
    buildPnl(wb, data.pnl, startL, endL, gen)
    buildBalance(wb, data.balance, endL, gen)
    buildCashFlow(wb, data.cashflow, startL, endL, gen)
    buildPosTransactions(wb, data.posTransactions ?? [], startL, endL, gen)
    buildServiceTransactions(wb, data.serviceTransactions ?? [], startL, endL, gen)
    buildMechanicSummary(wb, data.mechanicSummary ?? [], startL, endL, gen)

    const buffer = await wb.xlsx.writeBuffer()

    // Build filename
    const fmtFn = (iso?: string) => {
      if (!iso) return ''
      return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    }
    const filename = `Laporan_Teladan27Motor_${fmtFn(body.startDate)}_sd_${fmtFn(body.endDate)}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-excel] Error:', msg)
    return NextResponse.json({ error: `Excel generation failed: ${msg}` }, { status: 500 })
  }
}
