'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const statsRoute = require('./routes/stats');
const updateRoute = require('./routes/update');
const downloadRoute = require('./routes/download');
const controlRoute = require('./routes/control');
const logsHistoryRoute = require('./routes/logsHistory');
const contactsRoute = require('./routes/contacts');
const configRoute        = require('./routes/config');
const relatorioExcelRoute = require('./routes/relatorioExcel');
const campanhasRoute      = require('./routes/campanhas');
const templatesRoute      = require('./routes/templates');
const contasRoute         = require('./routes/contas');
const atividadeRoute      = require('./routes/atividade');
const campanhasSvc        = require('../services/campanhasService');
const progressService     = require('../services/progressService');
const processController   = require('./processController');

// Ao encerrar o bot, finaliza automaticamente a campanha ativa
processController.onEnd(() => {
  const ativa = campanhasSvc.obterAtiva();
  if (!ativa) return;
  let stats = { total: 0, enviados: 0, pendentes: 0, falhas: 0, semNumero: 0, semWhatsapp: 0, duplicados: 0, validos: 0 };
  try {
    // Progresso isolado desta campanha (progresso/<id>.json) — nunca mais o
    // arquivo global compartilhado entre campanhas.
    const prog = progressService.carregar(ativa.id);
    const { lerMotoristas } = require('../services/spreadsheetService');
    // Recorta pelo público-alvo (base operacional) da campanha, senão o total
    // conta a planilha inteira mesmo quando a campanha mira só uma região.
    const filtroBaseOp = ativa.config?.filtroBaseOp || [];
    const temFiltro = filtroBaseOp.length > 0;
    let motoristas = [];
    try { motoristas = lerMotoristas(); } catch (_) {}
    const motoristasFiltrados = temFiltro ? motoristas.filter(m => filtroBaseOp.includes(m.base)) : motoristas;
    const matriculasFiltradas = new Set(motoristasFiltrados.map(m => m.matricula));
    const entries = (temFiltro
      ? Object.entries(prog).filter(([matricula]) => matriculasFiltradas.has(matricula))
      : Object.entries(prog)
    ).map(([, v]) => v);
    const totalPlanilha = motoristasFiltrados.length || entries.length;
    const enviados    = entries.filter(e => e.status === 'ENVIADO').length;
    const processando = entries.filter(e => e.status === 'PROCESSANDO').length;
    const semNumero   = entries.filter(e => e.status === 'SEM_NUMERO').length;
    const semWhatsapp = entries.filter(e => e.status === 'SEM_WHATSAPP').length;
    const duplicados  = entries.filter(e => e.status === 'DUPLICADO').length;
    const falhas      = entries.filter(e => e.status === 'FALHOU').length;
    const pendProg    = entries.filter(e => e.status === 'PENDENTE').length;
    const naoTentados = Math.max(0, totalPlanilha - entries.length);
    const validos     = totalPlanilha - semNumero - semWhatsapp - duplicados;
    stats = {
      total:       totalPlanilha,
      enviados,
      processando,
      entregues:   enviados + processando,
      pendentes:   pendProg + naoTentados,
      falhas,
      semNumero,
      semWhatsapp,
      duplicados,
      validos,
      duracaoSegundos: 0,
    };
  } catch (_) {}
  const inicio = ativa.iniciadoEm ? new Date(ativa.iniciadoEm) : new Date();
  stats.duracaoSegundos = Math.floor((Date.now() - inicio.getTime()) / 1000);
  const taxa = stats.total > 0 ? (stats.enviados / stats.total) * 100 : 0;
  // Finaliza se taxa >= 95% OU se não sobrou nenhum pendente (bot encerrou limpo)
  if (taxa >= 95 || stats.pendentes === 0) {
    campanhasSvc.finalizar(ativa.id, stats);
  } else {
    campanhasSvc.pausar(ativa.id);
    campanhasSvc.atualizar(ativa.id, { stats });
  }
});

const PORTA = config.server.porta;
const WEB_DIR = path.join(__dirname, '..', '..', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Servidor HTTP da interface web do Catedral Bot.
 * Monta as rotas da API e serve os arquivos estáticos da pasta `web/`.
 *
 * Rotas disponíveis:
 * - GET  /api/stats      → Estatísticas de envio em tempo real
 * - POST /api/atualizar  → Atualiza números na planilha
 * - GET  /baixar-modelo  → Download da planilha modelo
 * - GET  /               → Serve web/index.html
 *
 * @type {import('http').Server}
 */
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/stats') {
    return statsRoute.handler(req, res);
  }

  if (url === '/api/atualizar' && req.method === 'POST') {
    return updateRoute.handler(req, res);
  }

  if (url === '/baixar-modelo') {
    return downloadRoute.handler(req, res);
  }

  if (controlRoute.handler(req, res)) return;
  if (logsHistoryRoute.handler(req, res)) return;
  if (contactsRoute.handler(req, res)) return;
  if (configRoute.handler(req, res)) return;
  if (relatorioExcelRoute.handler(req, res)) return;
  if (campanhasRoute.handler(req, res)) return;
  if (templatesRoute.handler(req, res)) return;
  if (contasRoute.handler(req, res)) return;
  if (atividadeRoute.handler(req, res)) return;

  // Serve a imagem do informativo para preview nos cards de campanha.
  // Se a campanha (?campanha=id) tiver uma imagem customizada própria, serve ela;
  // senão cai na imagem padrão do sistema.
  if (url === '/api/campanha/imagem') {
    const { campanha: campanhaId } = require('url').parse(req.url, true).query;
    let imgPath = config.paths.imagem;
    if (campanhaId) {
      const c = campanhasSvc.buscar(campanhaId);
      if (c?.imagem && fs.existsSync(c.imagem)) imgPath = c.imagem;
    }
    if (!fs.existsSync(imgPath)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(imgPath).toLowerCase();
    const MIME_MIDIA = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    };
    const mime = MIME_MIDIA[ext] || 'image/png';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    fs.createReadStream(imgPath).pipe(res);
    return;
  }

  // Arquivos estáticos da pasta web/
  const filePath =
    url === '/' ? path.join(WEB_DIR, 'index.html') : path.join(WEB_DIR, url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORTA, () => {
  console.log(`\n✅ Interface rodando em: http://localhost:${PORTA}\n`);
});

module.exports = server;
