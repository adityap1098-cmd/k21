import { NextRequest, NextResponse } from 'next/server'
import { spawn }                    from 'child_process'
import path                         from 'path'

const API_BASE   = process.env.API_URL ?? 'http://localhost:3004'
const SCRIPT_DIR = path.join(process.cwd(), 'scripts')

/**
 * GET /api/reports/export?startDate=ISO&endDate=ISO
 * Fetches all report data from the Express API, pipes it to the Python
 * Excel generator, and returns the .xlsx file as a download.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  // Forward the Authorization: Bearer <token> header from the browser request
  const authHeader = req.headers.get('authorization') ?? ''

  // ── 1. Fetch all export data from Express API ──────────────────────────
  let apiRes: Response
  try {
    apiRes = await fetch(
      `${API_BASE}/api/v1/accounting/reports/export-data?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        cache: 'no-store',
      }
    )
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[export] Network error reaching Express API:', msg)
    return NextResponse.json(
      { error: `Tidak dapat terhubung ke API server (${API_BASE}): ${msg}` },
      { status: 502 }
    )
  }

  if (!apiRes.ok) {
    const txt = await apiRes.text()
    console.error('[export] API error:', apiRes.status, txt)
    // Coba parse JSON error dari Express
    let detail = txt
    try { detail = (JSON.parse(txt) as { error?: string }).error ?? txt } catch { /* raw text */ }
    return NextResponse.json(
      { error: `API error ${apiRes.status}: ${detail}` },
      { status: apiRes.status }
    )
  }

  const payload = await apiRes.json() as { success: boolean; data: unknown; error: string | null }
  if (!payload.success) {
    return NextResponse.json({ error: payload.error ?? 'API error' }, { status: 500 })
  }

  // ── 2. Pipe data to Python script, collect stdout ──────────────────────
  const xlsxBuffer = await new Promise<Buffer>((resolve, reject) => {
    const py = spawn('python3', [path.join(SCRIPT_DIR, 'generate_excel_report.py')])

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    py.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    py.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

    py.on('close', (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString()
        reject(new Error(`Python exited ${code}: ${errMsg}`))
      } else {
        resolve(Buffer.concat(chunks))
      }
    })

    py.on('error', reject)

    // Write data to Python stdin
    py.stdin.write(JSON.stringify(payload))
    py.stdin.end()
  })

  // ── 3. Return as downloadable .xlsx ────────────────────────────────────
  const startStr = new Date(startDate).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).replace(/\//g, '-')
  const endStr   = new Date(endDate).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).replace(/\//g, '-')
  const filename = `Laporan_Teladan27Motor_${startStr}_sd_${endStr}.xlsx`

  return new NextResponse(xlsxBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(xlsxBuffer.byteLength),
    },
  })
}
