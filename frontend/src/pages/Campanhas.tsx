import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Plus, Play, Pause, StopCircle, Eye,
  Copy, RefreshCw, Download, Trash2,
  CheckCircle2, AlertCircle, Calendar, Timer, MoreVertical,
  TrendingUp, X, Activity, Upload, RotateCcw, Pencil, Check,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CampanhaConfig {
  filtroBase:     string
  filtroBaseOp:   string[]
  filtroStatus:   string
  modeloMensagem: string
  delayMin:       number
  delayMax:       number
}

interface CampanhaStats {
  total:           number
  enviados:        number
  processando:     number
  entregues:       number
  pendentes:       number
  falhas:          number
  semNumero:       number
  semWhatsapp:     number
  duplicados:      number
  validos:         number
  duracaoSegundos: number
}

interface Evento {
  tipo: string
  em:   string
  msg:  string
}

interface Campanha {
  id:           string
  nome:         string
  descricao:    string
  status:       'rascunho' | 'agendada' | 'executando' | 'pausada' | 'finalizada' | 'cancelada'
  criadoEm:    string
  agendadoPara: string | null
  iniciadoEm:  string | null
  finalizadoEm: string | null
  responsavel:  string
  config:       CampanhaConfig
  stats:        CampanhaStats
  eventos:      Evento[]
}

interface Metricas {
  ativas:        number
  agendadas:     number
  finalizadas:   number
  totalEnviados: number
  taxaGeral:     number
}

// ─── Constantes visuais ───────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  executando: { label: 'Executando',  dot: 'bg-green-500 animate-pulse', badge: 'bg-green-50 text-green-700 border-green-200'  },
  pausada:    { label: 'Pausada',     dot: 'bg-amber-400',               badge: 'bg-amber-50 text-amber-700 border-amber-200'  },
  agendada:   { label: 'Agendada',   dot: 'bg-blue-400',                badge: 'bg-blue-50 text-blue-700 border-blue-200'     },
  rascunho:   { label: 'Rascunho',   dot: 'bg-gray-400',                badge: 'bg-gray-100 text-gray-600 border-gray-200'    },
  finalizada: { label: 'Finalizada', dot: 'bg-gray-400',                badge: 'bg-gray-100 text-gray-500 border-gray-200'    },
  cancelada:  { label: 'Cancelada',  dot: 'bg-red-400',                 badge: 'bg-red-50 text-red-600 border-red-200'        },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDuracao(seg: number) {
  if (!seg) return '—'
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min ${s}s`
  return `${s}s`
}

function fmtTempo(seg: number) {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function calcVelocidade(enviados: number, duracaoSeg: number) {
  if (!duracaoSeg || !enviados) return 0
  return (enviados / (duracaoSeg / 60)).toFixed(1)
}

function estimarRestante(pendentes: number, delayMedioMs: number) {
  const seg = Math.round((pendentes * delayMedioMs) / 1000)
  return fmtTempo(seg)
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.rascunho
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Painel campanha ativa ────────────────────────────────────────────────────

function PainelAtivo({ campanha, onPausar, onRetomar, onCancelar, onFinalizar }: {
  campanha: Campanha
  onPausar:    () => void
  onRetomar:   () => void
  onCancelar:  () => void
  onFinalizar: () => void
}) {
  const s        = campanha.stats
  const validos    = s.validos   || (s.total - (s.semNumero || 0) - (s.semWhatsapp || 0) - (s.duplicados || 0))
  const entregues  = s.entregues ?? (s.enviados + (s.processando || 0))
  const taxa       = validos > 0 ? Math.min((entregues / validos) * 100, 100) : 0
  const avgDelay = (campanha.config.delayMin + campanha.config.delayMax) / 2
  const vel      = calcVelocidade(s.enviados, s.duracaoSegundos)
  const resto    = estimarRestante(s.pendentes, avgDelay)
  const concluido = s.pendentes === 0 && campanha.status !== 'executando'

  return (
    <div className="rounded-2xl overflow-hidden border border-orange-200/30 shadow-xl"
         style={{ background: 'linear-gradient(135deg, #111111 0%, #1e1000 100%)' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${campanha.status === 'executando' ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-white/70 font-semibold text-xs tracking-widest uppercase">Campanha em andamento</span>
        </div>
        <StatusBadge status={campanha.status} />
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Nome + ações */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-bold text-xl leading-tight">{campanha.nome}</h2>
            <p className="text-white/35 text-xs mt-1">Iniciado em {fmtData(campanha.iniciadoEm)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {concluido ? (
              <button onClick={onFinalizar}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-300 border border-green-400/40 rounded-lg hover:bg-green-400/10 transition-colors">
                <CheckCircle2 size={13} /> Marcar concluída
              </button>
            ) : campanha.status === 'executando' ? (
              <button onClick={onPausar}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 border border-amber-400/40 rounded-lg hover:bg-amber-400/10 transition-colors">
                <Pause size={13} /> Pausar
              </button>
            ) : (
              <button onClick={onRetomar}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-300 border border-green-400/40 rounded-lg hover:bg-green-400/10 transition-colors">
                <Play size={13} /> Retomar
              </button>
            )}
            <button onClick={onCancelar}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-300 border border-red-400/40 rounded-lg hover:bg-red-400/10 transition-colors">
              <StopCircle size={13} /> Cancelar
            </button>
          </div>
        </div>

        {/* Barra de progresso */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-white/40">Progresso sobre contatos válidos</span>
            <span className="font-bold text-white">{taxa.toFixed(1)}% <span className="text-white/40 font-normal">— {fmtDuracao(s.duracaoSegundos)} decorrido</span></span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: taxa >= 99 ? '#22c55e' : '#F56600' }}
              animate={{ width: `${taxa}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <div className="flex justify-between text-[11px] text-white/25 mt-1">
            <span>{entregues.toLocaleString('pt-BR')} enviados de {validos.toLocaleString('pt-BR')} válidos{(s.processando||0) > 0 ? ` (${s.processando} sem confirmação)` : ''}</span>
            {s.pendentes > 0 && <span>{s.pendentes} restantes · ~{resto}</span>}
          </div>
        </div>

        {/* Grid de métricas principais */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Enviados',   value: entregues,    color: 'text-green-400',  sub: `de ${validos} válidos` },
            { label: 'Pendentes',  value: s.pendentes,  color: 'text-amber-400',  sub: campanha.status === 'executando' ? `~${resto}` : '—' },
            { label: 'Falhas',     value: s.falhas,     color: 'text-red-400',    sub: 'erro no envio' },
            { label: 'Velocidade', value: `${vel}/min`, color: 'text-blue-400',   sub: `delay ~${((avgDelay)/1000).toFixed(0)}s` },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="text-center bg-white/5 rounded-xl py-3 px-2">
              <div className={`text-xl font-extrabold ${color}`}>{value}</div>
              <div className="text-white/50 text-xs mt-0.5 font-medium">{label}</div>
              <div className="text-white/25 text-[10px] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Breakdown de inválidos */}
        {((s.semNumero || 0) + (s.semWhatsapp || 0) + (s.duplicados || 0)) > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/8">
            <span className="text-white/30 text-xs mr-1">Não alcançados:</span>
            {(s.semNumero  || 0) > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/40 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"/>{s.semNumero} sem número</span>}
            {(s.semWhatsapp|| 0) > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/40 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block"/>{s.semWhatsapp} sem WhatsApp</span>}
            {(s.duplicados || 0) > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/40 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/>{s.duplicados} duplicados</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cards de métricas ────────────────────────────────────────────────────────

function MetricaCard({ label, value, icon: Icon, color, bg, suffix = '' }: {
  label: string; value: number | string; icon: React.ElementType
  color: string; bg: string; suffix?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{value}{suffix}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Tabela histórico ─────────────────────────────────────────────────────────

interface AcaoItem {
  label: string
  icon:  React.ElementType
  color?: string
  hoverBg?: string
  onClick: () => void
  dividerBefore?: boolean
}

function DropdownAcoes({ campanha, onVer, onEditar, onDuplicar, onExcluir, onIniciar }: {
  campanha:   Campanha
  onVer:      () => void
  onEditar:   () => void
  onDuplicar: () => void
  onExcluir:  () => void
  onIniciar:  () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const s = campanha.status

  function toggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top:   rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(o => !o)
  }

  const acoes: AcaoItem[] = [
    // Visualizar — sempre disponível
    { label: 'Visualizar detalhes', icon: Eye, onClick: onVer },

    // Editar — sempre disponível, em qualquer status
    { label: 'Editar campanha', icon: Pencil, onClick: onEditar },

    // Iniciar — rascunho ou agendada
    ...(s === 'rascunho' || s === 'agendada' ? [{
      label: 'Iniciar campanha', icon: Play,
      color: 'text-green-700', hoverBg: 'hover:bg-green-50', onClick: onIniciar,
    }] : []),

    // Repetir — finalizada ou cancelada
    ...(s === 'finalizada' || s === 'cancelada' ? [{
      label: 'Repetir campanha', icon: RotateCcw,
      color: 'text-blue-700', hoverBg: 'hover:bg-blue-50', onClick: onDuplicar,
    }] : []),

    // Duplicar — qualquer status exceto executando
    ...(s !== 'executando' ? [{
      label: 'Duplicar', icon: Copy, onClick: onDuplicar,
    }] : []),

    // Exportar — finalizada ou pausada (tem dados)
    ...(s === 'finalizada' || s === 'pausada' ? [{
      label: 'Exportar relatório', icon: Download,
      onClick: () => { window.open('/api/relatorio/excel', '_blank') },
    }] : []),

    // Excluir — nunca em executando
    ...(s !== 'executando' ? [{
      label: 'Excluir', icon: Trash2,
      color: 'text-red-600', hoverBg: 'hover:bg-red-50',
      dividerBefore: true, onClick: onExcluir,
    }] : []),
  ]

  const menu = (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95, y: -4  }}
            transition={{ duration: 0.1 }}
            style={{ position: 'absolute', top: pos.top, right: pos.right, zIndex: 101 }}
            className="w-52 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 overflow-hidden"
          >
            {acoes.map((acao, i) => (
              <div key={i}>
                {acao.dividerBefore && <div className="border-t border-gray-100 my-1" />}
                <button
                  onClick={() => { acao.onClick(); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors
                    ${acao.color   || 'text-gray-700'}
                    ${acao.hoverBg || 'hover:bg-gray-50'}`}
                >
                  <acao.icon size={13} className="shrink-0" />
                  {acao.label}
                </button>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
          open
            ? 'bg-gray-100 border-gray-300 text-gray-700'
            : 'border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
      >
        <MoreVertical size={15} />
      </button>

      {createPortal(menu, document.body)}
    </div>
  )
}

function CampanhaCard({ campanha, onDuplicar, onExcluir, onIniciar, onVer, onEditar }: {
  campanha: Campanha
  onDuplicar: () => void; onExcluir: () => void
  onIniciar:  () => void; onVer:     () => void
  onEditar:   () => void
}) {
  const c    = campanha
  const taxa = c.stats.total > 0 ? ((c.stats.enviados / c.stats.total) * 100).toFixed(1) : null
  const taxaNum = taxa ? parseFloat(taxa) : 0
  const taxaColor = taxaNum >= 80 ? 'text-green-600' : taxaNum >= 50 ? 'text-amber-600' : 'text-red-500'

  const qc = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(c.nome)
  const nameRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setNameVal(c.nome)
    setEditingName(true)
    setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select() }, 0)
  }

  async function saveName() {
    const trimmed = nameVal.trim()
    setEditingName(false)
    if (!trimmed || trimmed === c.nome) return
    try {
      await fetch(`/api/campanhas/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: trimmed }),
      })
      qc.invalidateQueries({ queryKey: ['campanhas'] })
    } catch (_) {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveName() }
    if (e.key === 'Escape') setEditingName(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-stretch gap-0 border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors group"
    >
      {/* Thumbnail da imagem */}
      <div className="w-24 shrink-0 p-3 flex items-center justify-center">
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100 shrink-0">
          <img
            src={`/api/campanha/imagem?campanha=${c.id}`}
            alt="Informativo"
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      </div>

      {/* Info principal */}
      <div className="flex-1 py-4 pr-4 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameRef}
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-bold text-gray-900 text-sm border border-brand rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-brand/30 max-w-[240px]"
              />
              <button onClick={saveName} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
              <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="group/name flex items-center gap-1.5 hover:text-brand transition-colors"
              title="Clique para renomear"
            >
              <span className="font-bold text-gray-900 text-sm truncate max-w-[260px] group-hover/name:text-brand">{c.nome}</span>
              <Pencil size={11} className="text-gray-300 group-hover/name:text-brand flex-shrink-0" />
            </button>
          )}
          <StatusBadge status={c.status} />
        </div>
        {c.descricao && (
          <p className="text-xs text-gray-400 truncate max-w-[320px]">{c.descricao}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
          <span>{fmtData(c.iniciadoEm || c.agendadoPara || c.criadoEm)}</span>
          {c.finalizadoEm && <><span>→</span><span>{fmtData(c.finalizadoEm)}</span></>}
          {c.stats.duracaoSegundos > 0 && (
            <span className="flex items-center gap-1">
              <Timer size={10} />
              {fmtDuracao(c.stats.duracaoSegundos)}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[44px]">
            <div className="text-sm font-bold text-gray-700">{c.stats.total || '—'}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center min-w-[52px]">
            <div className="text-sm font-bold text-green-600">{c.stats.enviados || '—'}</div>
            <div className="text-xs text-gray-400">Enviadas</div>
          </div>
          <div className="text-center min-w-[44px]">
            <div className="text-sm font-bold text-red-500">{c.stats.falhas || '—'}</div>
            <div className="text-xs text-gray-400">Falhas</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center min-w-[52px]">
            {taxa ? (
              <>
                <div className={`text-sm font-bold ${taxaColor}`}>{taxa}%</div>
                <div className="text-xs text-gray-400">Taxa</div>
              </>
            ) : (
              <div className="text-xs text-gray-400">—</div>
            )}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="shrink-0 flex items-center px-4 py-4">
        <DropdownAcoes
          campanha={c}
          onVer={onVer}
          onEditar={onEditar}
          onDuplicar={onDuplicar}
          onExcluir={onExcluir}
          onIniciar={onIniciar}
        />
      </div>
    </motion.div>
  )
}

function TabelaHistorico({ campanhas, onDuplicar, onExcluir, onIniciar, onVer, onEditar }: {
  campanhas: Campanha[]
  onDuplicar: (id: string) => void
  onExcluir:  (id: string) => void
  onIniciar:  (id: string) => void
  onVer:      (c: Campanha) => void
  onEditar:   (id: string) => void
}) {
  if (campanhas.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
        <Megaphone size={36} className="opacity-20" />
        <p className="text-sm">Nenhuma campanha criada ainda</p>
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <div className="w-24 shrink-0" />
        <div className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Campanha</div>
        <div className="shrink-0 flex items-center gap-4 px-4">
          <div className="min-w-[44px] text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Total</div>
          <div className="w-px h-4" />
          <div className="min-w-[52px] text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Enviadas</div>
          <div className="min-w-[44px] text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Falhas</div>
          <div className="w-px h-4" />
          <div className="min-w-[52px] text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Taxa</div>
        </div>
        <div className="w-24 shrink-0" />
      </div>

      {/* Cards */}
      <AnimatePresence>
        {campanhas.map(c => (
          <CampanhaCard
            key={c.id}
            campanha={c}
            onVer={() => onVer(c)}
            onEditar={() => onEditar(c.id)}
            onDuplicar={() => onDuplicar(c.id)}
            onExcluir={() => onExcluir(c.id)}
            onIniciar={() => onIniciar(c.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}


// ─── Modal Detalhes ───────────────────────────────────────────────────────────

function ModalDetalhes({ campanha, onClose }: { campanha: Campanha; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">{campanha.nome}</div>
            <div className="text-xs text-gray-400 mt-0.5">{campanha.id}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-2"><StatusBadge status={campanha.status} /></div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Criado em',     value: fmtData(campanha.criadoEm) },
              { label: 'Iniciado em',   value: fmtData(campanha.iniciadoEm) },
              { label: 'Finalizado em', value: fmtData(campanha.finalizadoEm) },
              { label: 'Duração',       value: fmtDuracao(campanha.stats.duracaoSegundos) },
              { label: 'Enviados',      value: String(campanha.stats.enviados) },
              { label: 'Falhas',        value: String(campanha.stats.falhas) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Linha do tempo</h3>
            <div className="space-y-2">
              {(campanha.eventos || []).map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-gray-700">{ev.msg}</div>
                    <div className="text-xs text-gray-400">{fmtData(ev.em)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Campanhas({ onNavigate }: { onNavigate?: (p: import('../types').Page, campanhaId?: string) => void }) {
  const qc = useQueryClient()
  const [detalhesCampanha, setDetalhesCampanha] = useState<Campanha | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)
  const [importando, setImportando] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [importNome, setImportNome] = useState('')

  function showToast(msg: string, tipo: 'ok' | 'err' = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // Queries
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['campanhas'],
    queryFn: () => axios.get('/api/campanhas').then(r => r.data),
    refetchInterval: 10_000,
  })

  const { data: ativaData } = useQuery({
    queryKey: ['campanha-ativa'],
    queryFn: () => axios.get('/api/campanhas/ativa').then(r => r.data),
    refetchInterval: 2000,
  })

  const campanhas: Campanha[] = data?.campanhas ?? []
  const metricas: Metricas    = data?.metricas  ?? { ativas: 0, agendadas: 0, finalizadas: 0, totalEnviados: 0, taxaGeral: 0 }
  const ativa: Campanha | null = ativaData?.ativa ?? null

  // Mutations
  const mutIniciar  = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/iniciar`),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanhas'] }); qc.invalidateQueries({ queryKey: ['campanha-ativa'] }); showToast('Disparo iniciado — WhatsApp abrindo...') },       onError: (e: any) => showToast(e?.response?.data?.erro || 'Não foi possível iniciar o disparo.', 'err') })
  const mutPausar   = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/pausar`),    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanha-ativa'] }); showToast('Campanha pausada. Retome quando quiser.') } })
  const mutRetomar  = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/retomar`),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanha-ativa'] }); showToast('Disparo retomado — enviando mensagens...') } })
  const mutCancelar  = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/cancelar`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanhas'] }); qc.invalidateQueries({ queryKey: ['campanha-ativa'] }); showToast('Campanha cancelada e encerrada.') } })
  const mutFinalizar = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/finalizar`),onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanhas'] }); qc.invalidateQueries({ queryKey: ['campanha-ativa'] }); showToast('Campanha concluída com sucesso!') },             onError: (e: any) => showToast(e?.response?.data?.erro || 'Erro ao finalizar.', 'err') })
  const mutDuplicar  = useMutation({ mutationFn: (id: string) => axios.post(`/api/campanhas/${id}/duplicar`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanhas'] }); showToast('Campanha duplicada — edite e inicie quando quiser.') } })
  const mutExcluir   = useMutation({ mutationFn: (id: string) => axios.delete(`/api/campanhas/${id}`),        onSuccess: () => { qc.invalidateQueries({ queryKey: ['campanhas'] }); showToast('Campanha removida do histórico.') },                                                                         onError: (e: any) => showToast(e?.response?.data?.erro || 'Não foi possível excluir.', 'err') })

  async function handleImportar() {
    setImportando(true)
    try {
      const { data: res } = await axios.post('/api/campanhas/importar-progresso', { nome: importNome || undefined })
      qc.invalidateQueries({ queryKey: ['campanhas'] })
      setImportModal(false)
      setImportNome('')
      showToast(`Campanha "${res.campanha.nome}" importada com sucesso!`)
    } catch (e: any) {
      showToast(e?.response?.data?.erro || 'Erro ao importar disparo.', 'err')
    } finally {
      setImportando(false)
    }
  }


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Megaphone size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campanhas</h1>
            <p className="text-sm text-gray-500">Centro de gerenciamento de disparos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Upload size={14} /> Importar disparo
          </button>
          <button onClick={() => onNavigate?.('nova-campanha')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#F56600' }}>
            <Plus size={15} /> Nova Campanha
          </button>
        </div>
      </div>

      {/* Campanha ativa */}
      <AnimatePresence>
        {ativa && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PainelAtivo
              campanha={ativa}
              onPausar={()    => mutPausar.mutate(ativa.id)}
              onRetomar={()   => mutRetomar.mutate(ativa.id)}
              onCancelar={()  => { if (confirm(`Cancelar a campanha "${ativa.nome}"?`)) mutCancelar.mutate(ativa.id) }}
              onFinalizar={()  => mutFinalizar.mutate(ativa.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricaCard label="Campanhas ativas"    value={metricas.ativas}        icon={Activity}     color="text-green-600"  bg="bg-green-50" />
        <MetricaCard label="Agendadas"           value={metricas.agendadas}     icon={Calendar}     color="text-blue-600"   bg="bg-blue-50"  />
        <MetricaCard label="Finalizadas"         value={metricas.finalizadas}   icon={CheckCircle2} color="text-gray-500"   bg="bg-gray-100" />
        <MetricaCard label="Taxa geral de sucesso" value={metricas.taxaGeral}   icon={TrendingUp}   color="text-orange-600" bg="bg-orange-50" suffix="%" />
      </div>

      {/* Histórico */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Histórico de Campanhas</h2>
          <span className="text-xs text-gray-400">{campanhas.length} campanhas</span>
        </div>
        <TabelaHistorico
          campanhas={campanhas}
          onDuplicar={id => mutDuplicar.mutate(id)}
          onExcluir={id => { if (confirm('Excluir esta campanha?')) mutExcluir.mutate(id) }}
          onIniciar={id => mutIniciar.mutate(id)}
          onVer={c => setDetalhesCampanha(c)}
          onEditar={id => onNavigate?.('nova-campanha', id)}
        />
      </div>

      {/* Banner importação — aparece quando lista vazia */}
      {campanhas.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 px-6 py-8 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
            <Upload size={22} className="text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Você tem disparos anteriores?</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              Importe o histórico de envios atual para o sistema de campanhas e reutilize essa configuração no futuro.
            </p>
          </div>
          <button onClick={() => setImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#F56600' }}>
            <Upload size={14} /> Importar disparo existente
          </button>
        </motion.div>
      )}

      {/* Modal importação */}
      <AnimatePresence>
        {importModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Upload size={15} className="text-orange-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">Importar Disparo Existente</div>
                    <div className="text-xs text-gray-400">Cria uma campanha a partir do progresso.json atual</div>
                  </div>
                </div>
                <button onClick={() => setImportModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  O sistema vai ler o <strong>progresso.json</strong> atual e criar uma campanha com as estatísticas reais de envio. As datas serão extraídas dos logs automaticamente.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Nome da campanha <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    value={importNome}
                    onChange={e => setImportNome(e.target.value)}
                    placeholder="Ex: Disparo Informativo — Julho 2026"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Se deixar em branco, o nome será gerado automaticamente com a data do disparo.</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button onClick={() => setImportModal(false)}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImportar} disabled={importando}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: '#F56600' }}>
                  <Upload size={14} />
                  {importando ? 'Importando...' : 'Importar campanha'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal detalhes */}
      <AnimatePresence>
        {detalhesCampanha && (
          <ModalDetalhes campanha={detalhesCampanha} onClose={() => setDetalhesCampanha(null)} />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 16,  scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border max-w-xs ${
              toast.tipo === 'ok'
                ? 'bg-gray-950 border-white/10 text-white'
                : 'bg-red-950  border-red-500/30 text-red-100'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                toast.tipo === 'ok' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {toast.tipo === 'ok'
                  ? <CheckCircle2 size={14} className="text-green-400" />
                  : <AlertCircle  size={14} className="text-red-400"   />
                }
              </div>
              <div>
                <div className="text-sm font-semibold leading-snug">{toast.msg}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
