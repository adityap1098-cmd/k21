'use client'

// WebSerial receipt printer — loaded via globalThis eval trick to bypass webpack's
// static analysis of the exports field. The package only exports under the 'browser'
// condition which Next.js webpack cannot resolve at build time.

let printer: any = null

// MUST be called from a user gesture (onClick handler) — Web Serial API requires transient user activation
export async function connectPrinter(): Promise<void> {
  // Runtime-only import that webpack cannot statically analyze
  const pkgName = '@point-of-sale/webserial-receipt-printer'
  const mod = await (new Function('pkg', 'return import(pkg)'))(pkgName) as any
  const PrinterClass = mod.default || mod
  printer = new PrinterClass()
  await printer.connect()
}

export async function printReceipt(encodedBytes: Uint8Array): Promise<void> {
  if (!printer) throw new Error('PRINTER_NOT_CONNECTED')
  await printer.print(encodedBytes)
}

export function isPrinterConnected(): boolean {
  return printer !== null
}
