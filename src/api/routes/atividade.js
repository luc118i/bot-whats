'use strict';

const { parse } = require('url');
const progressService = require('../../services/progressService');

/**
 * Converte a data no formato pt-BR gravado em `enviadoEm` (ex: "21/07/2026,
 * 16:00:10") para um objeto Date. Retorna null se o formato não bater —
 * `new Date(string)` não interpreta DD/MM/YYYY de forma confiável.
 *
 * @param {string} str
 * @returns {Date|null}
 */
function parseDataPtBr(str) {
  if (!str) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Coleta a data de todo envio ENVIADO registrado, em qualquer campanha (cada
 * uma no seu próprio progresso/<id>.json) e também no arquivo legado global
 * (fluxo avulso/standalone) — é o histórico completo e definitivo de envios,
 * nunca rotacionado (diferente do logs/bot.log, que mantém só os últimos 5000
 * eventos).
 *
 * @returns {Date[]}
 */
function coletarDatasDeEnvio() {
  const datas = [];
  const coletarDe = (progresso) => {
    Object.values(progresso).forEach((v) => {
      if (v.status !== 'ENVIADO') return;
      const d = parseDataPtBr(v.enviadoEm);
      if (d) datas.push(d);
    });
  };

  progressService.listarTodosCampanhaIds().forEach((id) => coletarDe(progressService.carregar(id)));
  coletarDe(progressService.carregar());

  return datas;
}

/** Escolhe o tamanho do intervalo (bucket) de agregação conforme a janela pedida. */
function granularidadeMs(horas) {
  if (horas <= 2) return 60_000;              // 1 min
  if (horas <= 48) return 15 * 60_000;        // 15 min
  if (horas <= 24 * 14) return 60 * 60_000;   // 1h
  return 24 * 60 * 60_000;                    // 1 dia
}

/**
 * Agrega os envios reais dos últimos `horas` em buckets de tempo, preenchendo
 * com zero os intervalos sem atividade (pra o gráfico ficar contínuo).
 *
 * @param {number} horas
 * @returns {{ granularidadeMinutos: number, pontos: { ts: string, enviados: number }[] }}
 */
function agregarAtividade(horas) {
  const agora = Date.now();
  const desde = agora - horas * 3_600_000;
  const passo = granularidadeMs(horas);

  const buckets = new Map();
  coletarDatasDeEnvio().forEach((d) => {
    const t = d.getTime();
    if (t < desde || t > agora) return;
    const chave = Math.floor(t / passo) * passo;
    buckets.set(chave, (buckets.get(chave) || 0) + 1);
  });

  const inicioBucket = Math.floor(desde / passo) * passo;
  const fimBucket = Math.floor(agora / passo) * passo;
  const pontos = [];
  for (let t = inicioBucket; t <= fimBucket; t += passo) {
    pontos.push({ ts: new Date(t).toISOString(), enviados: buckets.get(t) || 0 });
  }

  return { granularidadeMinutos: passo / 60_000, pontos };
}

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];
  if (url === '/api/stats/atividade' && req.method === 'GET') {
    const qs = parse(req.url, true).query;
    // Clampa entre 1h e 60 dias — evita varrer/retornar algo absurdo por engano.
    const horas = Math.min(Math.max(parseFloat(qs.horas) || 24, 1), 24 * 60);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agregarAtividade(horas)));
    return true;
  }
  return false;
}

module.exports = { handler };
