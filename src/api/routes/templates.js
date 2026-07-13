'use strict';

const svc = require('../../services/templatesService');

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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

  if (url !== '/api/templates') return false;

  if (method === 'GET') {
    json(res, 200, svc.carregar());
    return true;
  }

  if (method === 'PUT') {
    body(req).then(data => {
      const atual = svc.carregar();
      const novo = {
        ctas:    Array.isArray(data.ctas)    ? data.ctas    : atual.ctas,
        rodapes: Array.isArray(data.rodapes) ? data.rodapes : atual.rodapes,
      };
      svc.salvar(novo);
      json(res, 200, { ok: true, ...novo });
    }).catch(() => json(res, 400, { ok: false, erro: 'Dados inválidos.' }));
    return true;
  }

  if (method === 'DELETE') {
    const atual = svc.carregar();
    const { tipo, index } = (() => {
      try { return JSON.parse(req.url.split('?')[1] || '{}'); } catch (_) { return {}; }
    })();
    // DELETE via query string não é padrão — usamos PUT mesmo
    json(res, 405, { ok: false, erro: 'Use PUT.' });
    return true;
  }

  return false;
}

module.exports = { handler };
