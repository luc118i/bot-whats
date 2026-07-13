import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CampanhaProvider } from './context/CampanhaContext'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Imports } from './pages/Imports'
import LogsPage from './pages/Logs'
import ContatosPage from './pages/Contatos'
import ConfiguracoesPage from './pages/Configuracoes'
import EnviosPage from './pages/Envios'
import RelatoriosPage from './pages/Relatorios'
import CampanhasPage from './pages/Campanhas'
import TemplatesPage from './pages/Templates'
import NovaCampanhaPage from './pages/NovaCampanha'
import { useBotStatus } from './hooks/useBotStatus'
import type { Page } from './types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
  },
})

function AppInner() {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { data: botStatus } = useBotStatus()

  // Páginas com layout próprio (sem sidebar/header do sistema)
  if (page === 'nova-campanha') {
    return <NovaCampanhaPage onNavigate={setPage} />
  }

  return (
    <Layout
      page={page}
      onNavigate={setPage}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      botStatus={botStatus}
    >
      {page === 'dashboard'    && <Dashboard onNavigate={setPage} />}
      {page === 'imports'      && <Imports />}
      {page === 'logs'         && <LogsPage />}
      {page === 'contatos'     && <ContatosPage />}
      {page === 'configuracoes'&& <ConfiguracoesPage />}
      {page === 'envios'       && <EnviosPage />}
      {page === 'relatorios'   && <RelatoriosPage />}
      {page === 'campanhas'    && <CampanhasPage onNavigate={setPage} />}
      {page === 'templates'    && <TemplatesPage />}
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CampanhaProvider>
        <AppInner />
      </CampanhaProvider>
    </QueryClientProvider>
  )
}
