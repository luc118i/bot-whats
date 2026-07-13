import { useState, useEffect, useCallback } from 'react';
import { useCampanha } from '../context/CampanhaContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, PhoneOff, MessageSquareOff,
  XCircle, RefreshCw, ChevronDown, Image, Phone, Pencil, X, Save, UserPlus,
} from 'lucide-react';
import axios from 'axios';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Contato {
  nome: string;
  matricula: string;
  celular: string | null;
  base: string;
  status: string;
  statusLabel: string;
  enviadoEm: string | null;
  conta: number | null;
  temPrint: boolean;
}

interface ApiResponse {
  contatos: Contato[];
  total: number;
  page: number;
  totalPages: number;
  bases: string[];
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'ALL',          label: 'Todos os status' },
  { value: 'ENVIADO',      label: 'Enviado' },
  { value: 'PENDENTE',     label: 'Pendente' },
  { value: 'SEM_NUMERO',   label: 'Sem número' },
  { value: 'SEM_WHATSAPP', label: 'Sem WhatsApp' },
  { value: 'FALHOU',       label: 'Falhou' },
  { value: 'PROCESSANDO',  label: 'Processando' },
  { value: 'DUPLICADO',    label: 'Duplicado' },
];

const STATUS_META: Record<string, { color: string; bg: string; border: string; Icon: React.ElementType }> = {
  ENVIADO:      { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', Icon: CheckCircle2 },
  PENDENTE:     { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', Icon: Clock },
  SEM_NUMERO:   { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', Icon: PhoneOff },
  SEM_WHATSAPP: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', Icon: MessageSquareOff },
  FALHOU:       { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    Icon: XCircle },
  PROCESSANDO:  { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   Icon: RefreshCw },
  DUPLICADO:    { color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200',   Icon: Users },
};

// ─── Componentes ─────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const meta = STATUS_META[status] || STATUS_META.PENDENTE;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color} ${meta.bg} ${meta.border}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
          <div className="h-4 w-16 bg-gray-100 rounded" />
          <div className="h-4 flex-1 bg-gray-100 rounded" />
          <div className="h-4 w-28 bg-gray-100 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-6 w-24 bg-gray-100 rounded-full" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── DDD por estado ──────────────────────────────────────────────────────────

const DDD_ESTADO: Record<string, string> = {
  '11':'SP','12':'SP','13':'SP','14':'SP','15':'SP','16':'SP','17':'SP','18':'SP','19':'SP',
  '21':'RJ','22':'RJ','24':'RJ',
  '27':'ES','28':'ES',
  '31':'MG','32':'MG','33':'MG','34':'MG','35':'MG','37':'MG','38':'MG',
  '41':'PR','42':'PR','43':'PR','44':'PR','45':'PR','46':'PR',
  '47':'SC','48':'SC','49':'SC',
  '51':'RS','53':'RS','54':'RS','55':'RS',
  '61':'DF','62':'GO','63':'TO','64':'GO',
  '65':'MT','66':'MT','67':'MS',
  '68':'AC','69':'RO',
  '71':'BA','73':'BA','74':'BA','75':'BA','77':'BA',
  '79':'SE',
  '81':'PE','82':'AL','83':'PB','84':'RN','85':'CE','86':'PI','87':'PE','88':'CE','89':'PI',
  '91':'PA','92':'AM','93':'PA','94':'PA','95':'RR','96':'AP','97':'AM','98':'MA','99':'MA',
};

// Aplica máscara (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
function aplicarMascara(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : '';
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

// ─── Input de Telefone com Máscara ───────────────────────────────────────────

interface PhoneInputProps {
  value: string;           // apenas dígitos, sem país (ex: "16991234567")
  onChange: (digits: string) => void;
}

function PhoneInput({ value, onChange }: PhoneInputProps) {
  const masked = aplicarMascara(value);
  const ddd    = value.slice(0, 2);
  const estado = ddd.length === 2 ? (DDD_ESTADO[ddd] || '??') : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    onChange(digits);
  }

  return (
    <div className="space-y-2">
      {/* Input com máscara */}
      <div className="relative">
        {/* Prefixo +55 fixo */}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-gray-400 select-none pointer-events-none">
          +55
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={masked}
          onChange={handleChange}
          placeholder="(00) 00000-0000"
          className="w-full pl-12 pr-3.5 py-2.5 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all tracking-wide"
        />
      </div>

      {/* Detalhe DDD + Estado */}
      {ddd.length === 2 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-400">DDD</span>
          <span
            className="px-2 py-0.5 rounded-md text-xs font-bold font-mono text-white"
            style={{ background: '#F56600' }}
          >
            {ddd}
          </span>
          {estado && (
            <>
              <span className="text-gray-300 text-xs">•</span>
              <span className="text-xs font-semibold text-gray-600">{estado}</span>
              <span className="text-xs text-gray-400">
                — {DDD_ESTADO[ddd] === 'SP' ? 'São Paulo'
                  : DDD_ESTADO[ddd] === 'RJ' ? 'Rio de Janeiro'
                  : DDD_ESTADO[ddd] === 'MG' ? 'Minas Gerais'
                  : DDD_ESTADO[ddd] === 'PR' ? 'Paraná'
                  : DDD_ESTADO[ddd] === 'RS' ? 'Rio Grande do Sul'
                  : DDD_ESTADO[ddd] === 'SC' ? 'Santa Catarina'
                  : DDD_ESTADO[ddd] === 'BA' ? 'Bahia'
                  : DDD_ESTADO[ddd] === 'GO' ? 'Goiás'
                  : DDD_ESTADO[ddd] === 'DF' ? 'Distrito Federal'
                  : DDD_ESTADO[ddd] === 'PE' ? 'Pernambuco'
                  : DDD_ESTADO[ddd] === 'CE' ? 'Ceará'
                  : DDD_ESTADO[ddd] === 'AM' ? 'Amazonas'
                  : DDD_ESTADO[ddd] === 'PA' ? 'Pará'
                  : DDD_ESTADO[ddd] === 'MT' ? 'Mato Grosso'
                  : DDD_ESTADO[ddd] === 'MS' ? 'Mato Grosso do Sul'
                  : DDD_ESTADO[ddd] === 'ES' ? 'Espírito Santo'
                  : DDD_ESTADO[ddd] === 'MA' ? 'Maranhão'
                  : DDD_ESTADO[ddd] === 'PI' ? 'Piauí'
                  : DDD_ESTADO[ddd] === 'RN' ? 'Rio Grande do Norte'
                  : DDD_ESTADO[ddd] === 'PB' ? 'Paraíba'
                  : DDD_ESTADO[ddd] === 'AL' ? 'Alagoas'
                  : DDD_ESTADO[ddd] === 'SE' ? 'Sergipe'
                  : DDD_ESTADO[ddd] === 'TO' ? 'Tocantins'
                  : DDD_ESTADO[ddd] === 'RO' ? 'Rondônia'
                  : DDD_ESTADO[ddd] === 'AC' ? 'Acre'
                  : DDD_ESTADO[ddd] === 'RR' ? 'Roraima'
                  : DDD_ESTADO[ddd] === 'AP' ? 'Amapá'
                  : estado}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal Novo Contato ───────────────────────────────────────────────────────

interface NovoContatoModalProps {
  bases: string[];
  onClose: () => void;
  onSaved: () => void;
}

function NovoContatoModal({ bases, onClose, onSaved }: NovoContatoModalProps) {
  const [matricula, setMatricula] = useState('');
  const [nome, setNome]           = useState('');
  const [base, setBase]           = useState('');
  const [baseCustom, setBaseCustom] = useState('');
  const [celular, setCelular]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [erro, setErro]           = useState('');

  const baseFinal = base === '__outro' ? baseCustom.trim() : base;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!matricula.trim()) { setErro('Matrícula é obrigatória.'); return; }
    if (!nome.trim())      { setErro('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const { data } = await axios.post('/api/contatos', {
        matricula: matricula.trim(),
        nome:      nome.trim(),
        base:      baseFinal || undefined,
        celular:   celular || undefined,
      });
      if (data.ok) { onSaved(); onClose(); }
      else setErro(data.erro || 'Erro ao salvar.');
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                <UserPlus size={16} style={{ color: '#F56600' }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Novo contato</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cadastrar motorista na planilha</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={salvar} className="p-6 space-y-4">

            {/* Matrícula + Nome lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Matrícula <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  placeholder="Ex: 12345"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Base
                </label>
                <select
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all bg-white appearance-none"
                >
                  <option value="">— Selecione —</option>
                  {bases.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value="__outro">Outra...</option>
                </select>
              </div>
            </div>

            {base === '__outro' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nome da base
                </label>
                <input
                  type="text"
                  value={baseCustom}
                  onChange={e => setBaseCustom(e.target.value)}
                  placeholder="Digite o nome da base"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Nome completo <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome do motorista"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Celular <span className="text-gray-300 font-normal normal-case">(opcional)</span>
              </label>
              <PhoneInput value={celular} onChange={setCelular} />
            </div>

            {erro && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#F56600' }}
              >
                <Save size={14} />
                {saving ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Modal Cadastro de Número ─────────────────────────────────────────────────

interface CadastroNumeroModalProps {
  contato: Contato;
  onClose: () => void;
  onSaved: () => void;
}

function CadastroNumeroModal({ contato, onClose, onSaved }: CadastroNumeroModalProps) {
  const [celular, setCelular] = useState('');
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (celular.length < 10) { setErro('Número inválido — informe DDD + número (10 ou 11 dígitos).'); return; }
    setErro('');
    setSaving(true);
    try {
      const { data } = await axios.put(`/api/contatos/${encodeURIComponent(contato.matricula)}`, {
        celular: celular.trim(),
      });
      if (data.ok) { onSaved(); onClose(); }
      else setErro(data.erro || 'Erro ao salvar.');
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                  <Phone size={16} style={{ color: '#F56600' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Cadastrar número</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{contato.nome} · Mat. {contato.matricula}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <form onSubmit={salvar} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Celular
              </label>
              <PhoneInput value={celular} onChange={setCelular} />
            </div>

            {erro && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || celular.length < 10}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#F56600' }}
              >
                <Save size={14} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Modal de Edição ─────────────────────────────────────────────────────────

interface EditModalProps {
  contato: Contato;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ contato, onClose, onSaved }: EditModalProps) {
  const [nome, setNome]       = useState(contato.nome);
  // Remove +55 do início para exibir só DDD + número
  const rawInicial = (contato.celular || '').replace(/\D/g, '').replace(/^55/, '');
  const [celular, setCelular] = useState(rawInicial);
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSaving(true);
    try {
      const { data } = await axios.put(`/api/contatos/${encodeURIComponent(contato.matricula)}`, {
        nome:    nome.trim()    || undefined,
        celular: celular.trim() || undefined,
      });
      if (data.ok) {
        onSaved();
        onClose();
      } else {
        setErro(data.erro || 'Erro ao salvar.');
      }
    } catch {
      setErro('Erro de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header do modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Editar Motorista</h2>
              <p className="text-xs text-gray-400 mt-0.5">Mat. {contato.matricula}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={salvar} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="Nome do motorista"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Celular
              </label>
              <PhoneInput value={celular} onChange={setCelular} />
            </div>

            {erro && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#F56600' }}
              >
                <Save size={14} />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function Contatos() {
  const { campanhaId, campanha } = useCampanha();
  const isAtiva = campanha?.status === 'executando' || campanha?.status === 'pausada';

  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus]       = useState('ALL');
  const [base, setBase]           = useState('ALL');
  const [page, setPage]           = useState(1);
  const [editando, setEditando]       = useState<Contato | null>(null);
  const [cadastrando, setCadastrando] = useState<Contato | null>(null);
  const [novoAberto, setNovoAberto]   = useState(false);
  const PER_PAGE = 50;

  const fetchContatos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await axios.get<ApiResponse>('/api/contatos', {
        params: {
          search, status, base, page, per_page: PER_PAGE,
          ...(campanhaId && { campanha: campanhaId }),
        },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [search, status, base, page, campanhaId]);

  useEffect(() => { fetchContatos(); }, [fetchContatos]);

  // Ao mudar filtros volta para página 1
  function applyFilter(newStatus?: string, newBase?: string) {
    if (newStatus !== undefined) setStatus(newStatus);
    if (newBase   !== undefined) setBase(newBase);
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  // Stats rápidos a partir dos dados carregados
  const totais = data
    ? STATUS_OPTIONS.slice(1).map(s => ({
        ...s,
        count: s.value === status || status === 'ALL'
          ? undefined // não calcula slice parcial
          : undefined,
      }))
    : [];
  void totais;

  const bases = data?.bases || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contatos</h1>
            <p className="text-sm text-gray-500">
              {data ? `${data.total.toLocaleString('pt-BR')} motoristas encontrados` : 'Carregando...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNovoAberto(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#F56600' }}
          >
            <UserPlus size={15} />
            Novo contato
          </button>
          <button
            onClick={fetchContatos}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Banner campanha */}
      {campanha && !isAtiva && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium">
          <span>Exibindo status do snapshot da campanha</span>
          <strong>{campanha.nome}</strong>
          <span className="ml-auto text-blue-400">Edições de número ainda afetam a planilha global</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">

        {/* Busca */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, matrícula ou celular..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
          />
        </form>

        {/* Status */}
        <div className="relative">
          <select
            value={status}
            onChange={e => applyFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Base */}
        <div className="relative">
          <select
            value={base}
            onChange={e => applyFilter(undefined, e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
          >
            <option value="ALL">Todas as bases</option>
            {bases.map(b => <option key={b} value={b.toUpperCase()}>{b}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={handleSearch}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
          style={{ background: '#F56600' }}
        >
          Filtrar
        </button>
      </div>

      {/* Chips de status rápido */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_OPTIONS.map(s => {
          const meta = s.value !== 'ALL' ? STATUS_META[s.value] : null;
          const isActive = status === s.value;
          return (
            <button
              key={s.value}
              onClick={() => applyFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isActive
                  ? 'text-white border-transparent'
                  : meta
                    ? `${meta.color} ${meta.bg} ${meta.border} hover:opacity-80`
                    : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
              }`}
              style={isActive ? { background: '#F56600', borderColor: '#F56600' } : {}}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-24">Matrícula</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Nome</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-40">Base</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-40">Celular</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-36">Status</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-40">Enviado em</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-20">Print</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><Skeleton /></td></tr>
              ) : !data || data.contatos.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Users size={32} className="mb-3 opacity-30" />
                      <p className="text-sm">Nenhum contato encontrado</p>
                      <p className="text-xs mt-1">Tente ajustar os filtros.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {data.contatos.map((c, i) => (
                    <motion.tr
                      key={c.matricula}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.008 }}
                      className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.matricula}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.base}</td>
                      <td className="px-4 py-3">
                        {c.celular ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 font-mono">
                            <Phone size={11} className="text-gray-400" />
                            {c.celular}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} label={c.statusLabel} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.enviadoEm || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.temPrint ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Image size={12} /> Sim
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!c.celular && (
                            <button
                              onClick={() => setCadastrando(c)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                              style={{ background: '#F56600' }}
                              title="Cadastrar número"
                            >
                              <Phone size={11} />
                              + Número
                            </button>
                          )}
                          <button
                            onClick={() => setEditando(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                            title="Editar motorista"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Mostrando {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, data.total)} de {data.total.toLocaleString('pt-BR')}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              {[...Array(Math.min(data.totalPages, 5))].map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                      page === p
                        ? 'text-white'
                        : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    style={page === p ? { background: '#F56600' } : {}}
                  >
                    {p}
                  </button>
                );
              })}
              {data.totalPages > 5 && <span className="text-gray-400 text-xs px-1">...</span>}
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal novo contato */}
      {novoAberto && (
        <NovoContatoModal
          bases={bases}
          onClose={() => setNovoAberto(false)}
          onSaved={fetchContatos}
        />
      )}

      {/* Modal cadastro de número */}
      {cadastrando && (
        <CadastroNumeroModal
          contato={cadastrando}
          onClose={() => setCadastrando(null)}
          onSaved={fetchContatos}
        />
      )}

      {/* Modal de edição */}
      {editando && (
        <EditModal
          contato={editando}
          onClose={() => setEditando(null)}
          onSaved={fetchContatos}
        />
      )}
    </div>
  );
}
