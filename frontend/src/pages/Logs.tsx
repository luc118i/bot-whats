import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Search, Trash2, Download, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Info, Play, Square,
  ChevronDown,
} from 'lucide-react';
import axios from 'axios';
import { useLogs } from '../hooks/useLogs';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type LogKind = 'ALL' | 'START' | 'END' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';

interface HistoryLog {
  ts: string;
  kind: LogKind;
  type: string;
  command: string | null;
  text: string | null;
  code: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_META: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  START:   { label: 'Início',   color: 'text-blue-600',   bg: 'bg-blue-50',   Icon: Play },
  END:     { label: 'Fim',      color: 'text-orange-600', bg: 'bg-orange-50', Icon: Square },
  SUCCESS: { label: 'Sucesso',  color: 'text-green-600',  bg: 'bg-green-50',  Icon: CheckCircle2 },
  ERROR:   { label: 'Erro',     color: 'text-red-600',    bg: 'bg-red-50',    Icon: XCircle },
  WARNING: { label: 'Aviso',    color: 'text-yellow-600', bg: 'bg-yellow-50', Icon: AlertTriangle },
  INFO:    { label: 'Info',     color: 'text-gray-500',   bg: 'bg-gray-50',   Icon: Info },
};

const KINDS: LogKind[] = ['ALL', 'SUCCESS', 'ERROR', 'WARNING', 'INFO', 'START', 'END'];

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Badge de tipo ────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: string }) {
  const meta = KIND_META[kind] || KIND_META.INFO;
  const { Icon } = meta;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color} ${meta.bg}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

// ─── Linha de log ao vivo ────────────────────────────────────────────────────

function LiveLogLine({ entry }: { entry: { type: string; text?: string; command?: string; code?: number } }) {
  const kind = entry.type === 'start' ? 'START'
    : entry.type === 'end' ? 'END'
    : (entry.text || '').match(/❌|erro|falhou|falha/i) ? 'ERROR'
    : (entry.text || '').match(/✅|enviado|concluído/i) ? 'SUCCESS'
    : (entry.text || '').match(/⚠|sem whatsapp|sem número/i) ? 'WARNING'
    : 'INFO';

  const meta = KIND_META[kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 py-1.5 px-3 rounded-lg hover:bg-gray-50 group"
    >
      <span className="text-xs text-gray-400 font-mono w-20 shrink-0 pt-0.5">
        {new Date().toLocaleTimeString('pt-BR')}
      </span>
      <span className="shrink-0"><KindBadge kind={kind} /></span>
      <span className={`text-sm font-mono ${meta.color} break-all`}>
        {entry.text || (entry.type === 'start' ? `Comando iniciado: ${entry.command}` : `Processo encerrado (código ${entry.code ?? '—'})`)}
      </span>
    </motion.div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function Logs() {
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [kindFilter, setKindFilter] = useState<LogKind>('ALL');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const liveBottomRef = useRef<HTMLDivElement>(null);
  const { logs: liveLogs, clearLogs } = useLogs();

  // Busca histórico
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/logs/history', {
        params: { kind: kindFilter, search, limit: 300 },
      });
      setHistory(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [kindFilter, search]);

  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  // Auto-scroll log ao vivo
  useEffect(() => {
    if (autoScroll && liveBottomRef.current) {
      liveBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, autoScroll]);

  // Exportar histórico como TXT
  function exportarTxt() {
    const linhas = history.map(l =>
      `[${new Date(l.ts).toLocaleString('pt-BR')}] [${l.kind}] ${l.text || l.type}`
    ).join('\n');
    const blob = new Blob([linhas], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catedral-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Limpar histórico
  async function limparHistorico() {
    if (!confirm('Apagar todo o histórico de logs? Esta ação não pode ser desfeita.')) return;
    await axios.delete('/api/logs/history');
    setHistory([]);
    setTotal(0);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Terminal size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Logs do Sistema</h1>
            <p className="text-sm text-gray-500">Monitoramento em tempo real e histórico de eventos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'history' && (
            <>
              <button
                onClick={fetchHistory}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
              <button
                onClick={exportarTxt}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download size={14} /> Exportar
              </button>
              <button
                onClick={limparHistorico}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Limpar
              </button>
            </>
          )}
          {tab === 'live' && (
            <button
              onClick={clearLogs}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Trash2 size={14} /> Limpar tela
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['live', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'live' ? 'Tempo Real' : 'Histórico'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── ABA TEMPO REAL ── */}
        {tab === 'live' && (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700">Ao vivo</span>
                  <span className="text-xs text-gray-400 ml-1">{liveLogs.length} eventos</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={e => setAutoScroll(e.target.checked)}
                    className="rounded accent-orange-500"
                  />
                  Auto-scroll
                </label>
              </div>

              {/* Log stream */}
              <div className="h-[520px] overflow-y-auto bg-white px-1 py-2">
                {liveLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Terminal size={32} className="mb-3 opacity-30" />
                    <p className="text-sm">Aguardando eventos do bot...</p>
                    <p className="text-xs mt-1">Inicie um envio no Dashboard para ver os logs aqui.</p>
                  </div>
                ) : (
                  liveLogs.map((entry, i) => (
                    <LiveLogLine key={i} entry={entry} />
                  ))
                )}
                <div ref={liveBottomRef} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ABA HISTÓRICO ── */}
        {tab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Filtros */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {/* Busca */}
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                  placeholder="Buscar nos logs..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              {/* Filtro de tipo */}
              <div className="relative">
                <select
                  value={kindFilter}
                  onChange={e => setKindFilter(e.target.value as LogKind)}
                  className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
                >
                  {KINDS.map(k => (
                    <option key={k} value={k}>
                      {k === 'ALL' ? 'Todos os tipos' : KIND_META[k]?.label || k}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <button
                onClick={fetchHistory}
                className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
                style={{ background: '#F56600' }}
              >
                Filtrar
              </button>
            </div>

            {/* Contagem */}
            <p className="text-xs text-gray-400 mb-3">
              {loading ? 'Carregando...' : `${history.length} de ${total} eventos encontrados`}
            </p>

            {/* Tabela */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-8 space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Terminal size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Nenhum log encontrado</p>
                  <p className="text-xs mt-1">Tente ajustar os filtros ou inicie um envio.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-24">Data</th>
                        <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-24">Hora</th>
                        <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-28">Tipo</th>
                        <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 w-28">Comando</th>
                        <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((log, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.01 }}
                          className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{formatDate(log.ts)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{formatTs(log.ts)}</td>
                          <td className="px-4 py-3"><KindBadge kind={log.kind} /></td>
                          <td className="px-4 py-3 text-xs text-gray-500">{log.command || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 font-mono max-w-md truncate" title={log.text || ''}>
                            {log.text || (log.type === 'end' ? `Processo encerrado (código ${log.code ?? '—'})` : log.type)}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
