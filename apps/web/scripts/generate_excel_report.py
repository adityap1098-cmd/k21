"""
Teladan27 Motor — Excel Report Generator
Reads JSON report data from stdin, writes .xlsx to stdout (binary).
"""

import sys
import json
import io
from datetime import datetime, timezone

from openpyxl import Workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, numbers
)
from openpyxl.utils import get_column_letter

# ── Colour palette ────────────────────────────────────────────────────────────
C_BRAND        = "E8631A"   # Teladan27 orange
C_BRAND_LIGHT  = "FDF0E8"
C_DARK         = "1A1A1A"
C_GREY_HEADER  = "F2F2F2"
C_GREY_ROW_ALT = "FAFAFA"
C_GREEN        = "166534"
C_GREEN_LIGHT  = "F0FDF4"
C_RED          = "991B1B"
C_RED_LIGHT    = "FFF1F2"
C_BLUE         = "1E40AF"
C_BLUE_LIGHT   = "EFF6FF"
C_PURPLE       = "6B21A8"
C_PURPLE_LIGHT = "FAF5FF"
C_ORANGE_LIGHT = "FFF7ED"
C_WHITE        = "FFFFFF"

FONT_NAME = "Arial"

def fmt_rp(n):
    """Format integer as Rupiah string."""
    n = int(n or 0)
    return f"Rp {abs(n):,}".replace(",", ".")

def fmt_date(iso_str):
    """Format ISO date string to Indonesian date."""
    if not iso_str:
        return "-"
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        months = ["Jan","Feb","Mar","Apr","Mei","Jun",
                  "Jul","Agt","Sep","Okt","Nov","Des"]
        return f"{dt.day} {months[dt.month-1]} {dt.year} {dt.hour:02d}:{dt.minute:02d}"
    except Exception:
        return str(iso_str)

def font(bold=False, size=10, color=C_DARK, italic=False):
    return Font(name=FONT_NAME, bold=bold, size=size, color=color, italic=italic)

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def border_thin():
    s = Side(style="thin", color="CCCCCC")
    return Border(left=s, right=s, top=s, bottom=s)

def border_bottom_medium():
    return Border(bottom=Side(style="medium", color="AAAAAA"))

def align(h="left", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def set_col_widths(ws, widths: dict):
    for col_letter, w in widths.items():
        ws.column_dimensions[col_letter].width = w

def apply_row(ws, row_num, values, styles=None):
    """Write a row of values with optional per-cell style dict."""
    for col, val in enumerate(values, 1):
        cell = ws.cell(row=row_num, column=col, value=val)
        if styles:
            s = styles if not isinstance(styles, list) else (styles[col-1] if col-1 < len(styles) else {})
            if "font"      in s: cell.font      = s["font"]
            if "fill"      in s: cell.fill      = s["fill"]
            if "alignment" in s: cell.alignment = s["alignment"]
            if "border"    in s: cell.border    = s["border"]
            if "number_format" in s: cell.number_format = s["number_format"]

# ── Shared header writer ──────────────────────────────────────────────────────

def write_company_header(ws, title, period_label, generated_at, last_col="G"):
    """Write 4-row company letterhead block."""
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 16
    ws.row_dimensions[3].height = 14
    ws.row_dimensions[4].height = 20

    # Row 1: Company name
    ws.merge_cells(f"A1:{last_col}1")
    c = ws["A1"]
    c.value     = "TELADAN27 MOTOR"
    c.font      = Font(name=FONT_NAME, bold=True, size=16, color=C_BRAND)
    c.alignment = align("left", "center")
    c.fill      = fill(C_BRAND_LIGHT)

    # Row 2: Address
    ws.merge_cells(f"A2:{last_col}2")
    c = ws["A2"]
    c.value     = "Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat  |  Telp: +62 858-4622-2290"
    c.font      = font(size=9, color="555555")
    c.alignment = align("left", "center")
    c.fill      = fill(C_BRAND_LIGHT)

    # Row 3: Separator
    ws.merge_cells(f"A3:{last_col}3")
    c = ws["A3"]
    c.fill      = fill(C_BRAND)

    # Row 4: Report title + period + generated
    ws.merge_cells(f"A4:D4")
    c = ws["A4"]
    c.value     = title.upper()
    c.font      = Font(name=FONT_NAME, bold=True, size=12, color=C_DARK)
    c.alignment = align("left", "center")

    last_half = f"E4:{last_col}4"
    ws.merge_cells(last_half)
    c2 = ws["E4"]
    c2.value     = f"{period_label}    |    Digenerate: {generated_at}"
    c2.font      = font(size=9, color="666666", italic=True)
    c2.alignment = align("right", "center")

    # Blank spacer
    ws.row_dimensions[5].height = 6

# ── Sheet helpers ─────────────────────────────────────────────────────────────

def write_section_title(ws, row, label, color_hex, merge_to="G"):
    ws.merge_cells(f"A{row}:{merge_to}{row}")
    c = ws[f"A{row}"]
    c.value     = label
    c.font      = Font(name=FONT_NAME, bold=True, size=9, color=C_WHITE)
    c.fill      = fill(color_hex)
    c.alignment = align("left", "center")
    ws.row_dimensions[row].height = 18

def write_table_header(ws, row, cols, fills=None):
    f = fill(fills or C_GREY_HEADER)
    b = border_thin()
    for i, col_label in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=col_label)
        c.font      = Font(name=FONT_NAME, bold=True, size=9, color="444444")
        c.fill      = f
        c.alignment = align("center", "center")
        c.border    = b
    ws.row_dimensions[row].height = 16

VALID_HALIGN = {'left','center','right','general','justify','fill','centerContinuous','distributed'}

def write_data_row(ws, row, values, alt=False, alignments=None, bold=False, number_formats=None):
    bg = fill(C_GREY_ROW_ALT) if alt else fill(C_WHITE)
    b  = border_thin()
    for i, val in enumerate(values, 1):
        c = ws.cell(row=row, column=i, value=val)
        c.font      = Font(name=FONT_NAME, bold=bold, size=9, color=C_DARK)
        c.fill      = bg
        c.border    = b
        h = (alignments[i-1] if alignments and i-1 < len(alignments) else "left")
        if h not in VALID_HALIGN:
            h = "left"
        c.alignment = align(h, "center", wrap=True)
        if number_formats and i-1 < len(number_formats) and number_formats[i-1]:
            c.number_format = number_formats[i-1]
    ws.row_dimensions[row].height = 15

def write_total_row(ws, row, label, value_str, label_col=1, val_col=3, merge_label=(1,2), last_col="G"):
    ws.merge_cells(f"{get_column_letter(merge_label[0])}{row}:{get_column_letter(merge_label[1])}{row}")
    c = ws.cell(row=row, column=merge_label[0], value=label)
    c.font      = Font(name=FONT_NAME, bold=True, size=9, color=C_DARK)
    c.fill      = fill(C_GREY_HEADER)
    c.alignment = align("left", "center")
    c.border    = border_thin()

    cv = ws.cell(row=row, column=val_col, value=value_str)
    cv.font      = Font(name=FONT_NAME, bold=True, size=9, color=C_DARK)
    cv.fill      = fill(C_GREY_HEADER)
    cv.alignment = align("right", "center")
    cv.border    = border_thin()
    ws.row_dimensions[row].height = 16

def write_net_box(ws, row, label, value_str, is_positive, merge_end="G"):
    color = C_GREEN if is_positive else C_RED
    light = C_GREEN_LIGHT if is_positive else C_RED_LIGHT
    ws.merge_cells(f"A{row}:D{row}")
    c = ws[f"A{row}"]
    c.value     = label
    c.font      = Font(name=FONT_NAME, bold=True, size=11, color=color)
    c.fill      = fill(light)
    c.alignment = align("left", "center")
    c.border    = border_thin()

    ws.merge_cells(f"E{row}:{merge_end}{row}")
    cv = ws[f"E{row}"]
    cv.value     = value_str
    cv.font      = Font(name=FONT_NAME, bold=True, size=14, color=color)
    cv.fill      = fill(light)
    cv.alignment = align("right", "center")
    cv.border    = border_thin()
    ws.row_dimensions[row].height = 30

# ═════════════════════════════════════════════════════════════════════════════
# Sheet builders
# ═════════════════════════════════════════════════════════════════════════════

def build_summary(wb, data, start_label, end_label, generated_at):
    ws = wb.create_sheet("Ringkasan")
    ws.sheet_view.showGridLines = False

    write_company_header(ws, "RINGKASAN LAPORAN KEUANGAN",
                         f"Periode {start_label} s/d {end_label}", generated_at, "G")

    set_col_widths(ws, {
        "A":22,"B":18,"C":18,"D":18,"E":18,"F":18,"G":18
    })

    pnl  = data["pnl"]
    bal  = data["balance"]
    cf   = data["cashflow"]
    pos  = data.get("posTransactions", [])
    svc  = data.get("serviceTransactions", [])

    total_rev  = sum(r["amount"] for r in pnl["revenue"])
    total_exp  = sum(e["amount"] for e in pnl["expenses"])
    net_income = pnl["netIncome"]

    row = 6
    write_section_title(ws, row, "  RINGKASAN EKSEKUTIF", C_BRAND, "G"); row += 1

    kpi_headers = ["Metrik", "Nilai", "Keterangan"]
    write_table_header(ws, row, kpi_headers + ["","","",""]); row += 1

    kpis = [
        ("Total Pendapatan",        fmt_rp(total_rev),       "Seluruh sumber pendapatan"),
        ("Total Beban",             fmt_rp(total_exp),       "Seluruh beban usaha"),
        ("Laba / Rugi Bersih",      fmt_rp(net_income),      "Laba bersih = Pendapatan - Beban"),
        ("Total Aset",              fmt_rp(bal["totalAssets"]), "Posisi aset per akhir periode"),
        ("Kewajiban + Ekuitas",     fmt_rp(bal["totalLiabilitiesAndEquity"]), "Harus sama dengan Total Aset"),
        ("Net Arus Kas",            fmt_rp(cf["totalNetFlow"]),  "Arus kas bersih operasional"),
        ("Jml Transaksi Retail",    f"{len(pos)} transaksi",  "POS penjualan retail selesai"),
        ("Jml Order Jasa",          f"{len(svc)} order",      "Total order bengkel periode ini"),
    ]
    for i, (label, val, note) in enumerate(kpis):
        cells = [label, val, note, "", "", "", ""]
        write_data_row(ws, row, cells, alt=(i % 2 == 0)); row += 1

    row += 1
    write_section_title(ws, row, "  STATUS NERACA", C_BLUE, "G"); row += 1
    is_balanced = bal["isBalanced"]
    ws.merge_cells(f"A{row}:G{row}")
    c = ws[f"A{row}"]
    c.value     = f"{'✓ NERACA SEIMBANG' if is_balanced else '✗ NERACA TIDAK SEIMBANG'}  —  Total Aset = {fmt_rp(bal['totalAssets'])}  |  Kewajiban + Ekuitas = {fmt_rp(bal['totalLiabilitiesAndEquity'])}"
    c.font      = Font(name=FONT_NAME, bold=True, size=10,
                       color=C_GREEN if is_balanced else C_RED)
    c.fill      = fill(C_GREEN_LIGHT if is_balanced else C_RED_LIGHT)
    c.alignment = align("left","center")
    c.border    = border_thin()
    ws.row_dimensions[row].height = 22


def build_pnl(wb, pnl, start_label, end_label, generated_at):
    ws = wb.create_sheet("Laba Rugi")
    ws.sheet_view.showGridLines = False
    set_col_widths(ws, {"A":10,"B":30,"C":20,"D":10,"E":10,"F":10,"G":10})

    write_company_header(ws, "LAPORAN LABA RUGI (PROFIT & LOSS)",
                         f"Periode {start_label} s/d {end_label}", generated_at)

    row = 6
    total_rev = sum(r["amount"] for r in pnl["revenue"])
    total_exp = sum(e["amount"] for e in pnl["expenses"])

    # ── Pendapatan ──
    write_section_title(ws, row, "  I.  PENDAPATAN", C_GREEN, "G"); row += 1
    write_table_header(ws, row, ["Kode","Keterangan","Jumlah","","","",""]); row += 1

    if pnl["revenue"]:
        for i, item in enumerate(pnl["revenue"]):
            write_data_row(ws, row, [item["code"], item["name"], fmt_rp(item["amount"]),"","","",""],
                           alt=(i%2==0),
                           alignments=["center","left","right","","","",""])
            row += 1
    else:
        ws.merge_cells(f"A{row}:G{row}")
        ws[f"A{row}"].value = "(Tidak ada data pendapatan pada periode ini)"
        ws[f"A{row}"].font  = font(italic=True, color="AAAAAA")
        ws[f"A{row}"].alignment = align("center","center")
        row += 1

    write_total_row(ws, row, "TOTAL PENDAPATAN", fmt_rp(total_rev), merge_label=(1,2), val_col=3)
    row += 2

    # ── Beban ──
    write_section_title(ws, row, "  II.  BEBAN USAHA", C_RED, "G"); row += 1
    write_table_header(ws, row, ["Kode","Keterangan","Jumlah","","","",""]); row += 1

    if pnl["expenses"]:
        for i, item in enumerate(pnl["expenses"]):
            write_data_row(ws, row, [item["code"], item["name"], fmt_rp(item["amount"]),"","","",""],
                           alt=(i%2==0),
                           alignments=["center","left","right","","","",""])
            row += 1
    else:
        ws.merge_cells(f"A{row}:G{row}")
        ws[f"A{row}"].value = "(Tidak ada beban pada periode ini)"
        ws[f"A{row}"].font  = font(italic=True, color="AAAAAA")
        ws[f"A{row}"].alignment = align("center","center")
        row += 1

    write_total_row(ws, row, "TOTAL BEBAN", fmt_rp(total_exp), merge_label=(1,2), val_col=3)
    row += 2

    # ── Net ──
    net = pnl["netIncome"]
    write_net_box(ws, row,
                  f"  {'LABA' if net >= 0 else 'RUGI'} BERSIH",
                  fmt_rp(net), net >= 0)
    row += 2

    # ── Margin note ──
    margin = (net / total_rev * 100) if total_rev else 0
    ws.merge_cells(f"A{row}:G{row}")
    c = ws[f"A{row}"]
    c.value     = f"Margin Bersih: {margin:.1f}%    |    Pendapatan: {fmt_rp(total_rev)}    |    Beban: {fmt_rp(total_exp)}"
    c.font      = font(size=9, color="777777", italic=True)
    c.alignment = align("right","center")


def build_balance(wb, bal, end_label, generated_at):
    ws = wb.create_sheet("Neraca")
    ws.sheet_view.showGridLines = False
    set_col_widths(ws, {"A":10,"B":28,"C":20,"D":6,"E":10,"F":28,"G":20})

    write_company_header(ws, "NERACA (BALANCE SHEET)",
                         f"Per Tanggal {end_label}", generated_at)

    row = 6

    # ── Aset ──
    write_section_title(ws, row, "  ASET", C_BLUE, "C"); row += 1
    write_table_header(ws, row, ["Kode","Keterangan","Saldo"]); row += 1
    if bal["assets"]:
        for i, a in enumerate(bal["assets"]):
            write_data_row(ws, row, [a["code"], a["name"], fmt_rp(a["balance"])],
                           alt=(i%2==0), alignments=["center","left","right"]); row += 1
    else:
        ws[f"A{row}"].value = "-"; ws[f"B{row}"].value = "Tidak ada aset"; row += 1

    write_total_row(ws, row, "TOTAL ASET", fmt_rp(bal["totalAssets"]),
                    merge_label=(1,2), val_col=3); row += 2

    # ── Kewajiban ──
    write_section_title(ws, row, "  KEWAJIBAN", "E97316", "C"); row += 1
    write_table_header(ws, row, ["Kode","Keterangan","Saldo"]); row += 1
    if bal["liabilities"]:
        for i, l in enumerate(bal["liabilities"]):
            write_data_row(ws, row, [l["code"], l["name"], fmt_rp(l["balance"])],
                           alt=(i%2==0), alignments=["center","left","right"]); row += 1
    else:
        ws[f"A{row}"].value = "-"; ws[f"B{row}"].value = "Tidak ada kewajiban"; row += 1
    row += 1

    # ── Ekuitas ──
    write_section_title(ws, row, "  EKUITAS", C_PURPLE, "C"); row += 1
    write_table_header(ws, row, ["Kode","Keterangan","Saldo"]); row += 1
    for i, e in enumerate(bal["equity"]):
        write_data_row(ws, row, [e["code"], e["name"], fmt_rp(e["balance"])],
                       alt=(i%2==0), alignments=["center","left","right"]); row += 1
    row += 1

    total_le = bal["totalLiabilitiesAndEquity"]
    write_total_row(ws, row, "KEWAJIBAN + EKUITAS", fmt_rp(total_le),
                    merge_label=(1,2), val_col=3); row += 2

    is_bal = bal["isBalanced"]
    ws.merge_cells(f"A{row}:C{row}")
    c = ws[f"A{row}"]
    c.value     = f"{'✓ SEIMBANG' if is_bal else '✗ TIDAK SEIMBANG'}  —  Aset = {fmt_rp(bal['totalAssets'])}  vs  Kewajiban+Ekuitas = {fmt_rp(total_le)}"
    c.font      = Font(name=FONT_NAME, bold=True, size=9,
                       color=C_GREEN if is_bal else C_RED)
    c.fill      = fill(C_GREEN_LIGHT if is_bal else C_RED_LIGHT)
    c.alignment = align("center","center")
    c.border    = border_thin()
    ws.row_dimensions[row].height = 20


def build_cashflow(wb, cf, start_label, end_label, generated_at):
    SOURCE_LABELS = {
        "POS_SALE":"Penjualan Retail","MARKETPLACE_SALE":"Penjualan Marketplace",
        "PURCHASE":"Pembelian Barang","SUPPLIER_PAYMENT":"Pembayaran Supplier",
        "PAYROLL":"Gaji Karyawan","VOID":"Void / Pembatalan",
        "SERVICE_COMPLETION":"Pendapatan Jasa","CASH_RECEIPT":"Penerimaan Kas",
    }
    ws = wb.create_sheet("Arus Kas")
    ws.sheet_view.showGridLines = False
    set_col_widths(ws, {"A":32,"B":20,"C":16,"D":16,"E":16,"F":16,"G":16})

    write_company_header(ws, "LAPORAN ARUS KAS",
                         f"Periode {start_label} s/d {end_label}", generated_at)

    row = 6
    write_section_title(ws, row, "  AKTIVITAS OPERASIONAL", C_BLUE, "G"); row += 1
    write_table_header(ws, row, ["Sumber / Penggunaan Kas","Arus Kas","","","","",""]); row += 1

    for i, item in enumerate(cf["operating"]):
        label = SOURCE_LABELS.get(item["sourceType"], item["sourceType"].replace("_"," "))
        net   = item["netFlow"]
        val_str = f"{'+'if net>=0 else '-'}{fmt_rp(net)}"
        color   = C_GREEN if net >= 0 else C_RED
        r = row
        write_data_row(ws, r, [label, val_str,"","","","",""],
                       alt=(i%2==0), alignments=["left","right","","","","",""])
        ws.cell(r, 2).font = Font(name=FONT_NAME, bold=True, size=9, color=color)
        row += 1

    row += 1
    net = cf["totalNetFlow"]
    write_net_box(ws, row,
                  f"  NET ARUS KAS BERSIH  ({'Positif ↑' if net>=0 else 'Negatif ↓'})",
                  f"{'+'if net>=0 else '-'}{fmt_rp(net)}", net >= 0)


def build_pos_transactions(wb, pos_rows, start_label, end_label, generated_at):
    ws = wb.create_sheet("Penjualan Retail")
    ws.sheet_view.showGridLines = False
    set_col_widths(ws, {
        "A":12,"B":20,"C":12,"D":12,"E":16,"F":12,"G":28
    })

    write_company_header(ws, "PENJUALAN RETAIL — DETAIL TRANSAKSI",
                         f"Periode {start_label} s/d {end_label}", generated_at)

    row = 6
    write_section_title(ws, row, f"  TOTAL {len(pos_rows)} TRANSAKSI", C_BRAND, "G"); row += 1
    headers = ["Tanggal","No. Transaksi","Item","Subtotal","Diskon","Total","Metode Bayar"]
    write_table_header(ws, row, headers); row += 1

    grand_total = 0
    grand_sub   = 0
    grand_disc  = 0

    for i, t in enumerate(pos_rows):
        sub  = int(t.get("subtotal") or 0)
        disc = int(t.get("discountAmount") or 0)
        tot  = int(t.get("total") or 0)
        grand_sub  += sub
        grand_disc += disc
        grand_total+= tot

        values = [
            fmt_date(t.get("createdAt")),
            str(t.get("clientUuid",""))[-12:],
            str(t.get("itemCount","?")),
            fmt_rp(sub),
            fmt_rp(disc) if disc else "-",
            fmt_rp(tot),
            str(t.get("paymentMethods") or "CASH"),
        ]
        write_data_row(ws, row, values, alt=(i%2==0),
                       alignments=["left","left","center","right","right","right","left"])
        row += 1

    # Grand total row
    row += 1
    write_section_title(ws, row, "  REKAPITULASI TOTAL", C_DARK, "G"); row += 1
    write_data_row(ws, row,
        ["TOTAL", f"{len(pos_rows)} transaksi", "", fmt_rp(grand_sub), fmt_rp(grand_disc), fmt_rp(grand_total), ""],
        bold=True, alignments=["center","center","center","right","right","right",""])
    ws.cell(row, 6).fill = fill(C_GREEN_LIGHT)
    ws.cell(row, 6).font = Font(name=FONT_NAME, bold=True, size=10, color=C_GREEN)


def build_service_transactions(wb, svc_rows, start_label, end_label, generated_at):
    ws = wb.create_sheet("Penjualan Jasa")
    ws.sheet_view.showGridLines = False
    set_col_widths(ws, {
        "A":14,"B":14,"C":16,"D":14,"E":12,"F":16,"G":26
    })

    write_company_header(ws, "PENJUALAN JASA — DETAIL ORDER BENGKEL",
                         f"Periode {start_label} s/d {end_label}", generated_at)

    row = 6
    write_section_title(ws, row, f"  TOTAL {len(svc_rows)} ORDER BENGKEL", C_PURPLE, "G"); row += 1
    headers = ["No. Order","Plat / Kendaraan","Estimasi","Total Bayar","Metode","Status","Items"]
    write_table_header(ws, row, headers); row += 1

    grand_total = 0
    for i, s in enumerate(svc_rows):
        est  = int(s.get("estimatedCost") or 0)
        paid = int(s.get("totalBayar") or 0)
        grand_total += paid

        values = [
            str(s.get("orderNumber","")),
            f"{s.get('platNomor','')} ({s.get('brand','')} {s.get('model','')})",
            fmt_rp(est) if est else "-",
            fmt_rp(paid),
            str(s.get("metodeBayar") or "-"),
            str(s.get("paymentStatus","")),
            str(s.get("itemsSummary") or "-"),
        ]
        write_data_row(ws, row, values, alt=(i%2==0),
                       alignments=["left","left","right","right","left","center","left"])
        row += 1

    row += 1
    write_section_title(ws, row, "  REKAPITULASI TOTAL", C_DARK, "G"); row += 1
    write_data_row(ws, row,
        ["TOTAL", f"{len(svc_rows)} order", "", fmt_rp(grand_total), "", "", ""],
        bold=True, alignments=["center","center","center","right","","",""])
    ws.cell(row, 4).fill = fill(C_PURPLE_LIGHT)
    ws.cell(row, 4).font = Font(name=FONT_NAME, bold=True, size=10, color=C_PURPLE)


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)
    data = payload["data"]

    start_iso = data["period"]["startDate"]
    end_iso   = data["period"]["endDate"]

    def fmt_period(iso):
        try:
            dt = datetime.fromisoformat(iso.replace("Z","+00:00"))
            months = ["Jan","Feb","Mar","Apr","Mei","Jun",
                      "Jul","Agt","Sep","Okt","Nov","Des"]
            return f"{dt.day} {months[dt.month-1]} {dt.year}"
        except Exception:
            return iso

    start_label  = fmt_period(start_iso)
    end_label    = fmt_period(end_iso)
    generated_at = datetime.now().strftime("%d %b %Y %H:%M WIB")

    wb = Workbook()
    wb.remove(wb.active)  # remove default sheet

    build_summary(wb, data, start_label, end_label, generated_at)
    build_pnl(wb, data["pnl"], start_label, end_label, generated_at)
    build_balance(wb, data["balance"], end_label, generated_at)
    build_cashflow(wb, data["cashflow"], start_label, end_label, generated_at)
    build_pos_transactions(wb, data.get("posTransactions",[]), start_label, end_label, generated_at)
    build_service_transactions(wb, data.get("serviceTransactions",[]), start_label, end_label, generated_at)

    buf = io.BytesIO()
    wb.save(buf)
    sys.stdout.buffer.write(buf.getvalue())


if __name__ == "__main__":
    main()
