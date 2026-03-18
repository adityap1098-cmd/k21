'use client'
import WebSerialReceiptPrinter from '@point-of-sale/webserial-receipt-printer'

let printer: WebSerialReceiptPrinter | null = null

// MUST be called from a user gesture (onClick handler) — Web Serial API requirement
export async function connectPrinter(): Promise<void> {
  printer = new WebSerialReceiptPrinter()
  await printer.connect()
}

export async function printReceipt(encodedBytes: Uint8Array): Promise<void> {
  if (!printer) throw new Error('PRINTER_NOT_CONNECTED')
  await printer.print(encodedBytes)
}

export function isPrinterConnected(): boolean {
  return printer !== null
}
