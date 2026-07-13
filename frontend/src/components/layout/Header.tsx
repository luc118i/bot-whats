import { useState, useRef, useEffect } from 'react'
import { ChevronDown, CheckCircle2, Pause, Play, FileText } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { useCampanha, type CampanhaResumo } from '../../context/CampanhaContext'
import type { BotStatus } from '../../types'

interface HeaderProps {
  page: string
  botStatus: BotStatus | undefined
}

const PAGE_TITLES: Record<string, string> = {
  dashboard:     'Dashboard',
  campanhas:     'Campanhas',
  envios:        'Envios',
  templates:     'Templates',
  contatos:      'Contatos',
  imports:       'Importações',
  relatorios:    'Relatórios',
  logs:          'Logs',
  configuracoes: 'Configurações',
}

const CAMP_PAGES = new Set(['envios', 'relatorios', 'contatos'])

const STATUS_ICON: Record<string, React.ElementType> = {
  executando: Play,
  pausada:    Pause,
  finalizada: CheckCircle2,
}

const STATUS_COLOR: Record<string, string> = {
  executando: 'text-green-600 bg-green-50 border-green-200',
  pausada:    'text-amber-600 bg-amber-50 border-amber-200',
  finalizada: 'text-blue-600 bg-blue-50 border-blue-200',
}

function formatDate() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function CampanhaPicker({ campanhas, campanhaId, setCampanhaId }: {
  campanhas: CampanhaResumo[]
  campanhaId: string | null
  setCampanhaId: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const atual = campanhas.find(c => c.id === campanhaId)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const Icon = atual ? (STATUS_ICON[atual.status] ?? FileText) : FileText
  const colorClass = atual ? (STATUS_COLOR[atual.status] ?? 'text-gray-600 bg-gray-50 border-gray-200') : 'text-gray-500 bg-gray-50 border-gray-200'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${colorClass}`}
      >
        <Icon size={12} />
        <span className="max-w-[160px] truncate">{atual?.nome ?? 'Campanha'}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Contexto de campanha
          </div>
          <div className="max-h-64 overflow-y-auto">
            {campanhas.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Nenhuma campanha</div>
            )}
            {campanhas.map(c => {
              const Ic = STATUS_ICON[c.status] ?? FileText
              const cc = STATUS_COLOR[c.status] ?? 'text-gray-500 bg-gray-50 border-gray-200'
              return (
                <button
                  key={c.id}
                  onClick={() => { setCampanhaId(c.id); setOpen(false) }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${campanhaId === c.id ? 'bg-orange-50/60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{c.nome}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${cc}`}>
                      <Ic size={9} />
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {c.iniciadoEm
                      ? new Date(c.iniciadoEm).toLocaleDateString('pt-BR')
                      : '—'}
                    {c.stats?.enviados != null ? ` · ${c.stats.enviados} enviados` : ''}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function Header({ page, botStatus }: HeaderProps) {
  const { campanhas, campanhaId, setCampanhaId } = useCampanha()
  const showPicker = CAMP_PAGES.has(page)

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-gray-900">{PAGE_TITLES[page] ?? 'Catedral Bot'}</h1>
        <p className="text-xs text-gray-400 capitalize">{formatDate()}</p>
      </div>

      <div className="flex items-center gap-3">
        {showPicker && (
          <CampanhaPicker
            campanhas={campanhas}
            campanhaId={campanhaId}
            setCampanhaId={setCampanhaId}
          />
        )}

        {botStatus?.running ? (
          <Badge color="green" dot>Bot ativo</Badge>
        ) : (
          <Badge color="gray" dot>Bot parado</Badge>
        )}

        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          CCO
        </div>
      </div>
    </header>
  )
}
