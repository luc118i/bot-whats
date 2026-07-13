import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronRight, CheckCircle2, Smartphone, Users, Send, X, Loader2 } from 'lucide-react'
import { useCampanha, type CampanhaResumo } from '../../context/CampanhaContext'
import axios from 'axios'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Conta {
  id: number
  nome: string
  temSessao: boolean
  status: string
}

interface Contato {
  nome: string
  matricula: string
  celular: string | null
  base: string
  status: string
}

type Step = 'campanha' | 'conta' | 'contato' | 'enviando' | 'sucesso' | 'erro'

interface Props {
  open: boolean
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  finalizada:  'bg-blue-100 text-blue-700',
  pausada:     'bg-amber-100 text-amber-700',
  executando:  'bg-green-100 text-green-700',
  cancelada:   'bg-red-100 text-red-600',
}

// ─── Etapa 1: Campanha ───────────────────────────────────────────────────────

function StepCampanha({
  campanhas, selected, onSelect,
}: { campanhas: CampanhaResumo[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {campanhas.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma campanha disponível</p>
      )}
      {campanhas.map(c => (
        <button key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
            selected === c.id
              ? 'border-orange-400 bg-orange-50'
              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{c.nome}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{c.stats.enviados} enviados · {c.stats.total} total</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {c.status}
            </span>
            {selected === c.id && <CheckCircle2 size={16} className="text-orange-500" />}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Etapa 2: Conta ──────────────────────────────────────────────────────────

const CONTA_STATUS: Record<string, { label: string; color: string }> = {
  conectado:     { label: 'Conectada',     color: 'text-green-600' },
  aguardando_qr: { label: 'Conectando...', color: 'text-amber-500' },
  conectando:    { label: 'Conectando...', color: 'text-blue-500'  },
  erro:          { label: 'Erro',          color: 'text-red-500'   },
  idle:          { label: 'Sem sessão',    color: 'text-gray-400'  },
}

function StepConta({
  contas, selected, onSelect, loading,
}: { contas: Conta[]; selected: number | null; onSelect: (id: number) => void; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 size={22} className="animate-spin text-gray-400" />
    </div>
  )
  if (contas.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-8">
      Nenhuma conta encontrada.<br/>
      <span className="text-xs">Configure as contas em Configurações → Contas WhatsApp.</span>
    </p>
  )
  return (
    <div className="space-y-3">
      {contas.map(c => {
        const si       = CONTA_STATUS[c.status] ?? CONTA_STATUS.idle
        const ativa    = c.status === 'conectado'
        const disabled = !ativa
        return (
          <button key={c.id}
            onClick={() => ativa && onSelect(c.id)}
            disabled={disabled}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all ${
              disabled
                ? 'border-gray-100 opacity-40 cursor-not-allowed'
                : selected === c.id
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              selected === c.id ? 'bg-orange-100' :
              ativa ? 'bg-green-50' : 'bg-gray-100'
            }`}>
              <Smartphone size={18} className={
                selected === c.id ? 'text-orange-500' :
                ativa ? 'text-green-600' : 'text-gray-400'
              } />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-gray-800">{c.nome}</p>
              <p className={`text-xs font-medium ${si.color}`}>{si.label}</p>
            </div>
            {selected === c.id
              ? <CheckCircle2 size={18} className="text-orange-500 flex-shrink-0" />
              : ativa && <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
            }
          </button>
        )
      })}
      {contas.every(c => c.status !== 'conectado') && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-xs text-amber-700 font-medium">
            Nenhuma conta conectada. Vá em <strong>Configurações → Contas WhatsApp</strong> e conecte uma conta antes de enviar.
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Etapa 3: Contato ────────────────────────────────────────────────────────

function StepContato({
  selected, onSelect,
}: { selected: Contato | null; onSelect: (c: Contato) => void }) {
  const [busca, setBusca]       = useState('')
  const [todos, setTodos]       = useState<Contato[]>([])
  const [loading, setLoading]   = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega todos os contatos com celular na primeira abertura
  useEffect(() => {
    setLoading(true)
    axios.get('/api/contatos', { params: { per_page: 500, status: 'ALL' } })
      .then(r => setTodos((r.data.contatos ?? []).filter((c: Contato) => c.celular)))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false))
  }, [])

  // Filtra localmente com debounce leve
  const [filtrados, setFiltrados] = useState<Contato[]>([])
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const q = busca.toLowerCase().trim()
      setFiltrados(q
        ? todos.filter(c =>
            c.nome.toLowerCase().includes(q) ||
            c.matricula.toLowerCase().includes(q) ||
            (c.celular ?? '').includes(q)
          )
        : todos
      )
    }, 150)
  }, [busca, todos])

  const lista = filtrados.slice(0, 50)

  return (
    <div className="space-y-2">
      {/* Campo de busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar por nome ou matrícula..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {/* Lista de contatos */}
      <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        )}
        {!loading && lista.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum contato encontrado</p>
        )}
        {!loading && lista.map(c => (
          <button key={c.matricula}
            onClick={() => onSelect(c)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
              selected?.matricula === c.matricula
                ? 'bg-orange-50 border border-orange-200'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              selected?.matricula === c.matricula ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <Users size={13} className={selected?.matricula === c.matricula ? 'text-orange-500' : 'text-gray-400'} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{c.nome}</p>
              <p className="text-[11px] text-gray-400">Mat. {c.matricula} · {c.celular}</p>
            </div>
            {selected?.matricula === c.matricula && <CheckCircle2 size={14} className="text-orange-500 flex-shrink-0" />}
          </button>
        ))}
        {!loading && filtrados.length > 50 && (
          <p className="text-[11px] text-gray-400 text-center py-2">
            Mostrando 50 de {filtrados.length} — refine a busca para ver mais
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

const STEPS: Step[] = ['campanha', 'conta', 'contato']
const STEP_LABEL: Record<Step, string> = {
  campanha:  'Campanha',
  conta:     'Conta',
  contato:   'Destinatário',
  enviando:  '',
  sucesso:   '',
  erro:      '',
}

export function EnvioAvulsoModal({ open, onClose }: Props) {
  const { campanhas } = useCampanha()

  const [step, setStep]           = useState<Step>('campanha')
  const [campanhaId, setCampanhaId] = useState<string | null>(null)
  const [contas, setContas]       = useState<Conta[]>([])
  const [contasLoading, setContasLoading] = useState(false)
  const [contaId, setContaId]     = useState<number | null>(null)
  const [contato, setContato]     = useState<Contato | null>(null)
  const [erroMsg, setErroMsg]     = useState('')
  const enviandoRef = useRef(false) // impede duplo clique

  // Carrega contas ao abrir o modal
  useEffect(() => {
    if (!open) return
    setStep('campanha')
    setCampanhaId(null)
    setContaId(null)
    setContato(null)
    setErroMsg('')
    setContasLoading(true)
    axios.get('/api/contas')
      .then(r => setContas(r.data.contas ?? []))
      .catch(() => setContas([]))
      .finally(() => setContasLoading(false))
  }, [open])

  const stepIdx = STEPS.indexOf(step)
  const isFlowStep = stepIdx >= 0

  function canAdvance() {
    if (step === 'campanha') return !!campanhaId
    if (step === 'conta')    return !!contaId
    if (step === 'contato')  return !!contato
    return false
  }

  async function handleNext() {
    if (step === 'campanha') { setStep('conta'); return }
    if (step === 'conta')    { setStep('contato'); return }
    if (step === 'contato') {
      if (enviandoRef.current) return
      enviandoRef.current = true
      setStep('enviando')
      try {
        const res = await axios.post('/api/envio-avulso', {
          contaId,
          campanhaId,
          matricula: contato!.matricula,
        })
        if (res.data.ok) setStep('sucesso')
        else { setErroMsg(res.data.erro ?? 'Erro desconhecido.'); setStep('erro') }
      } catch (e: any) {
        setErroMsg(e.response?.data?.erro ?? e.message ?? 'Erro ao conectar.')
        setStep('erro')
      } finally {
        enviandoRef.current = false
      }
    }
  }

  const campanhaNome = campanhas.find(c => c.id === campanhaId)?.nome ?? ''
  const contaNome    = contas.find(c => c.id === contaId)?.nome ?? ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          {/* Card */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={   { scale: 0.96, opacity: 0, y: 8  }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Envio Avulso</h2>
                {isFlowStep && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Passo {stepIdx + 1} de {STEPS.length} — {STEP_LABEL[step]}
                  </p>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Progress dots */}
            {isFlowStep && (
              <div className="flex gap-2 px-6 pt-4">
                {STEPS.map((s, i) => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition-all ${
                    i <= stepIdx ? 'bg-orange-400' : 'bg-gray-100'
                  }`} />
                ))}
              </div>
            )}

            {/* Body */}
            <div className="px-6 py-4 min-h-[200px]">

              {step === 'campanha' && (
                <StepCampanha campanhas={campanhas} selected={campanhaId} onSelect={setCampanhaId} />
              )}

              {step === 'conta' && (
                <StepConta contas={contas} selected={contaId} onSelect={setContaId} loading={contasLoading} />
              )}

              {step === 'contato' && (
                <StepContato selected={contato} onSelect={setContato} />
              )}

              {step === 'enviando' && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 size={32} className="animate-spin text-orange-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Iniciando envio...</p>
                    <p className="text-xs text-gray-400 mt-1">Aguarde o WhatsApp conectar e enviar a mensagem</p>
                  </div>
                </div>
              )}

              {step === 'sucesso' && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                    <CheckCircle2 size={26} className="text-green-500" />
                  </div>
                  <p className="text-base font-bold text-gray-800">Envio iniciado!</p>
                  <p className="text-sm text-gray-500">
                    A mensagem para <strong>{contato?.nome}</strong> foi iniciada via <strong>{contaNome}</strong>.<br/>
                    Acompanhe o progresso nos logs.
                  </p>
                </div>
              )}

              {step === 'erro' && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                    <X size={26} className="text-red-500" />
                  </div>
                  <p className="text-base font-bold text-gray-800">Erro ao iniciar</p>
                  <p className="text-sm text-red-500">{erroMsg}</p>
                </div>
              )}
            </div>

            {/* Resumo selecionado (visível nos passos 2 e 3) */}
            {(step === 'conta' || step === 'contato') && (
              <div className="mx-6 mb-2 px-4 py-2.5 bg-gray-50 rounded-xl text-xs text-gray-500 flex gap-4">
                <span><strong className="text-gray-700">Campanha:</strong> {campanhaNome}</span>
                {step === 'contato' && contaId && (
                  <span><strong className="text-gray-700">Conta:</strong> {contaNome}</span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-gray-100">
              {isFlowStep && stepIdx > 0 && (
                <button
                  onClick={() => setStep(STEPS[stepIdx - 1])}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Voltar
                </button>
              )}

              {isFlowStep && (
                <button
                  disabled={!canAdvance()}
                  onClick={handleNext}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl transition-all ${
                    canAdvance()
                      ? 'hover:opacity-90'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{ background: canAdvance() ? '#F56600' : '#ccc' }}
                >
                  {step === 'contato' ? (
                    <><Send size={15} /> Enviar</>
                  ) : (
                    <>Próximo <ChevronRight size={15} /></>
                  )}
                </button>
              )}

              {(step === 'sucesso' || step === 'erro') && (
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ background: '#F56600' }}
                >
                  Fechar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
