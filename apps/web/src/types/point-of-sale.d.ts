declare module '@point-of-sale/receipt-printer-encoder' {
  interface EncoderOptions {
    columns?: number
    language?: string
    codepageMapping?: string
  }

  interface EncoderInstance {
    initialize(): EncoderInstance
    align(value: 'left' | 'center' | 'right'): EncoderInstance
    bold(value: boolean): EncoderInstance
    line(value: string): EncoderInstance
    rule(): EncoderInstance
    newline(): EncoderInstance
    encode(): Uint8Array
  }

  class ReceiptPrinterEncoder {
    constructor(options?: EncoderOptions)
    initialize(): EncoderInstance
    align(value: 'left' | 'center' | 'right'): EncoderInstance
    bold(value: boolean): EncoderInstance
    line(value: string): EncoderInstance
    rule(): EncoderInstance
    newline(): EncoderInstance
    encode(): Uint8Array
  }

  export default ReceiptPrinterEncoder
}

declare module '@point-of-sale/webserial-receipt-printer' {
  interface PrinterOptions {
    baudRate?: number
  }

  class WebSerialReceiptPrinter {
    constructor(options?: PrinterOptions)
    connect(): Promise<void>
    disconnect(): Promise<void>
    print(data: Uint8Array): Promise<void>
  }

  export default WebSerialReceiptPrinter
}
