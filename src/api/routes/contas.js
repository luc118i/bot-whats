'use strict';

const fs      = require('fs');
const path    = require('path');
const QRCode  = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const ROOT     = path.join(__dirname, '..', '..', '..');
const AUTH_DIR = path.join(ROOT, '.wwebjs_auth');

// ─── Estado em memória ────────────────────────────────────────────────────────
// { [id]: { status: 'idle'|'conectando'|'aguardando_qr'|'conectado'|'erro', qrDataUrl, client, sseClients } }
const estado = new Map();

function getEstado(id) {
  if (!estado.has(id)) {
    estado.set(id, { status: 'idle', qrDataUrl: null, client: null, sseClients: new Set() });
  }
  return estado.get(id);
}

function notificar(id, evt) {
  const e = estado.get(id);
  if (!e) return;
  const msg = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of e.sseClients) {
    try { res.write(msg); } catch (_) {}
  }
}

// ─── Listar contas existentes ─────────────────────────────────────────────────

function listarContas() {
  let contas = [];
  if (fs.existsSync(AUTH_DIR)) {
    contas = fs.readdirSync(AUTH_DIR)
      .filter(d => d.startsWith('session-catedral-conta-'))
      .map(d => {
        const id = parseInt(d.replace('session-catedral-conta-', ''), 10);
        return isNaN(id) ? null : { id, nome: `Conta ${id}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
  }
  // Garante sempre pelo menos conta 1 e 2 na lista (mesmo sem sessão)
  const ids = new Set(contas.map(c => c.id));
  for (const id of [1, 2]) {
    if (!ids.has(id)) contas.push({ id, nome: `Conta ${id}` });
  }
  contas.sort((a, b) => a.id - b.id);

  return contas.map(c => ({
    ...c,
    temSessao: fs.existsSync(path.join(AUTH_DIR, `session-catedral-conta-${c.id}`)),
    status:    estado.get(c.id)?.status ?? 'idle',
  }));
}

// ─── Iniciar conexão ──────────────────────────────────────────────────────────

async function iniciarConexao(id) {
  const e = getEstado(id);
  if (e.client) return; // já tem processo em andamento

  e.status    = 'conectando';
  e.qrDataUrl = null;
  notificar(id, { type: 'status', status: 'conectando' });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `catedral-conta-${id}`, dataPath: AUTH_DIR }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-first-run', '--disable-gpu'],
    },
  });
  e.client = client;

  client.on('qr', async (qr) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
      e.status    = 'aguardando_qr';
      e.qrDataUrl = dataUrl;
      notificar(id, { type: 'qr', qrDataUrl: dataUrl, status: 'aguardando_qr' });
    } catch (_) {}
  });

  client.on('authenticated', () => {
    e.status    = 'conectando';
    e.qrDataUrl = null;
    notificar(id, { type: 'status', status: 'conectando' });
  });

  client.on('auth_failure', async () => {
    e.status = 'erro';
    notificar(id, { type: 'status', status: 'erro', msg: 'Falha na autenticação.' });
    try { await client.destroy(); } catch (_) {}
    e.client = null;
  });

  client.on('ready', () => {
    e.status = 'conectado';
    notificar(id, { type: 'status', status: 'conectado' });
    // Mantém o cliente vivo — será reaproveitado pelo envio avulso
  });

  client.on('disconnected', async () => {
    e.status    = 'idle';
    e.qrDataUrl = null;
    notificar(id, { type: 'status', status: 'idle' });
    try { await client.destroy(); } catch (_) {}
    e.client = null;
  });

  client.initialize().catch(async err => {
    // "Execution context was destroyed" e "detached Frame" são comuns quando a sessão
    // já está autenticada e o WhatsApp navega antes do inject() terminar.
    // O evento 'ready' ainda dispara normalmente — apenas ignoramos o erro aqui.
    const ignoravel = err.message?.includes('Execution context was destroyed')
                   || err.message?.includes('detached Frame')
                   || err.message?.includes('Target closed');
    if (ignoravel) return;

    // Chromium órfão de sessão anterior ainda está rodando e travando a pasta.
    // Solução: remove a sessão corrompida e reinicia do zero (vai mostrar QR).
    const browserOcupado = err.message?.includes('already running')
                        || err.message?.includes('EBUSY');
    if (browserOcupado) {
      console.warn(`[Conta ${id}] Browser órfão detectado — removendo sessão e reiniciando.`);
      try { await client.destroy(); } catch (_) {}
      e.client = null;
      const sessDir = path.join(AUTH_DIR, `session-catedral-conta-${id}`);
      if (fs.existsSync(sessDir)) {
        // Aguarda o processo liberar o lock antes de deletar
        await new Promise(r => setTimeout(r, 2000));
        try { fs.rmSync(sessDir, { recursive: true, force: true }); } catch (_) {}
      }
      // Reconecta automaticamente (vai gerar novo QR)
      e.status = 'idle';
      e.qrDataUrl = null;
      notificar(id, { type: 'status', status: 'idle', msg: 'Sessão anterior removida. Reconectando...' });
      await new Promise(r => setTimeout(r, 1000));
      iniciarConexao(id);
      return;
    }

    console.error(`[Conta ${id}] Erro de inicialização: ${err.message}`);
    e.status = 'erro';
    try { await client.destroy(); } catch (_) {}
    e.client = null;
    notificar(id, { type: 'status', status: 'erro', msg: err.message });
  });
}

// ─── Desconectar / remover sessão ────────────────────────────────────────────

async function desconectar(id) {
  const e = getEstado(id);
  if (e.client) {
    try { await e.client.logout(); } catch (_) {}
    try { await e.client.destroy(); } catch (_) {}
    e.client = null;
  }
  // Remove a pasta de sessão em disco
  const sessDir = path.join(AUTH_DIR, `session-catedral-conta-${id}`);
  if (fs.existsSync(sessDir)) {
    fs.rmSync(sessDir, { recursive: true, force: true });
  }
  e.status    = 'idle';
  e.qrDataUrl = null;
  notificar(id, { type: 'status', status: 'idle' });
}

// ─── Handler HTTP ──────────────────────────────────────────────────────────────

function handler(req, res) {
  const url    = (req.url || '/').split('?')[0];
  const method = req.method;

  // GET /api/contas
  if (url === '/api/contas' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ contas: listarContas() }));
    return true;
  }

  // Rotas com :id
  const matchId     = url.match(/^\/api\/contas\/(\d+)$/);
  const matchAction = url.match(/^\/api\/contas\/(\d+)\/([^/]+)$/);

  // GET /api/contas/:id/eventos — SSE
  if (matchAction && matchAction[2] === 'eventos' && method === 'GET') {
    const id = parseInt(matchAction[1], 10);
    const e  = getEstado(id);
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n\n');
    // Envia estado atual imediatamente
    res.write(`data: ${JSON.stringify({ type: 'status', status: e.status, qrDataUrl: e.qrDataUrl })}\n\n`);
    e.sseClients.add(res);
    req.on('close', () => { e.sseClients.delete(res); });
    return true;
  }

  // GET /api/contas/:id/status
  if (matchId && method === 'GET') {
    const id = parseInt(matchId[1], 10);
    const e  = getEstado(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: e.status, qrDataUrl: e.qrDataUrl, temSessao: fs.existsSync(path.join(AUTH_DIR, `session-catedral-conta-${id}`)) }));
    return true;
  }

  // POST /api/contas/:id/conectar
  if (matchAction && matchAction[2] === 'conectar' && method === 'POST') {
    const id = parseInt(matchAction[1], 10);
    iniciarConexao(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // POST /api/contas/:id/cancelar
  if (matchAction && matchAction[2] === 'cancelar' && method === 'POST') {
    const id = parseInt(matchAction[1], 10);
    const e  = getEstado(id);
    if (e.client) {
      try { e.client.destroy(); } catch (_) {}
      e.client = null;
    }
    e.status    = 'idle';
    e.qrDataUrl = null;
    notificar(id, { type: 'status', status: 'idle' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // DELETE /api/contas/:id — logout + remove sessão
  if (matchId && method === 'DELETE') {
    const id = parseInt(matchId[1], 10);
    desconectar(id).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    });
    return true;
  }

  return false;
}

// Retorna o cliente conectado de uma conta, ou null se não estiver pronto
function getClientConectado(id) {
  const e = estado.get(id);
  if (!e || e.status !== 'conectado' || !e.client) return null;
  // Verifica se o browser ainda está ativo (página pode ter fechado silenciosamente)
  try {
    if (!e.client.pupPage || e.client.pupPage.isClosed()) {
      e.status = 'idle';
      e.client = null;
      return null;
    }
  } catch (_) {
    e.status = 'idle';
    e.client = null;
    return null;
  }
  return e.client;
}

// Limpa o estado de uma conta sem destruir o browser (usado quando a sessão já está morta)
function resetarCliente(id) {
  const e = estado.get(id);
  if (!e) return;
  try { e.client?.destroy(); } catch (_) {}
  e.client = null;
  e.status = 'idle';
  e.qrDataUrl = null;
  notificar(id, { type: 'status', status: 'idle' });
}

module.exports = { handler, listarContas, getClientConectado, resetarCliente };
