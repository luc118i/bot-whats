import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { Page } from '../../types'
import type { BotStatus } from '../../types'

interface LayoutProps {
  children: ReactNode
  page: Page
  onNavigate: (p: Page) => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  botStatus: BotStatus | undefined
}

export function Layout({
  children,
  page,
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
  botStatus,
}: LayoutProps) {
  const sideW = sidebarCollapsed ? 64 : 220

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar
        page={page}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
      />

      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sideW }}
      >
        <Header page={page} botStatus={botStatus} />
        <main className="flex-1 p-6">{children}</main>

        <footer className="border-t border-gray-100 bg-white px-6 py-3 flex items-center justify-between text-xs text-gray-400">
          <span className="font-bold text-brand tracking-widest">CATEDRAL</span>
          <span className="font-medium uppercase tracking-widest">Criado por Lucas Inacio</span>
          <span>v2.0.0</span>
        </footer>
      </div>
    </div>
  )
}
