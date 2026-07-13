import { useEffect, useRef, useState } from 'react'
import { Clock, Zap, Play, Pause, CheckCircle2, Calendar, TrendingUp, Users } from 'lucide-react'
import { Card } from '../ui/Card'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
import type { Stats, BotStatus } from '../../types'
import type { CampanhaResumo } from '../../context/CampanhaContext'
import { CMD_LABELS } from '../../constants'

// ─── Utilitários ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function elapsed(startMs: number): string {
  const s = Math.floor((Date.now() - startMs) / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function eta(pendentes: number, speed: number): string {
  if (!speed || !pendentes) return '—'
  const d = new Date(Date.now() + (pendentes / speed) * 60_000)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDuracao(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

// ─── Card: Campanha ATIVA (bot rodando) ──────────────────────────────────────

interface ActiveCardProps {
  campanha: CampanhaResumo
  stats: Stats | undefined
  botStatus: BotStatus
}

export function ActiveCampaignCard({ campanha, stats, botStatus }: ActiveCardProps) {
  const [startMs] = useState(() => Date.now())
  const [elapsedStr, setElapsedStr] = useState('00:00:00')
  const [speed, setSpeed] = useState(0)
  const prevEnviados = useRef(0)
  const prevTime = useRef(Date.now())

  useEffect(() => {
    const t = setInterval(() => setElapsedStr(elapsed(startMs)), 1000)
    return () => clearInterval(t)
  }, [startMs])

  useEffect(() => {
    if (!stats) return
    const now = Date.now()
    const dt = (now - prevTime.current) / 60_000
    const dEnv = stats.enviados - prevEnviados.current
    if (dt > 0 && dEnv >= 0) setSpeed(Math.round(dEnv / dt))
    prevEnviados.current = stats.enviados
    prevTime.current = now
  }, [stats])

  const pct = stats?.total ? Math.round((stats.enviados / stats.total) * 100) : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-bold text-gray-800">Campanha em Andamento</h2>
        </div>
        <Badge color="green">{CMD_LABELS[botStatus.command ?? ''] ?? 'Enviando...'}</Badge>
      </div>

      <p className="text-sm font-semibold text-gray-700 mb-4 truncate" title={campanha.nome}>
        {campanha.nome}
      </p>

      <div className="mb-4">
        <div className="flex justify-between text-sm font-semibold text-gray-700 mb-2">
          <span>{stats?.enviados ?? 0} de {stats?.total ?? 0} mensagens</span>
          <span className="text-brand font-extrabold">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Clock size={14} className="text-gray-400 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Decorrido</p>
          <p className="text-sm font-bold text-gray-700 font-mono">{elapsedStr}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Zap size={14} className="text-brand mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Velocidade</p>
          <p className="text-sm font-bold text-gray-700">{speed} msg/min</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <Clock size={14} className="text-emerald-500 mx-auto mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">ETA</p>
          <p className="text-sm font-bold text-emerald-700">{eta(stats?.pendentes ?? 0, speed)}</p>
        </div>
      </div>
    </Card>
  )
}

// ─── Card: Campanha PAUSADA ───────────────────────────────────────────────────

interface PausedCardProps {
  campanha: CampanhaResumo
  stats: Stats | undefined
}

export function PausedCampaignCard({ campanha, stats }: PausedCardProps) {
  const s = stats ?? { total: 0, enviados: 0, pendentes: 0 }
  const pct = s.total ? Math.round((s.enviados / s.total) * 100) : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pause size={16} className="text-amber-500" />
          <h2 className="font-bold text-gray-800">Campanha Pausada</h2>
        </div>
        <Badge color="yellow">Pausada</Badge>
      </div>

      <p className="text-sm font-semibold text-gray-700 mb-4 truncate" title={campanha.nome}>
        {campanha.nome}
      </p>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{s.enviados} de {s.total} enviados</span>
          <span className="font-bold text-amber-600">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
          <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-0.5">Pendentes</p>
          <p className="text-lg font-extrabold text-amber-700">{s.pendentes}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
          <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-0.5">Enviados</p>
          <p className="text-lg font-extrabold text-green-700">{s.enviados}</p>
        </div>
      </div>
    </Card>
  )
}

// ─── Card: Última Campanha (idle) ─────────────────────────────────────────────

interface LastCampaignCardProps {
  campanha: CampanhaResumo | null
  onNovaCampanha: () => void
}

export function LastCampaignCard({ campanha, onNovaCampanha }: LastCampaignCardProps) {
  if (!campanha) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[200px]">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Play size={24} className="text-gray-300" />
        </div>
        <div>
          <p className="font-semibold text-gray-600 text-sm">Nenhuma campanha realizada</p>
          <p className="text-xs text-gray-400 mt-1">Crie sua primeira campanha para começar</p>
        </div>
        <button
          onClick={onNovaCampanha}
          className="mt-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: '#F56600' }}
        >
          + Nova Campanha
        </button>
      </Card>
    )
  }

  const st = campanha.stats
  const taxa = st.total > 0 ? ((st.enviados / st.total) * 100).toFixed(1) : '0.0'
  const entregues = (st as any).entregues ?? st.enviados
  const pct = st.total ? Math.round((entregues / st.total) * 100) : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-blue-500" />
          <h2 className="font-bold text-gray-800">Última Campanha</h2>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">
          {campanha.status === 'finalizada' ? 'Finalizada' : campanha.status}
        </span>
      </div>

      <p className="text-base font-bold text-gray-900 mb-1 truncate" title={campanha.nome}>
        {campanha.nome}
      </p>

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Calendar size={11} />
        {fmtData(campanha.iniciadoEm)}
        {campanha.finalizadoEm && <> → {fmtData(campanha.finalizadoEm)}</>}
        {st.duracaoSegundos > 0 && <> · {fmtDuracao(st.duracaoSegundos)}</>}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-500">{entregues} entregues de {st.total}</span>
          <span className="font-bold text-blue-600">{taxa}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="bg-green-50 rounded-xl py-2.5 px-1">
          <p className="text-xs text-gray-400 mb-0.5">Enviados</p>
          <p className="text-base font-extrabold text-green-700">{st.enviados}</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2.5 px-1">
          <p className="text-xs text-gray-400 mb-0.5">Sem contato</p>
          <p className="text-base font-extrabold text-gray-600">
            {((st as any).semNumero ?? 0) + ((st as any).semWhatsapp ?? 0)}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl py-2.5 px-1">
          <p className="text-xs text-gray-400 mb-0.5">Taxa</p>
          <p className="text-base font-extrabold text-blue-700">{taxa}%</p>
        </div>
      </div>

      <button
        onClick={onNovaCampanha}
        className="w-full py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
        style={{ background: '#F56600' }}
      >
        + Nova Campanha
      </button>
    </Card>
  )
}

// ─── Card legado (fallback) ───────────────────────────────────────────────────

interface CampaignCardProps {
  stats: Stats | undefined
  botStatus: BotStatus | undefined
  nomeCampanha?: string | null
}

export function CampaignCard({ stats, botStatus, nomeCampanha }: CampaignCardProps) {
  const pct = stats?.total ? Math.round((stats.enviados / stats.total) * 100) : 0
  if (!botStatus?.running) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Play size={18} className="text-gray-400" />
          <h2 className="font-bold text-gray-700">Campanha em Andamento</h2>
        </div>
        <div className="text-center py-8 text-gray-400">
          <Play size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium">Nenhuma campanha em andamento</p>
        </div>
        {stats && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{stats.enviados} de {stats.total} enviados</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        )}
      </Card>
    )
  }
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="font-bold text-gray-800">Campanha em Andamento</h2>
      </div>
      {nomeCampanha && <p className="text-xs text-gray-500 mb-3 truncate">{nomeCampanha}</p>}
      <div className="mb-3">
        <div className="flex justify-between text-sm font-semibold mb-2">
          <span>{stats?.enviados ?? 0} de {stats?.total ?? 0}</span>
          <span className="text-brand">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>
      <div className="flex gap-3 mt-4">
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <TrendingUp size={14} className="text-brand mx-auto mb-1" />
          <p className="text-xs text-gray-400">Taxa</p>
          <p className="text-sm font-bold text-gray-700">{pct}%</p>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <Users size={14} className="text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Pendentes</p>
          <p className="text-sm font-bold text-gray-700">{stats?.pendentes ?? 0}</p>
        </div>
      </div>
    </Card>
  )
}
