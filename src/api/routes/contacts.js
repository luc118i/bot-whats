'use strict';

const { parse } = require('url');
const fs   = require('fs');
const path = require('path');
const { lerContatosCompletos, atualizarContato, criarContato } = require('../../services/spreadsheetService');
const config = require('../../config');

const ROOT          = path.join(__dirname, '..', '..', '..');
const SNAPSHOTS_DIR = path.join(ROOT, 'snapshots');

function resolverProgresso(campanhaId) {
  if (campanhaId) {
    const snap = path.join(SNAPSHOTS_DIR, `${campanhaId}.json`);
    if (fs.existsSync(snap)) return snap;
  }
  return config.paths.progresso;
}

const STATUS_LABEL = {
  ENVIADO:      'Enviado',
  PENDENTE:     'Pendente',
  SEM_NUMERO:   'Sem número',
  SEM_WHATSAPP: 'Sem WhatsApp',
  FALHOU:       'Falhou',
  PROCESSANDO:  'Processando',
  DUPLICADO:    'Duplicado',
};

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];

  // PUT /api/contatos/:matricula — atualizar dados de um motorista
  const matchEdit = url.match(/^\/api\/contatos\/(.+)$/);
  if (matchEdit && req.method === 'PUT') {
    const matricula = decodeURIComponent(matchEdit[1]);
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const dados = JSON.parse(body);
        const result = atualizarContato(matricula, dados);
        res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: 'Dados inválidos.' }));
      }
    });
    return true;
  }

  // POST /api/contatos — criar novo motorista
  if (url === '/api/contatos' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const dados = JSON.parse(body);
        const result = criarContato(dados);
        res.writeHead(result.ok ? 201 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: 'Dados inválidos.' }));
      }
    });
    return true;
  }

  if (url !== '/api/contatos' || req.method !== 'GET') return false;

  const qs = parse(req.url, true).query;
  const search    = (qs.search   || '').toLowerCase();
  const status    = (qs.status   || 'ALL').toUpperCase();
  const base      = (qs.base     || 'ALL').toUpperCase();
  const campanha  = qs.campanha  || null;
  const page      = Math.max(1, parseInt(qs.page)  || 1);
  const perPage   = Math.min(500, parseInt(qs.per_page) || 50);

  // Carrega progresso (snapshot da campanha ou global)
  let progresso = {};
  const progressoPath = resolverProgresso(campanha);
  if (fs.existsSync(progressoPath)) {
    try { progresso = JSON.parse(fs.readFileSync(progressoPath, 'utf8')); } catch (_) {}
  }

  // Merge planilha + progresso
  const contatos = lerContatosCompletos().map(m => {
    const p = progresso[m.matricula];
    const statusAtual = p ? p.status : (m.semNumero ? 'SEM_NUMERO' : 'PENDENTE');
    return {
      nome:       m.nome,
      matricula:  m.matricula,
      celular:    m.celular ? `+${m.celular}` : null,
      base:       m.base,
      status:     statusAtual,
      statusLabel: STATUS_LABEL[statusAtual] || statusAtual,
      enviadoEm:  p?.enviadoEm || null,
      conta:      p?.conta     || null,
      temPrint:   !!(p?.print && fs.existsSync(p.print)),
    };
  });

  // Bases únicas para o filtro
  const bases = [...new Set(contatos.map(c => c.base).filter(b => b && b !== '—'))].sort();

  // Filtros
  let resultado = contatos;
  if (search) {
    resultado = resultado.filter(c =>
      c.nome.toLowerCase().includes(search) ||
      c.matricula.toLowerCase().includes(search) ||
      (c.celular || '').includes(search)
    );
  }
  if (status !== 'ALL') {
    resultado = resultado.filter(c => c.status === status);
  }
  if (base !== 'ALL') {
    resultado = resultado.filter(c => c.base.toUpperCase() === base);
  }

  // Paginação
  const total = resultado.length;
  const totalPages = Math.ceil(total / perPage);
  const dados = resultado.slice((page - 1) * perPage, page * perPage);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ contatos: dados, total, page, totalPages, bases }));
  return true;
}

module.exports = { handler };
