'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
const MAX_LINES = 5000; // mantém os últimos 5000 eventos em disco

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Classifica o tipo do evento a partir do texto e tipo SSE.
 * @param {'start'|'log'|'end'} type
 * @param {string} [text]
 * @returns {'START'|'SUCCESS'|'ERROR'|'WARNING'|'INFO'|'END'}
 */
function classificar(type, text) {
  if (type === 'start') return 'START';
  if (type === 'end')   return 'END';
  const t = (text || '').toLowerCase();
  if (t.includes('❌') || t.includes('erro') || t.includes('falhou') || t.includes('falha')) return 'ERROR';
  if (t.includes('✅') || t.includes('enviado') || t.includes('concluído') || t.includes('ok')) return 'SUCCESS';
  if (t.includes('⚠') || t.includes('aviso') || t.includes('sem whatsapp') || t.includes('sem número')) return 'WARNING';
  return 'INFO';
}

/**
 * Persiste um evento de log no arquivo bot.log (JSON Lines).
 * @param {{ type: string, text?: string, command?: string, code?: number }} evento
 */
function salvar(evento) {
  const linha = JSON.stringify({
    ts:      new Date().toISOString(),
    kind:    classificar(evento.type, evento.text),
    type:    evento.type,
    command: evento.command || null,
    text:    evento.text   || null,
    code:    evento.code   ?? null,
  }) + '\n';

  fs.appendFileSync(LOG_FILE, linha, 'utf8');
  compactar();
}

/** Remove linhas antigas mantendo apenas as últimas MAX_LINES. */
function compactar() {
  try {
    const conteudo = fs.readFileSync(LOG_FILE, 'utf8');
    const linhas = conteudo.split('\n').filter(Boolean);
    if (linhas.length > MAX_LINES) {
      fs.writeFileSync(LOG_FILE, linhas.slice(-MAX_LINES).join('\n') + '\n', 'utf8');
    }
  } catch (_) {}
}

/**
 * Lê o histórico de logs com filtros opcionais.
 * @param {{ kind?: string, search?: string, limit?: number, offset?: number }} opts
 * @returns {{ logs: object[], total: number }}
 */
function ler({ kind, search, limit = 200, offset = 0 } = {}) {
  if (!fs.existsSync(LOG_FILE)) return { logs: [], total: 0 };

  const linhas = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  let eventos = linhas.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);

  // Filtros
  if (kind && kind !== 'ALL') {
    eventos = eventos.filter(e => e.kind === kind);
  }
  if (search) {
    const q = search.toLowerCase();
    eventos = eventos.filter(e => (e.text || '').toLowerCase().includes(q) || (e.command || '').toLowerCase().includes(q));
  }

  const total = eventos.length;
  // Retorna do mais recente para o mais antigo
  const logs = eventos.reverse().slice(offset, offset + limit);

  return { logs, total };
}

/** Apaga todo o histórico de logs. */
function limpar() {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}

module.exports = { salvar, ler, limpar };
