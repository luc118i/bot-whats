import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, Download, FileText, CheckCircle2, Clock,
  PhoneOff, RefreshCw, TrendingUp,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useCampanha } from '../context/CampanhaContext'
import type { Stats } from '../types'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Contato {
  matricula: string
  nome: string
  base: string
  celular: string | null
  status: 'ENVIADO' | 'PENDENTE' | 'SEM_NUMERO' | 'SEM_WHATSAPP'
  enviadoEm: string | null
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

const CAMP_STATUS_LABEL: Record<string, string> = {
  executando: 'Ativa', pausada: 'Pausada', finalizada: 'Finalizada',
  cancelada: 'Cancelada', rascunho: 'Rascunho', agendada: 'Agendada',
}

const CAMP_STATUS_COLOR: Record<string, string> = {
  executando: 'bg-green-100 text-green-700', pausada: 'bg-amber-100 text-amber-700',
  finalizada: 'bg-blue-100 text-blue-700',   cancelada: 'bg-red-100 text-red-600',
  rascunho:   'bg-gray-100 text-gray-500',   agendada: 'bg-purple-100 text-purple-700',
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#9ca3af', '#ef4444']

function formatarData(iso: string | null) {
  if (!iso) return '—'
  const ptBR = iso.match(/^(\d{2})\/(\d{2})\/\d{4}[, ]+(\d{2}:\d{2})/)
  if (ptBR) return `${ptBR[1]}/${ptBR[2]} ${ptBR[3]}`
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatarDataCurta(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function buildHourlyData(contatos: Contato[]) {
  const map: Record<string, number> = {}
  for (const c of contatos) {
    if (!c.enviadoEm) continue
    // parse pt-BR "DD/MM/YYYY, HH:MM:SS"
    const ptBR = c.enviadoEm.match(/(\d{2}:\d{2}:\d{2})/)
    const hora = ptBR ? ptBR[1].slice(0, 2) + 'h' : null
    if (!hora) continue
    map[hora] = (map[hora] ?? 0) + 1
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, total]) => ({ hora, total }))
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string; value: number; pct?: number
  icon: React.ElementType; color: string; bg: string
}

function KpiCard({ label, value, pct, icon: Icon, color, bg }: KpiProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{value.toLocaleString('pt-BR')}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {pct !== undefined && (
          <div className="text-xs font-semibold mt-0.5" style={{ color: '#F56600' }}>{pct.toFixed(1)}%</div>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[80, 180, 90, 130, 90, 100].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-gray-900">{payload[0].name}</div>
      <div className="text-gray-500">{payload[0].value} motoristas</div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

const PER_PAGE = 50

export default function Relatorios() {
  const { campanhaId, campanha: campanhaAtual } = useCampanha()
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const isAtiva = campanhaAtual?.status === 'executando' || campanhaAtual?.status === 'pausada'

  // Stats: usa os stats da campanha selecionada (snapshot ou tempo real via /api/stats se ativa)
  const { data: statsAoVivo, refetch: refetchStats, isFetching: fetchingStats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn:  () => axios.get('/api/stats').then(r => r.data),
    staleTime: 10_000,
    enabled:  isAtiva,
  })

  // Contatos paginados
  const contatosParams = new URLSearchParams({
    page:     String(page),
    per_page: String(PER_PAGE),
    ...(search     && { search }),
    ...(campanhaId && { campanha: campanhaId }),
  })

  const { data: contatosData, isFetching } = useQuery<ContatosResponse>({
    queryKey: ['rel-contatos', campanhaId, page, search],
    queryFn:  () => axios.get(`/api/contatos?${contatosParams}`).then(r => r.data),
    placeholderData: prev => prev,
    enabled: !!campanhaId,
  })

  // Todos os contatos para gráficos
  const todosParams = new URLSearchParams({
    per_page: '500',
    ...(campanhaId && { campanha: campanhaId }),
  })

  const { data: todosData } = useQuery<ContatosResponse>({
    queryKey: ['rel-todos', campanhaId],
    queryFn:  () => axios.get(`/api/contatos?${todosParams}`).then(r => r.data),
    staleTime: 60_000,
    enabled: !!campanhaId,
  })

  const todos     = todosData?.contatos ?? []
  const contatos  = contatosData?.contatos ?? []
  const total     = contatosData?.total ?? 0
  const totalPags = contatosData?.totalPages ?? 1

  // Stats: ao vivo se campanha ativa, snapshot da campanha se finalizada
  const snapStats = campanhaAtual?.stats
  const s = isAtiva && statsAoVivo
    ? statsAoVivo
    : {
        total:       snapStats?.total       ?? 0,
        enviados:    snapStats?.enviados     ?? 0,
        pendentes:   snapStats?.pendentes    ?? 0,
        semNumero:   snapStats?.semNumero    ?? 0,
        semWhatsapp: snapStats?.semWhatsapp  ?? 0,
      }

  const taxa = s.total > 0 ? (s.enviados / s.total) * 100 : 0

  const pieData = [
    { name: 'Enviados',     value: s.enviados },
    { name: 'Pendentes',    value: s.pendentes },
    { name: 'Sem número',   value: s.semNumero ?? 0 },
    { name: 'Sem WhatsApp', value: s.semWhatsapp ?? 0 },
  ].filter(d => d.value > 0)

  const hourlyData = buildHourlyData(todos)

  function handleExportExcel() {
    const url = campanhaId ? `/api/relatorio/excel?campanha=${campanhaId}` : '/api/relatorio/excel'
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_catedral_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <BarChart2 size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500">
              {campanhaAtual ? campanhaAtual.nome : 'Selecione uma campanha no topo da página'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAtiva && (
            <button
              onClick={() => refetchStats()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} className={fetchingStats ? 'animate-spin' : ''} />
              Atualizar
            </button>
          )}
          <button
            onClick={handleExportExcel}
            disabled={!campanhaId}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: '#F56600' }}
          >
            <Download size={14} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Banner campanha */}
      {campanhaAtual && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-sm">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CAMP_STATUS_COLOR[campanhaAtual.status] || 'bg-gray-100 text-gray-500'}`}>
            {CAMP_STATUS_LABEL[campanhaAtual.status] || campanhaAtual.status}
          </span>
          <span className="text-gray-700 font-medium">{campanhaAtual.nome}</span>
          {campanhaAtual.iniciadoEm && (
            <span className="text-gray-400">
              {formatarDataCurta(campanhaAtual.iniciadoEm)}
              {campanhaAtual.finalizadoEm ? ` → ${formatarDataCurta(campanhaAtual.finalizadoEm)}` : ' · em andamento'}
            </span>
          )}
          {!isAtiva && (
            <span className="ml-auto text-xs text-gray-400 italic">dados do snapshot final</span>
          )}
        </div>
      )}

      {!campanhaId ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <BarChart2 size={40} className="opacity-30" />
          <p className="text-sm">Selecione uma campanha para ver o relatório</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total"        value={s.total}                                    icon={FileText}     color="text-gray-600"  bg="bg-gray-100" />
            <KpiCard label="Enviados"     value={s.enviados}    pct={taxa}                   icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
            <KpiCard label="Pendentes"    value={s.pendentes}   pct={s.total > 0 ? (s.pendentes / s.total) * 100 : 0}    icon={Clock}        color="text-amber-600" bg="bg-amber-50" />
            <KpiCard label="Sem contato"  value={(s.semNumero ?? 0) + (s.semWhatsapp ?? 0)}  icon={PhoneOff}     color="text-red-500"   bg="bg-red-50" />
          </div>

          {/* Taxa de sucesso */}
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-900">Taxa de entrega</span>
              <span className="text-2xl font-bold" style={{ color: taxa >= 80 ? '#22c55e' : taxa >= 50 ? '#f59e0b' : '#ef4444' }}>
                {taxa.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: taxa >= 80 ? '#22c55e' : taxa >= 50 ? '#f59e0b' : '#ef4444' }}
                initial={{ width: 0 }}
                animate={{ width: `${taxa}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>0%</span>
              <span className={taxa >= 80 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                {taxa >= 80 ? 'Excelente' : taxa >= 60 ? 'Bom' : taxa >= 40 ? 'Regular' : 'Baixo'}
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Distribuição por status</h2>
              {pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Envios por hora</h2>
              {hourlyData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sem envios registrados</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: '#f9fafb' }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs shadow-lg">
                            <div className="font-semibold text-gray-900">{payload[0].payload.hora}</div>
                            <div className="text-gray-500">{payload[0].value} enviados</div>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="total" fill="#F56600" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Buscar por nome ou matrícula..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>
              <span className="text-xs text-gray-400 ml-auto">{total} resultados</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Matrícula', 'Nome', 'Base', 'Celular', 'Status', 'Enviado em'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isFetching && contatos.length === 0
                    ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                    : contatos.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <TrendingUp size={32} className="opacity-30" />
                            <span className="text-sm">Nenhum resultado</span>
                          </div>
                        </td>
                      </tr>
                    )
                    : contatos.map(c => (
                      <tr key={c.matricula} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.matricula}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{c.nome}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{c.base || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.celular || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${STATUS_COLOR[c.status]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatarData(c.enviadoEm)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {totalPags > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} de {total}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPags) }, (_, i) => {
                    const pg = Math.max(1, Math.min(totalPags - 4, page - 2)) + i
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className="w-8 h-8 rounded-lg text-xs font-semibold border transition-colors"
                        style={pg === page ? { background: '#F56600', borderColor: '#F56600', color: 'white' } : { color: '#4b5563', borderColor: '#e5e7eb' }}>
                        {pg}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPags, p + 1))} disabled={page === totalPags}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
