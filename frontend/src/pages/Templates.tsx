import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Quote, Pencil, Check, X, RotateCcw, Plus, Trash2, Info } from 'lucide-react'

interface Templates {
  ctas:    string[]
  rodapes: string[]
}

const FALLBACK: Templates = {
  ctas: [
    `👇 *Responda OK para confirmar que recebeu este informativo.*`,
    `📩 *Confirme o recebimento respondendo CIENTE.* ✅`,
    `👇 Por favor, responda *CONFIRMO* para registrarmos seu recebimento.`,
    `✅ _Responda com *RECEBI* para confirmarmos sua ciência._`,
    `💬 Nos retorne com *CIENTE* assim que possível. Obrigado!`,
  ],
  rodapes: [
    `_Atenciosamente, Equipe de Monitoramento — Viação Catedral_ 🚌`,
    `_Obrigado pela atenção! Equipe de Monitoramento Catedral._ 🤝`,
    `_Contamos com sua colaboração. Equipe de Monitoramento Catedral._ 🙏`,
    `_Agradecemos a compreensão. Equipe de Monitoramento — Catedral._ ✅`,
    `_Bom trabalho! Equipe de Monitoramento Catedral._ 💪`,
  ],
}

async function fetchTemplates(): Promise<Templates> {
  try {
    const r = await fetch('/api/templates')
    if (!r.ok) return FALLBACK
    const data = await r.json()
    if (!Array.isArray(data.ctas) || !Array.isArray(data.rodapes)) return FALLBACK
    return data
  } catch (_) {
    return FALLBACK
  }
}

async function saveTemplates(data: Templates): Promise<Templates> {
  const r = await fetch('/api/templates', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  })
  return r.json()
}

// Renderiza *negrito*, _itálico_ como preview visual simples
function WhatsAppPreview({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g,   '<em>$1</em>')
    .replace(/\n/g, '<br/>')
  return (
    <span
      className="text-sm text-gray-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ItemEditor({
  value,
  index,
  onSave,
  onDelete,
  canDelete,
}: {
  value: string
  index: number
  onSave: (v: string) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  function save() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') cancel()
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save() }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
    >
      <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {index + 1}
      </span>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              rows={3}
              className="w-full text-sm border border-brand rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand/20 resize-none font-mono"
            />
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Info size={11} />
              <span>Use *negrito*, _itálico_. Ctrl+Enter para salvar.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                <Check size={12} /> Salvar
              </button>
              <button
                onClick={cancel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={12} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <WhatsAppPreview text={value} />
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => { setDraft(value); setEditing(true) }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-brand/10 transition-colors"
                title="Editar"
              >
                <Pencil size={13} />
              </button>
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Section({
  title,
  icon: Icon,
  description,
  items,
  onUpdate,
  onAdd,
}: {
  title: string
  icon: React.ElementType
  description: string
  items: string[]
  onUpdate: (items: string[]) => void
  onAdd: () => void
}) {
  function save(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onUpdate(next)
  }

  function remove(index: number) {
    onUpdate(items.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
            <Icon size={18} className="text-brand" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand text-xs font-medium rounded-lg hover:bg-brand/20 transition-colors"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      <div className="p-4 space-y-2">
        <AnimatePresence>
          {items.map((item, i) => (
            <ItemEditor
              key={i}
              value={item}
              index={i}
              onSave={v => save(i, v)}
              onDelete={() => remove(i)}
              canDelete={items.length > 1}
            />
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhum item. Clique em Adicionar.
          </div>
        )}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [toast, setToast] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn:  fetchTemplates,
  })

  const mutation = useMutation({
    mutationFn: saveTemplates,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setToast('Templates salvos com sucesso!')
      setTimeout(() => setToast(null), 3000)
    },
  })

  const [local, setLocal] = useState<Templates | null>(null)
  const current = local ?? data ?? { ctas: [], rodapes: [] }

  function updateCtas(ctas: string[]) {
    const next = { ...current, ctas }
    setLocal(next)
    mutation.mutate(next)
  }

  function updateRodapes(rodapes: string[]) {
    const next = { ...current, rodapes }
    setLocal(next)
    mutation.mutate(next)
  }

  function addCta() {
    updateCtas([...current.ctas, '✅ Nova chamada para ação.'])
  }

  function addRodape() {
    updateRodapes([...current.rodapes, '_Nova assinatura — Viação Catedral_ 🚌'])
  }

  async function resetDefaults() {
    await fetch('/api/templates', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ _reset: true }),
    })
    setLocal(null)
    qc.invalidateQueries({ queryKey: ['templates'] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Carregando templates...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Templates de Mensagem</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            CTAs e rodapés sorteados aleatoriamente em cada disparo
          </p>
        </div>
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          title="Restaurar padrões originais"
        >
          <RotateCcw size={13} /> Restaurar padrões
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <Info size={15} className="flex-shrink-0 mt-0.5" />
        <p>
          A cada envio, o bot sorteia <strong>1 CTA</strong> e <strong>1 Rodapé</strong> independentemente,
          combinados com um dos modelos de corpo da campanha. Quanto mais variações, menor a chance de
          detecção de envio em massa pelo WhatsApp.
        </p>
      </div>

      <Section
        title="Chamadas para Ação (CTA)"
        icon={MessageSquare}
        description={`${current.ctas.length} variações • sorteada 1 por envio`}
        items={current.ctas}
        onUpdate={updateCtas}
        onAdd={addCta}
      />

      <Section
        title="Rodapés / Assinaturas"
        icon={Quote}
        description={`${current.rodapes.length} variações • sorteado 1 por envio`}
        items={current.rodapes}
        onUpdate={updateRodapes}
        onAdd={addRodape}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 z-50"
          >
            <Check size={14} className="text-green-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
