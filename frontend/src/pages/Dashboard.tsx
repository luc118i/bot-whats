import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, BarChart2, CheckCircle2, Clock } from 'lucide-react'
import { useStats } from '../hooks/useStats'
import { useBotStatus } from '../hooks/useBotStatus'
import { useLogs } from '../hooks/useLogs'
import { useCampanha, type CampanhaResumo } from '../context/CampanhaContext'
import type { Stats } from '../types'
import { KpiCards } from '../components/dashboard/KpiCards'
import { ActiveCampaignCard, PausedCampaignCard, LastCampaignCard } from '../components/dashboard/CampaignCard'
import { QuickActions } from '../components/dashboard/QuickActions'
import { BotMonitor } from '../components/dashboard/BotMonitor'
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline'
import { ActivityChart } from '../components/dashboard/ActivityChart'
import { Card } from '../components/ui/Card'
import type { Page } from '../types'
import axios from 'axios'

interface DashboardProps {
  onNavigate: (p: Page) => void
}

// ─── Mini card de campanha recente ───────────────────────────────────────────

function CampanhaRow({ c }: { c: CampanhaResumo }) {
  const taxa = c.stats.total > 0
    ? (((c.stats as any).entregues ?? c.stats.enviados) / c.stats.total * 100).toFixed(0)
    : '0'
  const statusColor: Record<string, string> = {
    finalizada: 'bg-blue-100 text-blue-700',
    pausada:    'bg-amber-100 text-amber-700',
    cancelada:  'bg-red-100 text-red-600',
    executando: 'bg-green-100 text-green-700',
  }
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 size={15} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{c.nome}</p>
        <p className="text-xs text-gray-400">
          {c.iniciadoEm ? new Date(c.iniciadoEm).toLocaleDateString('pt-BR') : '—'} · {c.stats.enviados} enviados
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-gray-700">{taxa}%</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor[c.status] || 'bg-gray-100 text-gray-500'}`}>
          {c.status}
        </span>
      </div>
    </div>
  )
}

// ─── Painel idle: visão geral histórica ──────────────────────────────────────

function IdleOverview({ campanhas, onNovaCampanha }: { campanhas: CampanhaResumo[]; onNovaCampanha: () => void }) {
  const finalizadas = campanhas.filter(c => c.status === 'finalizada')
  const totalEnviados = finalizadas.reduce((s, c) => s + (c.stats?.enviados ?? 0), 0)
  const taxaMedia = finalizadas.length > 0
    ? (finalizadas.reduce((s, c) => s + (c.stats.total > 0 ? c.stats.enviados / c.stats.total : 0), 0) / finalizadas.length * 100).toFixed(1)
    : '—'
  const recentes = campanhas.slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Métricas gerais */}
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
          <BarChart2 size={15} className="text-brand" /> Resumo Geral
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-blue-500 uppercase tracking-wide font-semibold mb-0.5">Campanhas</p>
            <p className="text-2xl font-extrabold text-blue-700">{finalizadas.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-green-500 uppercase tracking-wide font-semibold mb-0.5">Enviados</p>
            <p className="text-2xl font-extrabold text-green-700">{totalEnviados.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center col-span-2">
            <p className="text-[10px] text-orange-500 uppercase tracking-wide font-semibold mb-0.5">Taxa Média</p>
            <p className="text-2xl font-extrabold text-orange-700">{taxaMedia}{taxaMedia !== '—' ? '%' : ''}</p>
          </div>
        </div>
        <button
          onClick={onNovaCampanha}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#F56600' }}
        >
          <Plus size={15} /> Nova Campanha
        </button>
      </Card>

      {/* Campanhas recentes */}
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
          <Clock size={15} className="text-gray-400" /> Campanhas Recentes
        </h3>
        {recentes.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Nenhuma campanha ainda</div>
        ) : (
          <div>{recentes.map(c => <CampanhaRow key={c.id} c={c} />)}</div>
        )}
      </Card>
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: botStatus, isLoading: statusLoading } = useBotStatus()
  const { lines, activity, clearLogs } = useLogs()
  const { campanhas, refetch: refetchCampanhas } = useCampanha()

  const { data: ativaData, refetch: refetchAtiva } = useQuery({
    queryKey: ['campanha-ativa'],
    queryFn:  () => axios.get('/api/campanhas/ativa').then(r => r.data),
    refetchInterval: 8_000,
  })

  const campanhaAtiva: CampanhaResumo | null = ativaData?.ativa ?? null
  const ultimaCampanha = campanhas[0] ?? null

  // Stats do card de progresso da campanha: usa os stats já filtrados pela base
  // operacional da campanha (vindos de /api/campanhas/ativa), não os globais de
  // /api/stats — senão o card mistura "337 total da planilha inteira" com o
  // progresso de uma campanha que na verdade mira só um subconjunto (ex: 122).
  const statsCampanha: Stats | undefined = campanhaAtiva ? {
    total:       campanhaAtiva.stats.total,
    enviados:    campanhaAtiva.stats.enviados,
    pendentes:   campanhaAtiva.stats.pendentes,
    semNumero:   campanhaAtiva.stats.semNumero ?? 0,
    semWhatsapp: campanhaAtiva.stats.semWhatsapp ?? 0,
  } : undefined

  // Determina estado do dashboard
  const isRunning = botStatus?.running ?? false
  const dashState =
    isRunning                                                    ? 'ativa'
    : (campanhaAtiva?.status === 'executando' ||
       campanhaAtiva?.status === 'pausada')                      ? 'pausada'
    : 'idle'

  function handleFinalizar() {
    refetchAtiva()
    refetchCampanhas()
  }

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Banner de estado ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {dashState === 'ativa' && (
          <motion.div key="banner-ativa"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold text-emerald-800 border border-emerald-200"
            style={{ background: 'linear-gradient(90deg, #f0fdf4, #dcfce7)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            Campanha em execução — {campanhaAtiva?.nome ?? 'em andamento'}
          </motion.div>
        )}
        {dashState === 'pausada' && (
          <motion.div key="banner-pausada"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold text-amber-800 border border-amber-200"
            style={{ background: 'linear-gradient(90deg, #fffbeb, #fef3c7)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
            Campanha pausada — {campanhaAtiva?.nome ?? ''} · Retome quando estiver pronto
          </motion.div>
        )}
        {dashState === 'idle' && (
          <motion.div key="banner-idle"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center justify-between px-5 py-3 rounded-2xl text-sm border border-gray-200 bg-white"
          >
            <span className="text-gray-600 font-medium">Sistema em espera — nenhuma campanha ativa</span>
            <button
              onClick={() => onNavigate('nova-campanha')}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg hover:opacity-90"
              style={{ background: '#F56600' }}
            >
              <Plus size={13} /> Nova Campanha
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <KpiCards stats={stats} loading={statsLoading} />

      {/* ── Linha principal: campanha + ações ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AnimatePresence mode="wait">
          {dashState === 'ativa' && campanhaAtiva && (
            <motion.div key="card-ativa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ActiveCampaignCard campanha={campanhaAtiva} stats={statsCampanha} botStatus={botStatus!} />
            </motion.div>
          )}
          {dashState === 'pausada' && campanhaAtiva && (
            <motion.div key="card-pausada" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PausedCampaignCard campanha={campanhaAtiva} stats={statsCampanha} />
            </motion.div>
          )}
          {dashState === 'idle' && (
            <motion.div key="card-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LastCampaignCard
                campanha={ultimaCampanha}
                onNovaCampanha={() => onNavigate('nova-campanha')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <QuickActions
          botStatus={botStatus}
          campanha={campanhaAtiva}
          state={dashState}
          onNovaCampanha={() => onNavigate('nova-campanha')}
          onFinalizar={handleFinalizar}
        />
      </div>

      {/* ── Histórico de campanhas (só idle) ─────────────────────────────── */}
      {dashState === 'idle' && (
        <IdleOverview
          campanhas={campanhas}
          onNovaCampanha={() => onNavigate('nova-campanha')}
        />
      )}

      {/* ── Gráfico + Monitor ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ActivityChart data={activity} />
        </div>
        <BotMonitor botStatus={botStatus} loading={statusLoading} />
      </div>

      <ActivityTimeline lines={lines} onClear={clearLogs} />
    </div>
  )
}
