import {
  Bus,
  LayoutDashboard,
  Megaphone,
  Send,
  FileText,
  Users,
  Upload,
  BarChart2,
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { Page } from '../../types'

interface NavItem {
  id: Page | string
  label: string
  icon: React.ElementType
  active?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
  { id: 'envios', label: 'Envios', icon: Send },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'contatos', label: 'Contatos', icon: Users },
  { id: 'imports', label: 'Importações', icon: Upload },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  page: Page
  onNavigate: (p: Page) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ page, onNavigate, collapsed, onToggle }: SidebarProps) {
  const activePage = (id: string) => id === page || (id === 'dashboard' && page === 'dashboard')

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-30 transition-all duration-300"
      style={{ width: collapsed ? 64 : 220, background: '#111111' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 min-h-[64px]">
        <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center flex-shrink-0">
          <Bus size={20} color="white" />
        </div>
        {!collapsed && (
          <span className="text-white font-extrabold text-base tracking-widest whitespace-nowrap">
            CATEDRAL
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activePage(id)
          const isClickable = id === 'dashboard' || id === 'imports' || id === 'logs' || id === 'contatos' || id === 'configuracoes' || id === 'envios' || id === 'relatorios' || id === 'campanhas' || id === 'templates'
          return (
            <button
              key={id}
              onClick={() => isClickable && onNavigate(id as Page)}
              title={collapsed ? label : undefined}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                transition-all duration-150 relative group
                ${isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80'}
                ${!isClickable ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand" />
              )}
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${isActive ? 'text-brand' : ''}`}
              />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-full py-4 border-t border-white/10 text-white/40 hover:text-white/70 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
