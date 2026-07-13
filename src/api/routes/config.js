'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..', '..', '..');
const OVERRIDE = path.join(ROOT, 'config.override.json');

// Carrega defaults direto do módulo de config
const DEFAULTS = require('../../config')._defaults;

function lerOverrides() {
  if (!fs.existsSync(OVERRIDE)) return {};
  try { return JSON.parse(fs.readFileSync(OVERRIDE, 'utf8')); } catch (_) { return {}; }
}

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];

  // GET /api/config — retorna defaults + overrides atuais
  if (url === '/api/config' && req.method === 'GET') {
    const overrides = lerOverrides();
    const atual = {
      bot:    { ...DEFAULTS.bot,    ...(overrides.bot    || {}) },
      server: { ...DEFAULTS.server, ...(overrides.server || {}) },
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ atual, defaults: DEFAULTS }));
    return true;
  }

  // PUT /api/config — salva overrides
  if (url === '/api/config' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const dados = JSON.parse(body);

        // Validações básicas
        const b = dados.bot || {};
        if (b.delayMin !== undefined && (b.delayMin < 1000 || b.delayMin > 300000))
          return respond(400, { ok: false, erro: 'delayMin deve estar entre 1s e 300s.' });
        if (b.delayMax !== undefined && b.delayMax < (b.delayMin ?? DEFAULTS.bot.delayMin))
          return respond(400, { ok: false, erro: 'delayMax deve ser maior que delayMin.' });
        if (b.pausaACada !== undefined && (b.pausaACada < 1 || b.pausaACada > 200))
          return respond(400, { ok: false, erro: 'pausaACada deve ser entre 1 e 200.' });
        if (b.respiroCada !== undefined && (b.respiroCada < 1 || b.respiroCada > 500))
          return respond(400, { ok: false, erro: 'respiroCada deve ser entre 1 e 500.' });

        // Mescla com overrides existentes
        const overrides = lerOverrides();
        const novosOverrides = {
          ...overrides,
          bot:    { ...(overrides.bot    || {}), ...b },
          server: { ...(overrides.server || {}), ...(dados.server || {}) },
        };

        fs.writeFileSync(OVERRIDE, JSON.stringify(novosOverrides, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        respond(400, { ok: false, erro: 'Dados inválidos.' });
      }

      function respond(status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
    });
    return true;
  }

  // DELETE /api/config — restaura defaults
  if (url === '/api/config' && req.method === 'DELETE') {
    if (fs.existsSync(OVERRIDE)) fs.unlinkSync(OVERRIDE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  return false;
}

module.exports = { handler };
