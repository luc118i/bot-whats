'use strict';

const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const svc = require('../../services/campanhasService');
const { run, stop, getStatus } = require('../processController');
const config = require('../../config');
const { lerMotoristas } = require('../../services/spreadsheetService');

const LOG_FILE = path.join(__dirname, '..', '..', '..', 'logs', 'bot.log');

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function lerStats() {
  try {
    if (!fs.existsSync(config.paths.progresso)) return {};
    return JSON.parse(fs.readFileSync(config.paths.progresso, 'utf8'));
  } catch (_) { return {}; }
}

function calcularStats() {
  const prog    = lerStats();
  const entries = Object.values(prog);
  let totalPlanilha = entries.length;
  try { const { lerMotoristas } = require('../../services/spreadsheetService'); totalPlanilha = lerMotoristas().length; } catch (_) {}
  const enviados    = entries.filter(e => e.status === 'ENVIADO').length;
  const processando = entries.filter(e => e.status === 'PROCESSANDO').length;
  const semNumero   = entries.filter(e => e.status === 'SEM_NUMERO').length;
  const semWhatsapp = entries.filter(e => e.status === 'SEM_WHATSAPP').length;
  const duplicados  = entries.filter(e => e.status === 'DUPLICADO').length;
  const falhas      = entries.filter(e => e.status === 'FALHOU').length;
  const pendentes   = entries.filter(e => e.status === 'PENDENTE').length + Math.max(0, totalPlanilha - entries.length);
  const validos     = totalPlanilha - semNumero - semWhatsapp - duplicados;
  // PROCESSANDO = enviados provavelmente (bot interrompido durante confirmação)
  const entregues   = enviados + processando;
  return { total: totalPlanilha, enviados, processando, entregues, pendentes, falhas, semNumero, semWhatsapp, duplicados, validos, duracaoSegundos: 0 };
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
  });
}

function handler(req, res) {
  const url    = (req.url || '/').split('?')[0];
  const method = req.method;

  // POST /api/campanhas/importar-progresso — importa disparo existente como campanha
  if (url === '/api/campanhas/importar-progresso' && method === 'POST') {
    body(req).then(dados => {
      // Lê stats do progresso.json
      const prog    = lerStats();
      const entries = Object.values(prog);
      if (entries.length === 0) return json(res, 400, { ok: false, erro: 'Nenhum dado encontrado em progresso.json.' });

      // Total real = motoristas na planilha (não só os que estão no progresso.json)
      const totalPlanilha = (() => { try { return lerMotoristas().length; } catch(_) { return entries.length; } })();
      const processados  = entries.length;
      const enviados     = entries.filter(e => e.status === 'ENVIADO').length;
      const semNumero    = entries.filter(e => e.status === 'SEM_NUMERO').length;
      const semWA        = entries.filter(e => e.status === 'SEM_WHATSAPP').length;
      const duplicados   = entries.filter(e => e.status === 'DUPLICADO').length;
      const falhas       = semWA + entries.filter(e => e.status === 'FALHOU').length;
      // Pendentes = não processados na planilha + marcados como PENDENTE no progresso
      const pendentesProgresso = entries.filter(e => e.status === 'PENDENTE').length;
      const naoTentados        = Math.max(0, totalPlanilha - processados);
      const pendentes          = pendentesProgresso + naoTentados;
      const total              = totalPlanilha;

      // Tenta extrair datas do log
      let iniciadoEm   = null;
      let finalizadoEm = null;
      try {
        if (fs.existsSync(LOG_FILE)) {
          const linhas = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
          const eventos = linhas.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
          const starts  = eventos.filter(e => e.kind === 'START');
          const ends    = eventos.filter(e => e.kind === 'END');
          if (starts.length) iniciadoEm   = starts[starts.length - 1].ts;
          if (ends.length)   finalizadoEm = ends[ends.length - 1].ts;
        }
      } catch (_) {}

      // Duração em segundos
      let duracaoSegundos = 0;
      if (iniciadoEm && finalizadoEm) {
        duracaoSegundos = Math.floor((new Date(finalizadoEm) - new Date(iniciadoEm)) / 1000);
      }

      // Datas dos envios para detectar período real
      const datasEnvio = entries
        .filter(e => e.enviadoEm)
        .map(e => new Date(e.enviadoEm))
        .filter(d => !isNaN(d));
      if (!iniciadoEm && datasEnvio.length) iniciadoEm   = new Date(Math.min(...datasEnvio)).toISOString();
      if (!finalizadoEm && datasEnvio.length) finalizadoEm = new Date(Math.max(...datasEnvio)).toISOString();

      const nome = dados.nome || `Disparo importado — ${new Date(iniciadoEm || Date.now()).toLocaleDateString('pt-BR')}`;

      const campanha = svc.criar({
        nome,
        descricao: dados.descricao || 'Campanha importada do histórico de disparos existente.',
        responsavel: 'Sistema (importado)',
        agendadoPara: null,
        config: {
          filtroBase:     'ALL',
          filtroBaseOp:   [],
          filtroStatus:   'PENDENTE',
          modeloMensagem: 'aleatorio',
          delayMin:       config.bot.delayMin,
          delayMax:       config.bot.delayMax,
        },
      });

      const taxa = total > 0 ? (enviados / total) * 100 : 0
      const statusFinal = taxa >= 95 ? 'finalizada' : 'pausada'

      // Atualiza com dados reais retroativos
      svc.atualizar(campanha.id, {
        status:       statusFinal,
        iniciadoEm,
        finalizadoEm: statusFinal === 'finalizada' ? (finalizadoEm || new Date().toISOString()) : null,
        stats: { total, enviados, pendentes, falhas, duracaoSegundos },
      });

      // Eventos retroativos
      if (iniciadoEm)   svc.adicionarEvento(campanha.id, 'inicio',   'Campanha iniciada (importado do histórico).');
      if (enviados > 0) svc.adicionarEvento(campanha.id, 'log',      `${enviados} mensagens enviadas com sucesso.`);
      if (falhas > 0)   svc.adicionarEvento(campanha.id, 'log',      `${falhas} contatos sem WhatsApp ou com falha.`);
      if (pendentes === 0 && finalizadoEm) svc.adicionarEvento(campanha.id, 'conclusao', 'Campanha finalizada com sucesso.');

      const final = svc.buscar(campanha.id);
      json(res, 201, { ok: true, campanha: final });
    }).catch(() => json(res, 400, { ok: false, erro: 'Erro ao importar.' }));
    return true;
  }

  // GET /api/campanhas — listar
  if (url === '/api/campanhas' && method === 'GET') {
    const qs = parse(req.url, true).query;
    let lista = svc.listar();
    if (qs.status) lista = lista.filter(c => c.status === qs.status);
    json(res, 200, { campanhas: lista, metricas: svc.obterMetricas() });
    return true;
  }

  // GET /api/campanhas/metricas
  if (url === '/api/campanhas/metricas' && method === 'GET') {
    json(res, 200, svc.obterMetricas());
    return true;
  }

  // GET /api/campanhas/ativa
  if (url === '/api/campanhas/ativa' && method === 'GET') {
    const ativa = svc.obterAtiva();
    if (!ativa) { json(res, 200, { ativa: null }); return true; }
    // Injeta stats em tempo real do progresso.json
    const statsAtuais = calcularStats();
    const inicio = ativa.iniciadoEm ? new Date(ativa.iniciadoEm) : null;
    const duracaoSegundos = inicio ? Math.floor((Date.now() - inicio.getTime()) / 1000) : 0;
    json(res, 200, { ativa: { ...ativa, stats: { ...ativa.stats, ...statsAtuais, duracaoSegundos } } });
    return true;
  }

  // POST /api/campanhas — criar
  if (url === '/api/campanhas' && method === 'POST') {
    body(req).then(dados => {
      if (!dados.nome) return json(res, 400, { ok: false, erro: 'Nome obrigatório.' });
      const nova = svc.criar(dados);
      json(res, 201, { ok: true, campanha: nova });
    }).catch(() => json(res, 400, { ok: false, erro: 'Dados inválidos.' }));
    return true;
  }

  // Rotas com :id
  const matchId     = url.match(/^\/api\/campanhas\/([^/]+)$/);
  const matchAction = url.match(/^\/api\/campanhas\/([^/]+)\/([^/]+)$/);

  // POST /api/campanhas/:id/iniciar
  if (matchAction && matchAction[2] === 'iniciar' && method === 'POST') {
    const id = matchAction[1];
    const campanha = svc.buscar(id);
    if (!campanha) return json(res, 404, { ok: false, erro: 'Campanha não encontrada.' });
    if (getStatus().running) return json(res, 409, { ok: false, erro: 'Já existe um processo em execução.' });
    const ativa = svc.obterAtiva();
    if (ativa && ativa.id !== id) return json(res, 409, { ok: false, erro: 'Outra campanha já está ativa.' });

    svc.iniciar(id);
    const result = run('send', ['scripts/send.js']);
    if (!result.ok) { svc.cancelar(id); return json(res, 500, result); }
    json(res, 200, { ok: true });
    return true;
  }

  // POST /api/campanhas/:id/finalizar
  if (matchAction && matchAction[2] === 'finalizar' && method === 'POST') {
    const id = matchAction[1];
    const campanha = svc.buscar(id);
    if (!campanha) return json(res, 404, { ok: false, erro: 'Campanha não encontrada.' });
    const stats = calcularStats();
    const inicio = campanha.iniciadoEm ? new Date(campanha.iniciadoEm) : new Date();
    stats.duracaoSegundos = Math.floor((Date.now() - inicio.getTime()) / 1000);
    const c = svc.finalizar(id, stats);
    json(res, c ? 200 : 404, { ok: !!c });
    return true;
  }

  // POST /api/campanhas/:id/pausar
  if (matchAction && matchAction[2] === 'pausar' && method === 'POST') {
    const id = matchAction[1];
    stop();
    const c = svc.pausar(id);
    json(res, c ? 200 : 404, { ok: !!c });
    return true;
  }

  // POST /api/campanhas/:id/retomar
  if (matchAction && matchAction[2] === 'retomar' && method === 'POST') {
    const id = matchAction[1];
    if (getStatus().running) return json(res, 409, { ok: false, erro: 'Bot já está rodando.' });
    svc.retomar(id);
    const result = run('send', ['scripts/send.js']);
    if (!result.ok) { svc.pausar(id); return json(res, 500, result); }
    json(res, 200, { ok: true });
    return true;
  }

  // POST /api/campanhas/:id/cancelar
  if (matchAction && matchAction[2] === 'cancelar' && method === 'POST') {
    const id = matchAction[1];
    stop();
    const c = svc.cancelar(id);
    json(res, c ? 200 : 404, { ok: !!c });
    return true;
  }

  // POST /api/campanhas/:id/duplicar
  if (matchAction && matchAction[2] === 'duplicar' && method === 'POST') {
    const id = matchAction[1];
    const copia = svc.duplicar(id);
    json(res, copia ? 201 : 404, copia ? { ok: true, campanha: copia } : { ok: false, erro: 'Não encontrada.' });
    return true;
  }

  // GET /api/campanhas/:id
  if (matchId && method === 'GET') {
    const c = svc.buscar(matchId[1]);
    json(res, c ? 200 : 404, c ? { campanha: c } : { erro: 'Não encontrada.' });
    return true;
  }

  // PUT /api/campanhas/:id
  if (matchId && method === 'PUT') {
    body(req).then(dados => {
      const c = svc.atualizar(matchId[1], dados);
      json(res, c ? 200 : 404, c ? { ok: true, campanha: c } : { ok: false, erro: 'Não encontrada.' });
    }).catch(() => json(res, 400, { ok: false, erro: 'Dados inválidos.' }));
    return true;
  }

  // DELETE /api/campanhas/:id
  if (matchId && method === 'DELETE') {
    const c = svc.buscar(matchId[1]);
    if (!c) return json(res, 404, { ok: false, erro: 'Não encontrada.' }) || true;
    if (c.status === 'executando') return json(res, 409, { ok: false, erro: 'Cancele a campanha antes de excluir.' }) || true;
    svc.deletar(matchId[1]);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = { handler };
