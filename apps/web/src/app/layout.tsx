import './globals.css'

export const metadata = {
  title: 'Teladan27 Motor — Retail ERP',
  description: 'Sistem ERP terpadu untuk manajemen penjualan, inventori, dan keuangan bisnis retail',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1B2B3A" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-surface text-ink antialiased">
        <a href="#main-content" className="skip-link">Langsung ke konten utama</a>
        {children}
      </body>
    </html>
  )
}
