'use strict';

const logService = require('../../services/logService');
const { parse } = require('url');

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];

  // GET /api/logs/history?kind=ERROR&search=João&limit=200&offset=0
  if (url === '/api/logs/history' && req.method === 'GET') {
    const qs = parse(req.url, true).query;
    const result = logService.ler({
      kind:   qs.kind   || 'ALL',
      search: qs.search || '',
      limit:  parseInt(qs.limit)  || 200,
      offset: parseInt(qs.offset) || 0,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  // DELETE /api/logs/history  — limpar histórico
  if (url === '/api/logs/history' && req.method === 'DELETE') {
    logService.limpar();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  return false;
}

module.exports = { handler };
