import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Search, CheckCircle2, Clock,
  RefreshCw, ChevronLeft, ChevronRight, Activity, Users,
  TrendingUp, AlertCircle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useCampanha } from '../context/CampanhaContext'
import type { Stats, BotStatus } from '../types'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusFilter = 'todos' | 'ENVIADO' | 'PENDENTE' | 'SEM_NUMERO' | 'SEM_WHATSAPP'

interface Contato {
  matricula: string
  nome: string
  base: string
  celular: string | null
  status: 'ENVIADO' | 'PENDENTE' | 'SEM_NUMERO' | 'SEM_WHATSAPP'
  enviadoEm: string | null
  printGerado?: boolean
}

interface ContatosResponse {
  contatos: Contato[]
  total: number
  pagina: number
  totalPages: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ENVIADO:      'Enviado',
  PENDENTE:     'Pendente',
  SEM_NUMERO:   'Sem número',
  SEM_WHATSAPP: 'Sem WhatsApp',
}

const STATUS_COLOR: Record<string, string> = {
  ENVIADO:      'bg-green-50 text-green-700 border-green-200',
  PENDENTE:     'bg-amber-50 text-amber-700 border-amber-200',
  SEM_NUMERO:   'bg-gray-100 text-gray-500 border-gray-200',
  SEM_WHATSAPP: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_DOT: Record<string, string> = {
  ENVIADO:      'bg-green-500',
  PENDENTE:     'bg-amber-400',
  SEM_NUMERO:   'bg-gray-400',
  SEM_WHATSAPP: 'bg-red-500',
}

function formatarData(valor: string | null) {
  if (!valor) return '—'
  // Formato pt-BR: "30/06/2026, 11:20:40" ou "30/06/2026,11:20:40"
  const ptBR = valor.match(/^(\d{2})\/(\d{2})\/\d{4}[, ]+(\d{2}:\d{2})/)
  if (ptBR) return `${ptBR[1]}/${ptBR[2]} ${ptBR[3]}`
  const d = new Date(valor)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}

function estimarTempo(pendentes: number, delayMedioS = 32) {
  const total = pendentes * delayMedioS
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `~${h}h ${m}min restantes`
  if (m > 0) return `~${m}min restantes`
  return 'Finalizando...'
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string
  value: number
  total?: number
  icon: React.ElementType
  color: string
  bg: string
}

function KpiCard({ label, value, total, icon: Icon, color, bg }: KpiProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-none">{value.toLocaleString('pt-BR')}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {total !== undefined && total > 0 && (
          <div className="text-xs font-semibold mt-0.5" style={{ color: '#F56600' }}>
            {((value / total) * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Barra de Progresso ──────────────────────────────────────────────────────

interface ProgressBarProps {
  enviados: number
  total: number
  running: boolean
  pendentes: number
}

function ProgressBar({ enviados, total, running, pendentes }: ProgressBarProps) {
  const pct = total > 0 ? (enviados / total) * 100 : 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">Progresso do Disparo</span>
          {running && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-green-700 bg-green-50 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Bot ativo
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900">{pct.toFixed(1)}%</span>
          <div className="text-xs text-gray-500">{enviados} de {total}</div>
        </div>
      </div>

      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: '#F56600' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {running && (
          <motion.div
            className="absolute inset-y-0 rounded-full opacity-30"
            style={{ background: '#F56600', width: '60px', left: `calc(${pct}% - 30px)` }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </div>

      {pendentes > 0 && (
        <div className="mt-2 text-xs text-gray-400">{estimarTempo(pendentes)}</div>
      )}
    </div>
  )
}

// ─── Filtro chip ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  dotColor?: string
}

function FilterChip({ label, count, active, onClick, dotColor }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        active
          ? 'text-white border-transparent shadow-sm'
          : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'
      }`}
      style={active ? { background: '#F56600', borderColor: '#F56600' } : {}}
    >
      {dotColor && !active && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {label}
      {count !== undefined && (
        <span className={`px-1 rounded ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[80, 160, 100, 120, 90, 100].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

const PER_PAGE = 50

export default function Envios() {
  const { campanhaId, campanha } = useCampanha()
  const isAtiva = campanha?.status === 'executando' || campanha?.status === 'pausada'

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [page, setPage]                 = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
  }, [search])

  useEffect(() => { setPage(1) }, [statusFilter, campanhaId])

  // Stats ao vivo (só para campanha ativa)
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn:  () => axios.get('/api/stats').then(r => r.data),
    refetchInterval: isAtiva ? 5000 : false,
    enabled: isAtiva,
  })

  const { data: botStatus } = useQuery<BotStatus>({
    queryKey: ['botStatus'],
    queryFn:  () => axios.get('/api/bot/status').then(r => r.data),
    refetchInterval: 2000,
  })

  // Contatos — passa campanha para usar snapshot se finalizada
  const params = new URLSearchParams({
    page:     String(page),
    per_page: String(PER_PAGE),
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(statusFilter !== 'todos' && { status: statusFilter }),
    ...(campanhaId && { campanha: campanhaId }),
  })

  const { data: contatosData, isFetching, refetch } = useQuery<ContatosResponse>({
    queryKey: ['envios-contatos', campanhaId, page, debouncedSearch, statusFilter],
    queryFn:  () => axios.get(`/api/contatos?${params}`).then(r => r.data),
    refetchInterval: (isAtiva && botStatus?.running) ? 10000 : false,
    placeholderData: prev => prev,
    enabled: !!campanhaId,
  })

  const contatos     = contatosData?.contatos ?? []
  const total        = contatosData?.total ?? 0
  const totalPaginas = contatosData?.totalPages ?? 1
  const running      = (isAtiva && botStatus?.running) ?? false

  // Stats: ao vivo se ativa, snapshot da campanha se finalizada
  const snap = campanha?.stats
  const s = isAtiva && stats
    ? stats
    : {
        total:       snap?.total       ?? 0,
        enviados:    snap?.enviados     ?? 0,
        pendentes:   snap?.pendentes    ?? 0,
        semNumero:   snap?.semNumero    ?? 0,
        semWhatsapp: snap?.semWhatsapp  ?? 0,
      }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Send size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Envios</h1>
            <p className="text-sm text-gray-500">
              {campanha ? campanha.nome : 'Selecione uma campanha no topo'}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {!isAtiva && campanha && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium">
          <Activity size={13} />
          Exibindo dados do snapshot final da campanha <strong>{campanha.nome}</strong>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total de motoristas" value={s.total}        icon={Users}       color="text-gray-600"  bg="bg-gray-100" />
        <KpiCard label="Enviados"             value={s.enviados}    total={s.total}     icon={CheckCircle2}   color="text-green-600" bg="bg-green-50" />
        <KpiCard label="Pendentes"            value={s.pendentes}   total={s.total}     icon={Clock}          color="text-amber-600" bg="bg-amber-50" />
        <KpiCard label="Sem número / WA"      value={(s.semNumero ?? 0) + (s.semWhatsapp ?? 0)} icon={AlertCircle} color="text-red-500" bg="bg-red-50" />
      </div>

      {/* Barra de progresso */}
      <ProgressBar
        enviados={s.enviados}
        total={s.total}
        running={running}
        pendentes={s.pendentes}
      />

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou matrícula..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip label="Todos"        count={s.total}                          active={statusFilter === 'todos'}         onClick={() => setStatusFilter('todos')} />
            <FilterChip label="Enviados"     count={s.enviados}    dotColor="bg-green-500"  active={statusFilter === 'ENVIADO'}      onClick={() => setStatusFilter('ENVIADO')} />
            <FilterChip label="Pendentes"    count={s.pendentes}   dotColor="bg-amber-400"  active={statusFilter === 'PENDENTE'}     onClick={() => setStatusFilter('PENDENTE')} />
            <FilterChip label="Sem número"   count={s.semNumero}   dotColor="bg-gray-400"   active={statusFilter === 'SEM_NUMERO'}   onClick={() => setStatusFilter('SEM_NUMERO')} />
            <FilterChip label="Sem WhatsApp" count={s.semWhatsapp} dotColor="bg-red-500"    active={statusFilter === 'SEM_WHATSAPP'} onClick={() => setStatusFilter('SEM_WHATSAPP')} />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Matrícula</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Base</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Celular</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Enviado em</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {isFetching && contatos.length === 0 ? (
                  [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
                ) : contatos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <TrendingUp size={32} className="opacity-30" />
                        <span className="text-sm">Nenhum resultado encontrado</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contatos.map(c => (
                    <motion.tr
                      key={c.matricula}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.matricula}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.nome}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.base || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.celular || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${STATUS_COLOR[c.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatarData(c.enviadoEm)}</td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                const pg = Math.max(1, Math.min(totalPaginas - 4, page - 2)) + i
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                      pg === page
                        ? 'text-white border-transparent'
                        : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    style={pg === page ? { background: '#F56600', borderColor: '#F56600' } : {}}
                  >
                    {pg}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                disabled={page === totalPaginas}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[key]}`} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
          <Activity size={11} />
          Atualiza automaticamente enquanto o bot está ativo
        </div>
      </div>

    </div>
  )
}
