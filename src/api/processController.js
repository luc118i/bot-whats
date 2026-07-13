'use strict';

const { spawn } = require('child_process');
const path = require('path');
const logService = require('../services/logService');

const ROOT = path.join(__dirname, '..', '..');

// Processo ativo no momento
let activeProcess = null;
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
    running: activeProcess !== null,
    command: activeCommand,
  };
}

function run(command, args) {
  if (activeProcess) {
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

function stop() {
  if (!activeProcess) return { ok: false, erro: 'Nenhum processo rodando.' };
  activeProcess.kill('SIGTERM');
  broadcast({ type: 'log', text: '⛔ Processo encerrado pelo usuário.' });
  broadcast({ type: 'end', code: null });
  activeProcess = null;
  activeCommand = null;
  return { ok: true };
}

module.exports = { run, stop, getStatus, addSseClient, onEnd, broadcast };
