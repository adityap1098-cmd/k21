import { Sidebar } from './Sidebar'
import { AppShell } from './AppShell'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex h-dvh overflow-hidden bg-surface">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto min-w-0" tabIndex={-1}>
          <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 flex flex-col gap-4 lg:gap-5 min-h-full pt-14 lg:pt-7">
            {children}
          </div>
        </main>
      </div>
    </AppShell>
  )
}
