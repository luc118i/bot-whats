'use strict';

const { spawn } = require('child_process');
const path = require('path');
const logService = require('../services/logService');

const ROOT = path.join(__dirname, '..', '..');

// Processo ativo no momento (modo spawn — child_process)
let activeProcess = null;
// Tarefa ativa no momento (modo in-process — reaproveita sessão já conectada)
let activeCancelToken = null;
let activeCommand = null;

// Clientes SSE conectados para streaming de log
const sseClients = new Set();

// Callbacks de ciclo de vida para integração com campanhas
const _onEnd = [];
function onEnd(cb) { _onEnd.push(cb); }

function broadcast(line) {
  logService.salvar(line);
  const msg = `data: ${JSON.stringify(line)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) {}
  }
}

function addSseClient(res) {
  sseClients.add(res);
  res.on('close', () => sseClients.delete(res));
}

function getStatus() {
  return {
    running: activeProcess !== null || activeCancelToken !== null,
    command: activeCommand,
  };
}

function run(command, args) {
  if (activeProcess || activeCancelToken) {
    return { ok: false, erro: 'Já existe um processo rodando. Pare-o antes de iniciar outro.' };
  }

  activeCommand = command;
  broadcast({ type: 'start', command });

  const proc = spawn('node', args, {
    cwd: ROOT,
    env: { ...process.env },
    // não abre janela no Windows
    windowsHide: false,
  });

  activeProcess = proc;

  proc.stdout.on('data', (data) => {
    String(data).split('\n').filter(Boolean).forEach((line) => {
      broadcast({ type: 'log', text: line });
    });
  });

  proc.stderr.on('data', (data) => {
    String(data).split('\n').filter(Boolean).forEach((line) => {
      broadcast({ type: 'log', text: line });
    });
  });

  proc.on('close', (code) => {
    broadcast({ type: 'end', code });
    activeProcess = null;
    activeCommand = null;
    _onEnd.forEach(cb => { try { cb(code); } catch (_) {} });
  });

  proc.on('error', (err) => {
    broadcast({ type: 'log', text: `ERRO: ${err.message}` });
    broadcast({ type: 'end', code: 1 });
    activeProcess = null;
    activeCommand = null;
  });

  return { ok: true };
}

/**
 * Roda uma tarefa assíncrona dentro do próprio processo do servidor, em vez de
 * abrir um processo `node` novo. Usado pelo envio de campanha para poder
 * reaproveitar sessões WhatsApp já conectadas em memória (ver src/bot/campaign.js)
 * — abrir um processo `node` separado sempre cria um Chromium novo apontando para
 * a mesma pasta de sessão, o que causa o erro "browser already running" quando a
 * conta já está conectada pelo painel.
 *
 * @param {string} command - Nome do comando (para exibição/status).
 * @param {(ctx: { log: (text: string) => void, cancelToken: { cancelado: boolean } }) => Promise<void>} taskFn
 */
function runInProcess(command, taskFn) {
  if (activeProcess || activeCancelToken) {
    return { ok: false, erro: 'Já existe um processo rodando. Pare-o antes de iniciar outro.' };
  }

  activeCommand = command;
  broadcast({ type: 'start', command });

  const log = (text) => broadcast({ type: 'log', text: String(text) });
  const cancelToken = { cancelado: false };
  activeCancelToken = cancelToken;

  const finalizar = (code) => {
    broadcast({ type: 'end', code });
    activeCommand = null;
    activeCancelToken = null;
    _onEnd.forEach(cb => { try { cb(code); } catch (_) {} });
  };

  taskFn({ log, cancelToken })
    .then(() => finalizar(0))
    .catch((err) => {
      log(`❌ Erro: ${err.message}`);
      finalizar(1);
    });

  return { ok: true };
}

function stop() {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    broadcast({ type: 'log', text: '⛔ Processo encerrado pelo usuário.' });
    broadcast({ type: 'end', code: null });
    activeProcess = null;
    activeCommand = null;
    return { ok: true };
  }
  if (activeCancelToken) {
    activeCancelToken.cancelado = true;
    broadcast({ type: 'log', text: '⛔ Encerrando após o envio atual...' });
    return { ok: true };
  }
  return { ok: false, erro: 'Nenhum processo rodando.' };
}

module.exports = { run, runInProcess, stop, getStatus, addSseClient, onEnd, broadcast };
