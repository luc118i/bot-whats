import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Tag, Calendar, Users, Settings2, MessageSquare,
  ImageIcon, CheckCircle2, Eye, EyeOff, Upload, X, AlertCircle,
  Check, Info, ChevronRight, Save, Zap, Clock, FileText,
} from 'lucide-react'
import type { Page } from '../types'
import { SmartTextarea } from '../components/ui/SmartTextarea'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormModelo {
  texto: string
  previewOpen: boolean
}

interface FormData {
  nome: string
  descricao: string
  responsavel: string
  agendamento: 'imediato' | 'agendado'
  agendadoPara: string
  filtroBase: string
  filtroStatus: string
  filtroBaseOp: string[]
  delayMin: number
  delayMax: number
  modelos: FormModelo[]
  imagemBase64: string | null
  imagemNome: string | null
  imagemTipo: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface StepDef {
  id: string
  label: string
  sublabel: string
  icon: React.ElementType
  optional?: boolean
}

const STEPS: StepDef[] = [
  { id: 'identificacao', label: 'Identificação',        sublabel: 'Nome e descrição',          icon: Tag },
  { id: 'periodo',       label: 'Período',              sublabel: 'Quando executar',            icon: Calendar },
  { id: 'publico',       label: 'Público-alvo',         sublabel: 'Filtros de contatos',        icon: Users },
  { id: 'disparo',       label: 'Configuração',         sublabel: 'Delays e controles',         icon: Settings2 },
  { id: 'modelos',       label: 'Modelos de Mensagem',  sublabel: '5 variações obrigatórias',   icon: MessageSquare },
  { id: 'imagem',        label: 'Imagem',               sublabel: 'Opcional',                   icon: ImageIcon, optional: true },
  { id: 'revisao',       label: 'Revisão',              sublabel: 'Confirmar e criar',          icon: CheckCircle2 },
]

const INITIAL_FORM: FormData = {
  nome: '', descricao: '', responsavel: '',
  agendamento: 'imediato', agendadoPara: '',
  filtroBase: 'ALL', filtroStatus: 'PENDENTE', filtroBaseOp: [],
  delayMin: 15, delayMax: 45,
  modelos: Array(5).fill(null).map(() => ({ texto: '', previewOpen: false })),
  imagemBase64: null, imagemNome: null, imagemTipo: null,
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(i: number, f: FormData): string[] {
  const e: string[] = []
  if (i === 0 && !f.nome.trim()) e.push('Nome da campanha é obrigatório.')
  if (i === 1 && f.agendamento === 'agendado' && !f.agendadoPara) e.push('Informe a data/hora de agendamento.')
  if (i === 4) f.modelos.forEach((m, idx) => { if (!m.texto.trim()) e.push(`Modelo ${idx + 1} está vazio.`) })
  return e
}

function isComplete(i: number, f: FormData) {
  return validateStep(i, f).length === 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WaPreview({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g,   '<em>$1</em>')
    .replace(/\n/g, '<br />')
  return <span className="text-sm leading-relaxed text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />
}

function SectionCard({ title, description, icon: Icon, children, badge }: {
  title: string; description?: string; icon: React.ElementType; children: React.ReactNode; badge?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
            <Icon size={20} className="text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="px-8 py-6">{children}</div>
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-gray-300"
      {...rest}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all resize-none placeholder:text-gray-300"
    />
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function StepIdentificacao({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  return (
    <SectionCard title="Identificação da Campanha" description="Dê um nome claro para identificar esta campanha" icon={Tag}>
      <div className="space-y-5">
        <Field label="Nome da campanha" required hint="Ex: Informativo Julho 2026 — Tempo de Parada">
          <Input
            value={form.nome}
            onChange={e => set({ nome: e.target.value })}
            placeholder="Ex: Disparo Julho 2026"
          />
        </Field>
        <Field label="Descrição" hint="Contexto ou observações sobre esta campanha (opcional)">
          <Textarea
            value={form.descricao}
            onChange={e => set({ descricao: e.target.value })}
            placeholder="Contexto ou observações sobre esta campanha..."
          />
        </Field>
        <Field label="Responsável" hint="Nome de quem está criando/gerenciando esta campanha">
          <Input
            value={form.responsavel}
            onChange={e => set({ responsavel: e.target.value })}
            placeholder="Ex: Lucas Inácio"
          />
        </Field>
      </div>
    </SectionCard>
  )
}

function StepPeriodo({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  return (
    <SectionCard title="Período de Execução" description="Defina quando esta campanha será executada" icon={Calendar}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {[
            { v: 'imediato', label: 'Iniciar imediatamente', sub: 'O disparo começa assim que você iniciar', icon: Zap },
            { v: 'agendado', label: 'Agendar para depois',   sub: 'Escolha uma data e hora específica',      icon: Clock },
          ].map(({ v, label, sub, icon: Icon }) => (
            <button
              key={v}
              onClick={() => set({ agendamento: v as 'imediato' | 'agendado' })}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                form.agendamento === v
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${form.agendamento === v ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Icon size={18} />
              </div>
              <div>
                <div className={`font-semibold text-sm ${form.agendamento === v ? 'text-brand' : 'text-gray-700'}`}>{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
            </button>
          ))}
        </div>

        <AnimatePresence>
          {form.agendamento === 'agendado' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Field label="Data e hora" required>
                <Input
                  type="datetime-local"
                  value={form.agendadoPara}
                  onChange={e => set({ agendadoPara: e.target.value })}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SectionCard>
  )
}

function StepPublico({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  const motoristaBases = ['ALL', 'ATIVOS', 'INATIVOS']
  const statuses       = ['PENDENTE', 'FALHOU', 'TODOS']
  const baseLabel:   Record<string, string> = { ALL: 'Todos os motoristas', ATIVOS: 'Apenas ativos', INATIVOS: 'Apenas inativos' }
  const statusLabel: Record<string, string> = { PENDENTE: 'Só pendentes', FALHOU: 'Que falharam', TODOS: 'Todos os status' }

  const [basesOp,  setBasesOp]  = useState<string[]>([])
  const [contagem, setContagem] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  // Carrega lista de bases disponíveis uma vez
  useEffect(() => {
    fetch('/api/contatos?page=1&per_page=1')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.bases)) setBasesOp(d.bases) })
      .catch(() => {})
  }, [])

  // Recalcula contagem sempre que filtros mudam (sempre status=ALL — nova campanha começa do zero)
  useEffect(() => {
    setLoadingCount(true)

    async function fetchTotal(base: string) {
      const r = await fetch(`/api/contatos?page=1&per_page=1&status=ALL&base=${base}`)
      const d = await r.json()
      return (d.total as number) ?? 0
    }

    const targets = form.filtroBaseOp.length > 0 ? form.filtroBaseOp : ['ALL']
    Promise.all(targets.map(fetchTotal))
      .then(totais => setContagem(totais.reduce((a, b) => a + b, 0)))
      .catch(() => setContagem(null))
      .finally(() => setLoadingCount(false))
  }, [form.filtroBaseOp])

  function toggleBase(b: string) {
    set({
      filtroBaseOp: form.filtroBaseOp.includes(b)
        ? form.filtroBaseOp.filter(x => x !== b)
        : [...form.filtroBaseOp, b],
    })
  }

  return (
    <SectionCard
      title="Público-alvo"
      description="Defina quais contatos receberão esta campanha"
      icon={Users}
      badge={
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
          contagem === null || loadingCount
            ? 'bg-gray-100 text-gray-400'
            : contagem === 0
            ? 'bg-red-50 text-red-500'
            : 'bg-brand/10 text-brand'
        }`}>
          <Users size={14} />
          {loadingCount ? '...' : contagem === null ? '—' : `${contagem.toLocaleString('pt-BR')} contatos`}
        </div>
      }
    >
      <div className="space-y-6">

        <Field label="Base de contatos">
          <div className="grid grid-cols-3 gap-3">
            {motoristaBases.map(b => (
              <button key={b} onClick={() => set({ filtroBase: b })}
                className={`p-4 rounded-xl border-2 text-sm font-medium text-center transition-all ${form.filtroBase === b ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {baseLabel[b]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Base operacional" hint={form.filtroBaseOp.length === 0 ? 'Nenhuma selecionada = todas as bases' : `${form.filtroBaseOp.length} base(s) selecionada(s)`}>
          {basesOp.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">Carregando bases...</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {basesOp.map(b => {
                const sel = form.filtroBaseOp.includes(b)
                return (
                  <button
                    key={b}
                    onClick={() => toggleBase(b)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-xs font-mono font-bold transition-all ${
                      sel ? 'border-brand bg-brand text-white' : 'border-gray-200 text-gray-500 hover:border-brand/40 hover:text-brand'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
              {form.filtroBaseOp.length > 0 && (
                <button
                  onClick={() => set({ filtroBaseOp: [] })}
                  className="px-3 py-1.5 rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-red-300 hover:text-red-400 transition-all"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
        </Field>

        <Field label="Filtro de status">
          <div className="grid grid-cols-3 gap-3">
            {statuses.map(s => (
              <button key={s} onClick={() => set({ filtroStatus: s })}
                className={`p-4 rounded-xl border-2 text-sm font-medium text-center transition-all ${form.filtroStatus === s ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </Field>

        {contagem !== null && !loadingCount && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
            contagem === 0
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <Users size={15} className="flex-shrink-0" />
            <span>
              {contagem === 0
                ? 'Nenhum contato encontrado com esses filtros.'
                : <><strong>{contagem.toLocaleString('pt-BR')} contatos</strong> serão alcançados por esta campanha.</>
              }
            </span>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function StepDisparo({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  const avgDelay = (form.delayMin + form.delayMax) / 2
  const estimMins = Math.round((335 * avgDelay) / 60)

  return (
    <SectionCard title="Configuração do Disparo" description="Controle a velocidade e o comportamento do envio" icon={Settings2}>
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <Field label="Delay mínimo (segundos)" hint="Tempo mínimo entre cada envio">
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={120} value={form.delayMin}
                onChange={e => set({ delayMin: +e.target.value, delayMax: Math.max(+e.target.value, form.delayMax) })}
                className="flex-1 accent-brand" />
              <span className="w-10 text-center font-bold text-brand text-sm">{form.delayMin}s</span>
            </div>
          </Field>
          <Field label="Delay máximo (segundos)" hint="Tempo máximo entre cada envio">
            <div className="flex items-center gap-3">
              <input type="range" min={form.delayMin} max={300} value={form.delayMax}
                onChange={e => set({ delayMax: +e.target.value })}
                className="flex-1 accent-brand" />
              <span className="w-10 text-center font-bold text-brand text-sm">{form.delayMax}s</span>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Delay médio',   value: `${avgDelay.toFixed(0)}s` },
            { label: 'Estimativa (335)',  value: `~${estimMins} min` },
            { label: 'Velocidade', value: `~${(60 / avgDelay).toFixed(1)}/min` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-lg font-extrabold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>Delays maiores reduzem o risco de banimento por spam. Recomendamos no mínimo 15s entre envios.</span>
        </div>
      </div>
    </SectionCard>
  )
}

function ModeloCard({ index, modelo, onChange }: {
  index: number; modelo: FormModelo; onChange: (m: FormModelo) => void
}) {
  const MAX = 1200
  const count = modelo.texto.length
  const done  = modelo.texto.trim().length > 0

  const previewText = modelo.texto
    .replace(/\$\{nome\}/g, 'João Silva')
    .replace(/\$\{matricula\}/g, '12345')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border-2 overflow-hidden transition-all ${done ? 'border-green-200' : 'border-gray-200'}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 ${done ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
            {done ? <Check size={13} /> : index + 1}
          </div>
          <span className="font-semibold text-sm text-gray-700">Modelo {index + 1}</span>
          {!done && <span className="text-xs text-red-400 font-medium">obrigatório</span>}
        </div>
        <button
          onClick={() => onChange({ ...modelo, previewOpen: !modelo.previewOpen })}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg hover:bg-white/70"
        >
          {modelo.previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
          {modelo.previewOpen ? 'Ocultar' : 'Preview'}
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3 bg-white">
        {/* Variables */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Variáveis:</span>
            {['${nome}', '${matricula}'].map(v => (
              <code key={v} className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-md font-mono" title="Digite $ no editor para sugestões">{v}</code>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-gray-300 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">$</kbd>
              variáveis
            </span>
            <span className="text-[11px] text-gray-300 flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">:</kbd>
              emojis
            </span>
          </div>
        </div>

        <SmartTextarea
          value={modelo.texto}
          onChange={texto => onChange({ ...modelo, texto })}
          placeholder={`Olá, *\${nome}* — Matrícula: \${matricula} 👋\n\nSua mensagem aqui...\n\nDica: digite $ para inserir variáveis, ou : para emojis`}
          rows={6}
          maxLength={MAX}
          className={!done
            ? ''
            : 'border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100'}
        />

        <div className={`text-right text-xs font-medium ${count > MAX * 0.85 ? 'text-amber-500' : 'text-gray-300'}`}>
          {count} / {MAX}
        </div>

        {/* Preview */}
        <AnimatePresence>
          {modelo.previewOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl overflow-hidden border border-[#d9d9d9]">
                <div className="bg-[#075E54] px-4 py-2 text-white text-xs font-medium">Preview WhatsApp</div>
                <div className="bg-[#ECE5DD] p-4">
                  {modelo.texto.trim() ? (
                    <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-sm">
                      <WaPreview text={previewText} />
                      <div className="text-right text-[10px] text-gray-400 mt-2">10:30 ✓✓</div>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-400 py-4">Escreva algo para ver o preview...</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function StepModelos({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  const done = form.modelos.filter(m => m.texto.trim()).length

  function updateModelo(i: number, m: FormModelo) {
    const next = [...form.modelos]
    next[i] = m
    set({ modelos: next })
  }

  return (
    <SectionCard
      title="Modelos de Mensagem"
      description="5 variações do texto — o bot alterna automaticamente para reduzir detecção de spam"
      icon={MessageSquare}
      badge={
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${done === 5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {done === 5 ? <Check size={14} /> : <AlertCircle size={14} />}
          {done}/5 preenchidos
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            Use <code className="font-mono bg-blue-100 px-1 rounded">${'{nome}'}</code> e <code className="font-mono bg-blue-100 px-1 rounded">${'{matricula}'}</code> para personalizar cada mensagem.
            O sistema sorteia um modelo diferente a cada envio, combinado com um CTA e rodapé dos Templates.
          </p>
        </div>

        {form.modelos.map((m, i) => (
          <ModeloCard key={i} index={i} modelo={m} onChange={v => updateModelo(i, v)} />
        ))}
      </div>
    </SectionCard>
  )
}

function StepImagem({ form, set }: { form: FormData; set: (f: Partial<FormData>) => void }) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error,   setError]    = useState<string | null>(null)

  const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm']
  const ALLOWED = [...ALLOWED_IMG, ...ALLOWED_VIDEO]
  const MAX_MB_IMG   = 5
  const MAX_MB_VIDEO = 16

  const processFile = useCallback((file: File) => {
    setError(null)
    if (!ALLOWED.includes(file.type)) { setError('Formato inválido. Use PNG, JPG, WEBP ou vídeo MP4/MOV/WEBM.'); return }
    const isVideo = file.type.startsWith('video/')
    const maxMb = isVideo ? MAX_MB_VIDEO : MAX_MB_IMG
    if (file.size > maxMb * 1024 * 1024) { setError(`Arquivo muito grande. Limite: ${maxMb}MB.`); return }
    const reader = new FileReader()
    reader.onload = e => set({ imagemBase64: e.target?.result as string, imagemNome: file.name, imagemTipo: file.type })
    reader.readAsDataURL(file)
  }, [set])

  const isVideoSelecionado = form.imagemTipo?.startsWith('video/') ?? false

  return (
    <SectionCard
      title="Mídia da Campanha"
      description="Imagem ou vídeo enviado antes da mensagem de texto — opcional"
      icon={ImageIcon}
      badge={<span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl font-medium">Opcional</span>}
    >
      {form.imagemBase64 ? (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-green-50">
            {isVideoSelecionado ? (
              <video src={form.imagemBase64} controls className="w-full max-h-72 object-contain" />
            ) : (
              <img src={form.imagemBase64} alt={form.imagemNome ?? ''} className="w-full max-h-72 object-contain" />
            )}
            <button
              onClick={() => set({ imagemBase64: null, imagemNome: null, imagemTipo: null })}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-500 hover:text-red-500 hover:shadow-lg transition-all"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <Check size={15} />
            <span className="font-medium">{form.imagemNome}</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 py-16 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
            dragging ? 'border-brand bg-brand/5 scale-[1.01]' : 'border-gray-200 hover:border-brand/50 hover:bg-gray-50'
          }`}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${dragging ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
            <Upload size={28} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">Arraste a imagem ou vídeo aqui</p>
            <p className="text-sm text-gray-400 mt-1">ou clique para selecionar</p>
            <p className="text-xs text-gray-300 mt-2">PNG, JPG, WEBP (5MB) • MP4, MOV, WEBM ({MAX_MB_VIDEO}MB)</p>
          </div>
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="mt-4 flex items-start gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-500">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <span>Se nenhuma imagem for enviada, o sistema usará o informativo padrão já configurado no bot.</span>
      </div>
    </SectionCard>
  )
}

function RevisaoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}

function StepRevisao({ form, onGoTo }: { form: FormData; onGoTo: (i: number) => void }) {
  const done = form.modelos.filter(m => m.texto.trim()).length
  const avgDelay = (form.delayMin + form.delayMax) / 2
  const FILTRO_LABEL: Record<string, string> = { ALL: 'Todos', ATIVOS: 'Ativos', INATIVOS: 'Inativos' }
  const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendentes', FALHOU: 'Falhas', TODOS: 'Todos' }

  const sections = [
    { label: 'Identificação', step: 0, items: [
      { label: 'Nome',        value: form.nome || '—' },
      { label: 'Descrição',   value: form.descricao || '—' },
      { label: 'Responsável', value: form.responsavel || '—' },
    ]},
    { label: 'Período', step: 1, items: [
      { label: 'Agendamento', value: form.agendamento === 'imediato' ? 'Iniciar imediatamente' : new Date(form.agendadoPara).toLocaleString('pt-BR') },
    ]},
    { label: 'Público-alvo', step: 2, items: [
      { label: 'Base',              value: FILTRO_LABEL[form.filtroBase] ?? form.filtroBase },
      { label: 'Base operacional',  value: form.filtroBaseOp.length > 0 ? form.filtroBaseOp.join(', ') : 'Todas' },
      { label: 'Status',            value: STATUS_LABEL[form.filtroStatus] ?? form.filtroStatus },
    ]},
    { label: 'Configuração', step: 3, items: [
      { label: 'Delay',       value: `${form.delayMin}s – ${form.delayMax}s` },
      { label: 'Velocidade',  value: `~${(60 / avgDelay).toFixed(1)} msg/min` },
    ]},
    { label: 'Modelos', step: 4, items: [
      { label: 'Preenchidos', value: `${done}/5` },
    ]},
    { label: 'Imagem', step: 5, items: [
      { label: 'Arquivo', value: form.imagemNome ?? 'Padrão do sistema' },
    ]},
  ]

  return (
    <SectionCard title="Revisão Final" description="Confirme todas as configurações antes de criar a campanha" icon={CheckCircle2}>
      <div className="space-y-4">
        {sections.map(({ label, step, items }) => (
          <div key={label} className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
              <span className="font-semibold text-sm text-gray-700">{label}</span>
              <button onClick={() => onGoTo(step)} className="text-xs text-brand hover:text-brand/70 font-medium">Editar</button>
            </div>
            <div className="px-5 divide-y divide-gray-50">
              {items.map(({ label: l, value }) => (
                <RevisaoItem key={l} label={l} value={value} />
              ))}
            </div>
          </div>
        ))}

        {done < 5 && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle size={16} />
            <span><strong>{5 - done} modelo(s)</strong> ainda {5 - done === 1 ? 'está vazio' : 'estão vazios'}. Volte e preencha antes de criar.</span>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Step Sidebar ─────────────────────────────────────────────────────────────

function StepSidebar({ current, visited, form, onGoTo }: {
  current: number; visited: Set<number>; form: FormData; onGoTo: (i: number) => void
}) {
  return (
    <nav className="space-y-1">
      {STEPS.map((step, i) => {
        const done      = visited.has(i) && isComplete(i, form)
        const active    = i === current
        const clickable = visited.has(i) || i === current

        return (
          <button
            key={step.id}
            onClick={() => clickable && onGoTo(i)}
            disabled={!clickable}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${
              active    ? 'bg-brand text-white shadow-md shadow-brand/20'
              : done    ? 'text-gray-700 hover:bg-gray-100'
              : clickable ? 'text-gray-500 hover:bg-gray-100'
              : 'text-gray-300 cursor-default'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
              active ? 'bg-white/20 text-white'
              : done  ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 text-gray-400'
            }`}>
              {done && !active ? <Check size={13} /> : <step.icon size={14} />}
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-semibold truncate ${active ? 'text-white' : ''}`}>{step.label}</div>
              <div className={`text-xs truncate ${active ? 'text-white/70' : 'text-gray-400'}`}>{step.sublabel}</div>
            </div>
            {step.optional && !active && (
              <span className={`text-[10px] ml-auto flex-shrink-0 ${active ? 'text-white/60' : 'text-gray-300'}`}>opcional</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface NovaCampanhaProps {
  onNavigate: (p: Page) => void
  editCampanhaId?: string | null
}

async function blobParaDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function NovaCampanha({ onNavigate, editCampanhaId }: NovaCampanhaProps) {
  const qc = useQueryClient()
  const isEdit = !!editCampanhaId
  const [step,    setStep]    = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [form,    setFormRaw] = useState<FormData>(INITIAL_FORM)
  const [errors,  setErrors]  = useState<string[]>([])
  const [saving,  setSaving]  = useState(false)
  const [carregando, setCarregando] = useState(isEdit)

  function set(partial: Partial<FormData>) {
    setFormRaw(f => ({ ...f, ...partial }))
  }

  // Modo edição: carrega os dados da campanha existente e pré-preenche o formulário
  useEffect(() => {
    if (!editCampanhaId) return
    let cancelado = false

    async function carregar() {
      try {
        const r = await fetch(`/api/campanhas/${editCampanhaId}`)
        const { campanha: c } = await r.json()
        if (!c || cancelado) return

        let imagemBase64: string | null = null
        let imagemNome: string | null = null
        let imagemTipo: string | null = null
        if (c.imagem) {
          const ri = await fetch(`/api/campanha/imagem?campanha=${editCampanhaId}`)
          const blob = await ri.blob()
          imagemBase64 = await blobParaDataUri(blob)
          imagemTipo = blob.type
          const extPorTipo: Record<string, string> = {
            'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/png': '.png',
            'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
          }
          imagemNome = 'midia-atual' + (extPorTipo[blob.type] || '.png')
        }

        if (cancelado) return
        const modelosTextos: string[] = Array.isArray(c.modelos) ? c.modelos : []
        setFormRaw({
          nome:         c.nome ?? '',
          descricao:    c.descricao ?? '',
          responsavel:  c.responsavel ?? '',
          agendamento:  c.agendadoPara ? 'agendado' : 'imediato',
          agendadoPara: c.agendadoPara ?? '',
          filtroBase:   c.config?.filtroBase   ?? 'ALL',
          filtroStatus: c.config?.filtroStatus ?? 'PENDENTE',
          filtroBaseOp: c.config?.filtroBaseOp ?? [],
          delayMin:     c.config?.delayMin ?? 15,
          delayMax:     c.config?.delayMax ?? 45,
          modelos: Array(5).fill(null).map((_, i) => ({ texto: modelosTextos[i] ?? '', previewOpen: false })),
          imagemBase64, imagemNome, imagemTipo,
        })
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [editCampanhaId])

  function goTo(i: number) {
    setErrors([])
    setStep(i)
    setVisited(v => new Set([...v, i]))
  }

  function next() {
    const errs = validateStep(step, form)
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    const nextStep = Math.min(step + 1, STEPS.length - 1)
    goTo(nextStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function prev() {
    setErrors([])
    goTo(Math.max(step - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isLast = step === STEPS.length - 1

  async function criar(rascunho = false) {
    const errs = validateStep(4, form) // always validate models
    if (!form.nome.trim()) errs.push('Nome da campanha é obrigatório.')
    if (errs.length) { setErrors(errs); return }

    setSaving(true)
    try {
      const configBase = {
        filtroBase:     form.filtroBase,
        filtroBaseOp:   form.filtroBaseOp,
        filtroStatus:   form.filtroStatus,
        modeloMensagem: 'campanha',
        delayMin:       form.delayMin,
        delayMax:       form.delayMax,
      }

      if (isEdit) {
        const payload = {
          nome:         form.nome.trim(),
          descricao:    form.descricao.trim(),
          responsavel:  form.responsavel.trim() || 'Sistema',
          agendadoPara: form.agendamento === 'agendado' ? form.agendadoPara : null,
          config:       configBase,
          modelos:      form.modelos.map(m => m.texto),
          imagemBase64: form.imagemBase64,
        }
        const r = await fetch(`/api/campanhas/${editCampanhaId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const data = await r.json()
        if (!data.ok) throw new Error(data.erro ?? 'Erro ao salvar alterações.')
      } else {
        const payload = {
          nome:         form.nome.trim(),
          descricao:    form.descricao.trim(),
          responsavel:  form.responsavel.trim() || 'Sistema',
          agendadoPara: form.agendamento === 'agendado' ? form.agendadoPara : null,
          status:       rascunho ? 'rascunho' : 'agendada',
          config:       configBase,
          modelos:      form.modelos.map(m => m.texto),
          imagemBase64: form.imagemBase64,
        }
        const r = await fetch('/api/campanhas', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const data = await r.json()
        if (!data.ok) throw new Error(data.erro ?? 'Erro ao criar.')

        // Se imediato, inicia o bot automaticamente
        if (!rascunho && form.agendamento === 'imediato') {
          const ri = await fetch(`/api/campanhas/${data.campanha.id}/iniciar`, { method: 'POST' })
          const di = await ri.json()
          if (!di.ok) throw new Error(di.erro ?? 'Campanha criada mas não foi possível iniciar.')
        }
      }

      qc.invalidateQueries({ queryKey: ['campanhas'] })
      qc.invalidateQueries({ queryKey: ['campanha-ativa'] })
      onNavigate('campanhas')
    } catch (e: any) {
      setErrors([e.message ?? 'Erro ao salvar campanha.'])
    } finally {
      setSaving(false)
    }
  }

  const stepContent: React.ReactNode = (() => {
    switch (step) {
      case 0: return <StepIdentificacao form={form} set={set} />
      case 1: return <StepPeriodo       form={form} set={set} />
      case 2: return <StepPublico       form={form} set={set} />
      case 3: return <StepDisparo       form={form} set={set} />
      case 4: return <StepModelos       form={form} set={set} />
      case 5: return <StepImagem        form={form} set={set} />
      case 6: return <StepRevisao       form={form} onGoTo={goTo} />
      default: return null
    }
  })()

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Carregando campanha...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('campanhas')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft size={16} />
              Campanhas
            </button>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-sm font-semibold text-gray-900">{isEdit ? 'Editar Campanha' : 'Nova Campanha'}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress pill */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : visited.has(i) && isComplete(i, form) ? 'w-2 bg-green-400' : 'w-2 bg-gray-300'}`} />
                ))}
              </div>
              <span className="text-xs font-medium text-gray-500 ml-1">{step + 1}/{STEPS.length}</span>
            </div>
            {!isEdit && (
              <button
                onClick={() => criar(true)}
                disabled={!form.nome.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Save size={14} /> Salvar rascunho
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <div>
                <h1 className="text-lg font-extrabold text-gray-900">{isEdit ? 'Editar Campanha' : 'Nova Campanha'}</h1>
                <p className="text-sm text-gray-400 mt-0.5">{isEdit ? 'Altere os dados desta campanha' : 'Configure e crie sua campanha de disparo'}</p>
              </div>
              <StepSidebar current={step} visited={visited} form={form} onGoTo={goTo} />
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                {stepContent}
              </motion.div>
            </AnimatePresence>

            {/* Errors */}
            <AnimatePresence>
              {errors.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <ul className="space-y-1">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => step === 0 ? onNavigate('campanhas') : prev()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={15} />
                {step === 0 ? 'Cancelar' : 'Anterior'}
              </button>

              {isLast ? (
                <button
                  onClick={() => criar(false)}
                  disabled={saving || form.modelos.some(m => !m.texto.trim())}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-sm shadow-brand/30"
                  style={{ background: '#F56600' }}
                >
                  {saving ? 'Salvando...' : <><FileText size={15} /> {isEdit ? 'Salvar Alterações' : 'Criar Campanha'}</>}
                </button>
              ) : (
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all shadow-sm shadow-brand/30"
                  style={{ background: '#F56600' }}
                >
                  Próximo <ChevronRight size={15} />
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
