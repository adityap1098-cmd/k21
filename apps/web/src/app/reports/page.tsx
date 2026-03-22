'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Card, Badge, MetricCard } from '@/components/ui'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { apiGet, api } from '@/lib/api'
import { Download, TrendingUp, TrendingDown, Loader2, FileSpreadsheet } from 'lucide-react'

/* ─── Types ─── */

type ReportTab = 'pnl' | 'balance' | 'cashflow'

interface PnlLineItem { code: string; name: string; amount: number }
interface PnlReport { revenue: PnlLineItem[]; expenses: PnlLineItem[]; netIncome: number }
interface BalanceItem { code: string; name: string; balance: number }
interface BalanceReport {
  assets: BalanceItem[]; liabilities: BalanceItem[]; equity: BalanceItem[]
  totalAssets: number; totalLiabilitiesAndEquity: number; isBalanced: boolean
}
interface CashFlowItem { sourceType: string; netFlow: number }
interface CashFlowReport { operating: CashFlowItem[]; totalNetFlow: number }

type ReportData = PnlReport | BalanceReport | CashFlowReport | null

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'pnl',       label: 'Laba Rugi' },
  { id: 'balance',   label: 'Neraca'    },
  { id: 'cashflow',  label: 'Arus Kas'  },
]

const SOURCE_LABELS: Record<string, string> = {
  POS_SALE:          'Penjualan POS',
  MARKETPLACE_SALE:  'Penjualan Marketplace',
  PURCHASE:          'Pembelian Barang',
  SUPPLIER_PAYMENT:  'Pembayaran Supplier',
  PAYROLL:           'Gaji Karyawan',
  VOID:              'Void / Pembatalan',
  SERVICE_COMPLETION:'Pendapatan Jasa',
  CASH_RECEIPT:      'Penerimaan Kas',
}

function formatRp(amount: number): string {
  return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ─── Export HTML Generator ─────────────────────────────────────────────── */

function generatePrintHTML(
  tab: ReportTab,
  data: ReportData,
  startDate: Date,
  endDate: Date,
): string {
  const now = new Date()
  const printedAt = now.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' WIB'

  const periodLabel = tab === 'balance'
    ? `Per tanggal ${fmtDate(endDate)}`
    : `Periode ${fmtDate(startDate)} s/d ${fmtDate(endDate)}`

  const tabTitles: Record<ReportTab, string> = {
    pnl:      'LAPORAN LABA RUGI',
    balance:  'NERACA (BALANCE SHEET)',
    cashflow: 'LAPORAN ARUS KAS',
  }

  /* ── P&L body ── */
  function buildPnl(d: PnlReport): string {
    const totalRev  = d.revenue.reduce((s, r) => s + r.amount, 0)
    const totalExp  = d.expenses.reduce((s, r) => s + r.amount, 0)
    const net       = d.netIncome
    const isProfit  = net >= 0

    const revRows = d.revenue.map(r => `
      <tr>
        <td class="code">${r.code}</td>
        <td>${r.name}</td>
        <td class="amount">${formatRp(r.amount)}</td>
      </tr>`).join('')

    const expRows = d.expenses.map(e => `
      <tr>
        <td class="code">${e.code}</td>
        <td>${e.name}</td>
        <td class="amount">${formatRp(e.amount)}</td>
      </tr>`).join('')

    return `
      <section>
        <div class="section-title green">I. PENDAPATAN</div>
        <table>
          <thead><tr><th class="th-code">Kode</th><th>Keterangan</th><th class="th-amount">Jumlah</th></tr></thead>
          <tbody>
            ${revRows || '<tr><td colspan="3" class="empty">Tidak ada data pendapatan</td></tr>'}
            <tr class="subtotal">
              <td colspan="2">Total Pendapatan</td>
              <td class="amount">${formatRp(totalRev)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <div class="section-title red">II. BEBAN USAHA</div>
        <table>
          <thead><tr><th class="th-code">Kode</th><th>Keterangan</th><th class="th-amount">Jumlah</th></tr></thead>
          <tbody>
            ${expRows || '<tr><td colspan="3" class="empty">Tidak ada data beban</td></tr>'}
            <tr class="subtotal">
              <td colspan="2">Total Beban</td>
              <td class="amount">${formatRp(totalExp)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="net-box ${isProfit ? 'profit' : 'loss'}">
        <div class="net-label">${isProfit ? 'LABA BERSIH' : 'RUGI BERSIH'}</div>
        <div class="net-amount">${formatRp(net)}</div>
      </div>

      <div class="margin-note">
        Margin Bersih: ${totalRev > 0 ? ((net / totalRev) * 100).toFixed(1) : '0.0'}%
        &nbsp;·&nbsp; Total Pendapatan: ${formatRp(totalRev)}
        &nbsp;·&nbsp; Total Beban: ${formatRp(totalExp)}
      </div>`
  }

  /* ── Balance Sheet body ── */
  function buildBalance(d: BalanceReport): string {
    const aRows = d.assets.map(a => `
      <tr><td class="code">${a.code}</td><td>${a.name}</td><td class="amount">${formatRp(a.balance)}</td></tr>
    `).join('')
    const lRows = d.liabilities.map(l => `
      <tr><td class="code">${l.code}</td><td>${l.name}</td><td class="amount">${formatRp(l.balance)}</td></tr>
    `).join('')
    const eRows = d.equity.map(e => `
      <tr><td class="code">${e.code}</td><td>${e.name}</td><td class="amount">${formatRp(e.balance)}</td></tr>
    `).join('')

    const balancedBadge = d.isBalanced
      ? `<span class="badge green">✓ Balanced</span>`
      : `<span class="badge red">✗ Unbalanced</span>`

    return `
      <section>
        <div class="section-title blue">ASET</div>
        <table>
          <thead><tr><th class="th-code">Kode</th><th>Keterangan</th><th class="th-amount">Saldo</th></tr></thead>
          <tbody>
            ${aRows || '<tr><td colspan="3" class="empty">Tidak ada aset tercatat</td></tr>'}
            <tr class="subtotal">
              <td colspan="2">Total Aset</td>
              <td class="amount">${formatRp(d.totalAssets)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <div class="section-title orange">KEWAJIBAN</div>
        <table>
          <thead><tr><th class="th-code">Kode</th><th>Keterangan</th><th class="th-amount">Saldo</th></tr></thead>
          <tbody>
            ${lRows || '<tr><td colspan="3" class="empty">Tidak ada kewajiban tercatat</td></tr>'}
          </tbody>
        </table>
      </section>

      <section>
        <div class="section-title purple">EKUITAS</div>
        <table>
          <thead><tr><th class="th-code">Kode</th><th>Keterangan</th><th class="th-amount">Saldo</th></tr></thead>
          <tbody>
            ${eRows}
          </tbody>
        </table>
      </section>

      <div class="balance-check ${d.isBalanced ? 'profit' : 'loss'}">
        <div>
          <div class="net-label">KEWAJIBAN + EKUITAS ${balancedBadge}</div>
          <div class="balance-sub">Total Aset = Kewajiban + Ekuitas</div>
        </div>
        <div class="net-amount">${formatRp(d.totalLiabilitiesAndEquity)}</div>
      </div>`
  }

  /* ── Cash Flow body ── */
  function buildCashFlow(d: CashFlowReport): string {
    const rows = d.operating.map(f => {
      const label = SOURCE_LABELS[f.sourceType] ?? f.sourceType.replace(/_/g, ' ')
      const isPos = f.netFlow >= 0
      return `
        <tr>
          <td>${label}</td>
          <td class="amount ${isPos ? 'green-text' : 'red-text'}">
            ${isPos ? '+' : '-'}${formatRp(f.netFlow)}
          </td>
        </tr>`
    }).join('')

    const isPos = d.totalNetFlow >= 0
    return `
      <section>
        <div class="section-title blue">AKTIVITAS OPERASIONAL</div>
        <table>
          <thead><tr><th>Sumber / Penggunaan Kas</th><th class="th-amount">Arus Kas</th></tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="2" class="empty">Tidak ada aktivitas kas</td></tr>'}
          </tbody>
        </table>
      </section>

      <div class="net-box ${isPos ? 'profit' : 'loss'}">
        <div class="net-label">NET ARUS KAS BERSIH</div>
        <div class="net-amount">${isPos ? '+' : '-'}${formatRp(d.totalNetFlow)}</div>
      </div>`
  }

  let body = '<p class="empty">Data tidak tersedia</p>'
  if (data) {
    if (tab === 'pnl')      body = buildPnl(data as PnlReport)
    if (tab === 'balance')  body = buildBalance(data as BalanceReport)
    if (tab === 'cashflow') body = buildCashFlow(data as CashFlowReport)
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${tabTitles[tab]} — Teladan27 Motor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #fff;
      padding: 32px 40px;
      max-width: 860px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .letterhead {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 16px;
      border-bottom: 3px solid #1a1a1a;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #111;
    }
    .company-sub {
      font-size: 11px;
      color: #555;
      margin-top: 3px;
      line-height: 1.5;
    }
    .report-meta {
      text-align: right;
      font-size: 11px;
      color: #555;
      line-height: 1.6;
    }
    .report-meta strong { color: #111; }

    /* ── Title block ── */
    .report-title-block {
      text-align: center;
      margin-bottom: 24px;
      padding: 14px;
      background: #f7f7f7;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    .report-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #111;
      text-transform: uppercase;
    }
    .report-period {
      font-size: 12px;
      color: #444;
      margin-top: 4px;
    }
    .report-printed {
      font-size: 10px;
      color: #888;
      margin-top: 4px;
    }

    /* ── Sections ── */
    section { margin-bottom: 22px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 6px 10px;
      border-radius: 4px 4px 0 0;
      margin-bottom: 0;
      border-bottom: none;
    }
    .section-title.green  { background: #f0faf0; color: #166534; border-left: 3px solid #16a34a; }
    .section-title.red    { background: #fff5f5; color: #991b1b; border-left: 3px solid #dc2626; }
    .section-title.blue   { background: #eff6ff; color: #1e40af; border-left: 3px solid #3b82f6; }
    .section-title.orange { background: #fff7ed; color: #9a3412; border-left: 3px solid #f97316; }
    .section-title.purple { background: #faf5ff; color: #6b21a8; border-left: 3px solid #9333ea; }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ddd;
      border-top: none;
    }
    thead th {
      background: #f2f2f2;
      padding: 7px 10px;
      text-align: left;
      font-size: 10.5px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid #ccc;
    }
    tbody td {
      padding: 7px 10px;
      border-bottom: 1px solid #eee;
      color: #222;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #fafafa; }

    td.code, th.th-code {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: #888;
      width: 55px;
    }
    td.amount, th.th-amount {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-size: 12px;
      white-space: nowrap;
    }
    th.th-amount { text-align: right; }
    .green-text { color: #16a34a; font-weight: 600; }
    .red-text   { color: #dc2626; font-weight: 600; }

    tr.subtotal td {
      background: #f5f5f5;
      font-weight: 700;
      font-size: 12px;
      border-top: 1.5px solid #bbb;
      border-bottom: none;
      color: #111;
    }

    .empty {
      text-align: center;
      color: #aaa;
      font-style: italic;
      padding: 14px !important;
    }

    /* ── Net income / balance box ── */
    .net-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-radius: 6px;
      margin-top: 6px;
      margin-bottom: 8px;
    }
    .balance-check {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-radius: 6px;
      margin-top: 6px;
    }
    .net-box.profit, .balance-check.profit {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
    }
    .net-box.loss, .balance-check.loss {
      background: #fff1f2;
      border: 1.5px solid #fca5a5;
    }
    .net-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .balance-sub {
      font-size: 10px;
      color: #777;
      margin-top: 2px;
    }
    .net-box.profit .net-label, .balance-check.profit .net-label { color: #166534; }
    .net-box.loss   .net-label, .balance-check.loss   .net-label { color: #991b1b; }
    .net-amount {
      font-size: 18px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .net-box.profit .net-amount, .balance-check.profit .net-amount { color: #16a34a; }
    .net-box.loss   .net-amount, .balance-check.loss   .net-amount { color: #dc2626; }

    .margin-note {
      font-size: 10.5px;
      color: #666;
      text-align: right;
      margin-top: 4px;
    }

    /* ── Badges ── */
    .badge {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge.green { background: #dcfce7; color: #166534; }
    .badge.red   { background: #fee2e2; color: #991b1b; }

    /* ── Footer ── */
    .footer {
      margin-top: 40px;
      padding-top: 14px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #aaa;
    }

    /* ── Print ── */
    @media print {
      body { padding: 20px 28px; }
      @page { margin: 16mm 14mm; size: A4; }
      .net-box, .balance-check { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section-title            { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead th, tr.subtotal td  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div>
      <div class="company-name">Teladan27 Motor</div>
      <div class="company-sub">
        Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara<br>
        Kota Bandung, Jawa Barat&nbsp;&nbsp;·&nbsp;&nbsp;Telp: +62 858-4622-2290
      </div>
    </div>
    <div class="report-meta">
      <strong>${tabTitles[tab]}</strong><br>
      ${periodLabel}<br>
      Dicetak: ${printedAt}
    </div>
  </div>

  <!-- Title Block -->
  <div class="report-title-block">
    <div class="report-title">${tabTitles[tab]}</div>
    <div class="report-period">${periodLabel}</div>
    <div class="report-printed">Dicetak pada ${printedAt}</div>
  </div>

  <!-- Content -->
  ${body}

  <!-- Footer -->
  <div class="footer">
    <span>Teladan27 Motor — Sistem ERP v1.0</span>
    <span>Dokumen ini digenerate secara otomatis oleh sistem</span>
    <span>${printedAt}</span>
  </div>

</body>
</html>`
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function ReportsPage() {
  const [activeTab, setActiveTab]     = useState<ReportTab>('pnl')
  const [startDate, setStartDate]     = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  })
  const [endDate, setEndDate]         = useState(() => new Date())
  const [reportData, setReportData]   = useState<ReportData>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExportExcel() {
    setIsExporting(true)
    setExportError(null)
    try {
      const start = startDate.toISOString()
      const end   = endDate.toISOString()

      // 1. Ambil data dari Express langsung — api() otomatis tambah Authorization: Bearer
      const exportData = await api<unknown>(
        `/api/v1/accounting/reports/export-data?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`
      )
      if (!exportData.success) {
        throw new Error(exportData.error ?? 'Gagal mengambil data laporan')
      }

      // 2. Kirim data ke Next.js API route untuk generate Excel via Python
      const res = await fetch('/api/reports/generate-excel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ startDate: start, endDate: end, ...exportData }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      // 3. Trigger browser download
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      a.href      = url
      const cd    = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download  = match ? match[1] : 'laporan.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Gagal export')
    } finally {
      setIsExporting(false)
    }
  }

  function handleExportPdf() {
    if (!reportData) return
    const html = generatePrintHTML(activeTab, reportData, startDate, endDate)
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Laporan Keuangan"
        subtitle="Profit & Loss, Balance Sheet, Cash Flow"
        actions={
          <div className="flex items-center gap-2">
            {exportError && (
              <span className="text-xs text-danger">{exportError}</span>
            )}
            <Button
              variant="secondary"
              icon={<FileSpreadsheet size={15} />}
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              {isExporting ? 'Mengexport...' : 'Export Excel'}
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={handleExportPdf}
              disabled={!reportData}
            >
              Export PDF
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setReportData(null) }}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 animate-in stagger-3 relative z-[100]">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); setReportData(null) }}
        />
      </div>

      {activeTab === 'pnl' && (
        <PnlView
          startDate={startDate}
          endDate={endDate}
          onDataLoaded={setReportData}
        />
      )}
      {activeTab === 'balance' && (
        <BalanceView
          endDate={endDate}
          onDataLoaded={setReportData}
        />
      )}
      {activeTab === 'cashflow' && (
        <CashFlowView
          startDate={startDate}
          endDate={endDate}
          onDataLoaded={setReportData}
        />
      )}
    </DashboardLayout>
  )
}

/* ─── P&L View ─────────────────────────────────────────────────────────── */

function PnlView({
  startDate, endDate, onDataLoaded,
}: {
  startDate: Date; endDate: Date; onDataLoaded: (d: ReportData) => void
}) {
  const [data, setData]       = useState<PnlReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<PnlReport>(
      `/api/v1/accounting/reports/pnl?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    )
    if (res.success && res.data) { setData(res.data); onDataLoaded(res.data) }
    setLoading(false)
  }, [startDate, endDate, onDataLoaded])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data)   return <ErrorState />

  const totalRevenue  = data.revenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex flex-col gap-4 animate-in stagger-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Pendapatan" value={formatRp(totalRevenue)}  trend="up"   valueColor="text-success" />
        <MetricCard label="Total Beban"      value={formatRp(totalExpenses)} trend="down" valueColor="text-danger" />
        <MetricCard
          label="Laba Bersih"
          value={formatRp(data.netIncome)}
          trend={data.netIncome >= 0 ? 'up' : 'down'}
          valueColor={data.netIncome >= 0 ? 'text-success' : 'text-danger'}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <TrendingUp size={16} className="text-success" /> Pendapatan
          </h3>
          <span className="text-sm font-bold text-success tabular-nums">{formatRp(totalRevenue)}</span>
        </div>
        {data.revenue.length === 0
          ? <p className="text-sm text-ink-muted py-3 text-center">Tidak ada data pendapatan</p>
          : data.revenue.map(item => (
            <div key={item.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[60px]">{item.code}</span>
              <span className="text-[13px] text-ink flex-1">{item.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(item.amount)}</span>
            </div>
          ))
        }
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <TrendingDown size={16} className="text-danger" /> Beban Usaha
          </h3>
          <span className="text-sm font-bold text-danger tabular-nums">{formatRp(totalExpenses)}</span>
        </div>
        {data.expenses.length === 0
          ? <p className="text-sm text-ink-muted py-3 text-center">Tidak ada data beban</p>
          : data.expenses.map(item => (
            <div key={item.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[60px]">{item.code}</span>
              <span className="text-[13px] text-ink flex-1">{item.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(item.amount)}</span>
            </div>
          ))
        }
      </Card>

      <div className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 ${
        data.netIncome >= 0
          ? 'bg-success/5 border-success/30'
          : 'bg-danger/5 border-danger/30'
      }`}>
        <span className="text-sm font-bold text-ink uppercase tracking-wide">
          {data.netIncome >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
        </span>
        <span className={`text-lg font-extrabold tabular-nums ${
          data.netIncome >= 0 ? 'text-success' : 'text-danger'
        }`}>
          {formatRp(data.netIncome)}
        </span>
      </div>
    </div>
  )
}

/* ─── Balance View ──────────────────────────────────────────────────────── */

function BalanceView({
  endDate, onDataLoaded,
}: {
  endDate: Date; onDataLoaded: (d: ReportData) => void
}) {
  const [data, setData]       = useState<BalanceReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<BalanceReport>(
      `/api/v1/accounting/reports/balance-sheet?asOfDate=${endDate.toISOString()}`
    )
    if (res.success && res.data) { setData(res.data); onDataLoaded(res.data) }
    setLoading(false)
  }, [endDate, onDataLoaded])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data)   return <ErrorState />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in stagger-4">
      <Card>
        <h3 className="text-sm font-semibold text-ink mb-4">Aset</h3>
        {data.assets.length === 0
          ? <p className="text-sm text-ink-muted py-3 text-center">Tidak ada aset tercatat</p>
          : data.assets.map(a => (
            <div key={a.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[50px]">{a.code}</span>
              <span className="text-[13px] text-ink flex-1">{a.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(a.balance)}</span>
            </div>
          ))
        }
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
          <span className="text-sm font-semibold text-ink">Total Aset</span>
          <span className="text-sm font-bold text-ink tabular-nums">{formatRp(data.totalAssets)}</span>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4">Kewajiban</h3>
          {data.liabilities.length === 0
            ? <p className="text-sm text-ink-muted py-3 text-center">Tidak ada kewajiban</p>
            : data.liabilities.map(l => (
              <div key={l.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
                <span className="font-mono text-xs text-ink-muted w-[50px]">{l.code}</span>
                <span className="text-[13px] text-ink flex-1">{l.name}</span>
                <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(l.balance)}</span>
              </div>
            ))
          }
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4">Ekuitas</h3>
          {data.equity.map(e => (
            <div key={e.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[50px]">{e.code}</span>
              <span className="text-[13px] text-ink flex-1">{e.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(e.balance)}</span>
            </div>
          ))}
        </Card>

        <div className={`flex items-center justify-between px-5 py-3 rounded-xl border-2 ${
          data.isBalanced
            ? 'bg-success/5 border-success/30'
            : 'bg-danger/5 border-danger/30'
        }`}>
          <span className="text-sm font-semibold text-ink">Kewajiban + Ekuitas</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink tabular-nums">
              {formatRp(data.totalLiabilitiesAndEquity)}
            </span>
            <Badge color={data.isBalanced ? 'green' : 'red'}>
              {data.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Cash Flow View ────────────────────────────────────────────────────── */

function CashFlowView({
  startDate, endDate, onDataLoaded,
}: {
  startDate: Date; endDate: Date; onDataLoaded: (d: ReportData) => void
}) {
  const [data, setData]       = useState<CashFlowReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<CashFlowReport>(
      `/api/v1/accounting/reports/cash-flow?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    )
    if (res.success && res.data) { setData(res.data); onDataLoaded(res.data) }
    setLoading(false)
  }, [startDate, endDate, onDataLoaded])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data)   return <ErrorState />

  return (
    <div className="flex flex-col gap-4 animate-in stagger-3">
      <MetricCard
        label="Net Arus Kas Bersih"
        value={`${data.totalNetFlow >= 0 ? '+' : '-'}${formatRp(data.totalNetFlow)}`}
        subtitle="Total arus kas operasional periode ini"
        trend={data.totalNetFlow >= 0 ? 'up' : 'down'}
        valueColor={data.totalNetFlow >= 0 ? 'text-success' : 'text-danger'}
      />

      <Card>
        <h3 className="text-sm font-semibold text-ink mb-4">Aktivitas Operasional</h3>
        {data.operating.length === 0
          ? <p className="text-sm text-ink-muted py-3 text-center">Tidak ada aktivitas kas</p>
          : data.operating.map(f => (
            <div key={f.sourceType} className="flex items-center py-3 border-b border-border-light last:border-0">
              <div className="flex-1">
                <span className="text-[13px] text-ink">
                  {SOURCE_LABELS[f.sourceType] || f.sourceType.replace(/_/g, ' ')}
                </span>
              </div>
              <span className={`text-[13px] font-semibold tabular-nums ${
                f.netFlow >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {f.netFlow >= 0 ? '+' : '-'}{formatRp(f.netFlow)}
              </span>
            </div>
          ))
        }
        <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-border">
          <span className="text-sm font-bold text-ink">Total Arus Kas Bersih</span>
          <span className={`text-sm font-bold tabular-nums ${
            data.totalNetFlow >= 0 ? 'text-success' : 'text-danger'
          }`}>
            {data.totalNetFlow >= 0 ? '+' : '-'}{formatRp(data.totalNetFlow)}
          </span>
        </div>
      </Card>
    </div>
  )
}

/* ─── Shared ────────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={24} className="text-ink-faint animate-spin" />
    </div>
  )
}

function ErrorState() {
  return (
    <Card className="py-12 text-center">
      <p className="text-sm text-ink-muted">Tidak dapat memuat data laporan</p>
    </Card>
  )
}
