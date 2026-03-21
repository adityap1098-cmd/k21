import './globals.css'
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata = {
  title: 'K21 — Retail ERP',
  description: 'Sistem ERP terpadu untuk manajemen penjualan, inventori, dan keuangan bisnis retail',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B2B3A" />
      </head>
      <body className="bg-surface text-ink antialiased">
        <a href="#main-content" className="skip-link">Langsung ke konten utama</a>
        {children}
      </body>
    </html>
  )
}
