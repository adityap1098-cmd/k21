'use client'

import { DashboardLayout } from '@/components/layout'
import { PageHeader, Card } from '@/components/ui'

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Pengaturan"
        subtitle="Konfigurasi sistem"
      />
      <Card className="animate-in stagger-2">
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-semibold text-ink mb-1">Informasi Toko</h3>
            <p className="text-xs text-ink-muted">Nama dan detail bisnis</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">Nama Toko</span>
                <span className="text-[13px] font-medium text-ink">K21 Store</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">NPWP</span>
                <span className="text-[13px] font-medium text-ink font-mono">00.000.000.0-000.000</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-ink mb-1">Versi Sistem</h3>
            <div className="mt-3 flex items-center gap-4">
              <span className="text-xs text-ink-muted">K21 ERP v1.0</span>
              <span className="text-xs text-ink-muted">·</span>
              <span className="text-xs text-ink-muted">API /api/v1/</span>
              <span className="text-xs text-ink-muted">·</span>
              <span className="text-xs text-success font-medium">Server Online</span>
            </div>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  )
}
