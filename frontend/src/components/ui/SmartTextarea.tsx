import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete'
import type { ItemComponentProps } from '@webscopeio/react-textarea-autocomplete'
import './SmartTextarea.css'

// ─── Shared item type ─────────────────────────────────────────────────────────

interface AutoItem {
  name: string
  char?: string
  label?: string
  example?: string
  tags?: string[]
}

// ─── Variables trigger ($) ────────────────────────────────────────────────────

const VARIABLES: AutoItem[] = [
  { name: 'nome',      label: 'Nome do motorista', example: 'João Silva' },
  { name: 'matricula', label: 'Matrícula',          example: '12345' },
]

function VariableItem({ entity }: ItemComponentProps<AutoItem>) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <code className="text-xs font-mono bg-brand/10 text-brand px-2 py-0.5 rounded-md">{`\${${entity.name}}`}</code>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-800">{entity.label}</div>
        <div className="text-[11px] text-gray-400">ex: {entity.example}</div>
      </div>
    </div>
  )
}

// ─── Emoji trigger (:) ───────────────────────────────────────────────────────

const EMOJIS: { name: string; char: string; tags: string[] }[] = [
  { name: 'onibus',      char: '🚌', tags: ['onibus', 'bus', 'catedral', 'veiculo'] },
  { name: 'atencao',     char: '⚠️',  tags: ['atencao', 'aviso', 'alerta', 'warning'] },
  { name: 'ok',          char: '✅',  tags: ['ok', 'certo', 'check', 'confirmar'] },
  { name: 'erro',        char: '❌',  tags: ['erro', 'nao', 'cancelar', 'falhou'] },
  { name: 'oi',          char: '👋',  tags: ['oi', 'ola', 'saudacao'] },
  { name: 'lista',       char: '📋',  tags: ['lista', 'prancheta', 'clipboard'] },
  { name: 'chave',       char: '🔑',  tags: ['chave', 'key', 'desligar'] },
  { name: 'relogio',     char: '⏱️',  tags: ['relogio', 'tempo', 'timer', 'minutos'] },
  { name: 'seta_baixo',  char: '👇',  tags: ['seta', 'abaixo', 'baixo', 'olhe'] },
  { name: 'carta',       char: '📩',  tags: ['carta', 'email', 'mensagem', 'envelope'] },
  { name: 'estrela',     char: '⭐',  tags: ['estrela', 'star', 'destaque'] },
  { name: 'megafone',    char: '📢',  tags: ['megafone', 'aviso', 'anuncio'] },
  { name: 'numero1',     char: '1️⃣',  tags: ['um', 'numero', '1', 'primeiro'] },
  { name: 'numero2',     char: '2️⃣',  tags: ['dois', 'numero', '2', 'segundo'] },
  { name: 'numero3',     char: '3️⃣',  tags: ['tres', 'numero', '3', 'terceiro'] },
  { name: 'aperto',      char: '🤝',  tags: ['aperto', 'obrigado', 'parceria'] },
  { name: 'oracao',      char: '🙏',  tags: ['oracao', 'obrigado', 'por_favor'] },
  { name: 'forca',       char: '💪',  tags: ['forca', 'forte', 'garra'] },
  { name: 'balao',       char: '💬',  tags: ['balao', 'chat', 'conversa', 'responda'] },
  { name: 'gps',         char: '📍',  tags: ['gps', 'local', 'localizacao', 'ponto'] },
  { name: 'celular',     char: '📱',  tags: ['celular', 'whatsapp', 'telefone'] },
  { name: 'documento',   char: '📄',  tags: ['documento', 'pdf', 'arquivo', 'relatorio'] },
  { name: 'calendario',  char: '📅',  tags: ['calendario', 'data', 'dia', 'agenda'] },
  { name: 'cco',         char: '🎛️',  tags: ['cco', 'central', 'controle'] },
]

function EmojiItem({ entity }: ItemComponentProps<AutoItem>) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="text-lg leading-none">{entity.char}</span>
      <span className="text-xs text-gray-500">:{entity.name}:</span>
    </div>
  )
}

// ─── Shared dropdown styles ───────────────────────────────────────────────────

const listStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  overflow: 'hidden',
  zIndex: 9999,
  minWidth: '220px',
  maxHeight: '220px',
  overflowY: 'auto',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SmartTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
  maxLength?: number
}

export function SmartTextarea({ value, onChange, placeholder, rows = 6, className = '', maxLength }: SmartTextareaProps) {
  return (
    <ReactTextareaAutocomplete<AutoItem>
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className={`w-full text-sm border rounded-xl px-4 py-3 outline-none resize-none transition-all font-mono leading-relaxed
        border-gray-200 focus:border-brand focus:ring-2 focus:ring-brand/10 ${className}`}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      listStyle={listStyle}
      loadingComponent={() => <div className="px-3 py-2 text-xs text-gray-400">Carregando...</div>}
      trigger={{
        '$': {
          dataProvider: (token: string) => {
            const q = token.toLowerCase()
            return VARIABLES.filter(v =>
              v.name.includes(q) || (v.label ?? '').toLowerCase().includes(q)
            )
          },
          component: VariableItem,
          output: (item: AutoItem) => `\${${item.name}}`,
        },
        ':': {
          dataProvider: (token: string) => {
            if (!token) return EMOJIS.slice(0, 8)
            const q = token.toLowerCase()
            return EMOJIS.filter(e =>
              e.name.includes(q) || (e.tags ?? []).some((t: string) => t.includes(q))
            ).slice(0, 10)
          },
          component: EmojiItem,
          output: (item: AutoItem) => item.char ?? '',
        },
      }}
    />
  )
}
