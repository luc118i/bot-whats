'use strict';

const { run, stop, getStatus, addSseClient, broadcast } = require('../processController');
const { getClientConectado } = require('./contas');
const { lerContatosCompletos } = require('../../services/spreadsheetService');
const { montarMensagem } = require('../../utils/message');
const { MessageMedia } = require('whatsapp-web.js');
const { microPausa } = require('../../utils/delay');
const config = require('../../config');
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');

// Garante que só um avulso rode por vez
let avulsoAtivo = false;

// Roda sendAvulso como processo independente (não bloqueia o singleton do bot)
function spawnAvulso(args, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', args, {
      cwd: ROOT,
      env: { ...process.env },
      windowsHide: false,
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Tempo limite excedido (90s). Verifique se a conta está conectada em Configurações.'));
    }, timeoutMs);

    let stderr = '';
    proc.stdout.on('data', d => {
      String(d).split('\n').filter(Boolean).forEach(line => broadcast({ type: 'log', text: line }));
    });
    proc.stderr.on('data', d => {
      const text = String(d);
      stderr += text;
      text.split('\n').filter(Boolean).forEach(line => broadcast({ type: 'log', text: line }));
    });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true });
      else reject(new Error(stderr.trim() || `Processo encerrou com código ${code}`));
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

const SCRIPTS = {
  send:          ['scripts/send.js'],
  'send-dual':   ['scripts/send.js', '2'],
  retake:        ['scripts/retakeScreenshots.js'],
  contacts:      ['scripts/generateContacts.js'],
};

function handler(req, res) {
  const url = (req.url || '/').split('?')[0];

  // SSE — streaming de logs em tempo real
  if (url === '/api/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n\n');
    addSseClient(res);
    return true;
  }

  // Status do processo
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStatus()));
    return true;
  }

  // Iniciar comando
  const matchRun = url.match(/^\/api\/run\/(.+)$/);
  if (matchRun && req.method === 'POST') {
    const cmd = matchRun[1];
    const args = SCRIPTS[cmd];
    if (!args) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, erro: `Comando desconhecido: ${cmd}` }));
      return true;
    }
    const result = run(cmd, args);
    res.writeHead(result.ok ? 200 : 409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  // Envio avulso: POST /api/envio-avulso  body: { contaId, matricula, campanhaId? }
  if (url === '/api/envio-avulso' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let dados;
      try { dados = JSON.parse(body || '{}'); } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: 'Dados inválidos.' }));
        return;
      }
      const { contaId, matricula } = dados;
      if (!contaId || !matricula) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: 'contaId e matricula são obrigatórios.' }));
        return;
      }
      if (avulsoAtivo) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: 'Já existe um envio avulso em andamento. Aguarde terminar.' }));
        return;
      }

      const client = getClientConectado(contaId);
      if (!client) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: `Conta ${contaId} não está conectada. Conecte em Configurações > Contas WhatsApp e tente novamente.` }));
        return;
      }

      avulsoAtivo = true;

      // Envia direto pelo cliente em memória — sem abrir novo Chromium
      (async () => {
        try {
          const mat = String(matricula).trim();
          const contatos = lerContatosCompletos();
          const contato  = contatos.find(c => String(c.matricula).trim() === mat);
          if (!contato) throw new Error(`Matrícula ${mat} não encontrada na planilha.`);
          if (!contato.celular) throw new Error(`${contato.nome} não tem celular cadastrado.`);

          broadcast({ type: 'log', text: `📤 ENVIO AVULSO — Conta ${contaId}` });
          broadcast({ type: 'log', text: `   Destinatário: ${contato.nome} (Mat. ${mat})` });
          broadcast({ type: 'log', text: `   Celular: ${contato.celular}` });

          const media    = MessageMedia.fromFilePath(config.paths.imagem);
          const mensagem = montarMensagem(contato.nome, contato.matricula);

          // Estratégia: envia direto via @c.us — WhatsApp resolve LID internamente.
          // Se falhar com erro de LID, cai para getNumberId() como fallback.
          const numeroPuro = String(contato.celular).replace(/\D/g, '');
          const chatIdDireto = `${numeroPuro}@c.us`;
          broadcast({ type: 'log', text: `📲 Enviando para: ${chatIdDireto}` });

          let msg;
          try {
            msg = await client.sendMessage(chatIdDireto, media, { caption: mensagem });
          } catch (errDireto) {
            const precisaLid = errDireto.message?.toLowerCase().includes('lid')
                            || errDireto.message?.toLowerCase().includes('no lid');
            if (!precisaLid) throw errDireto;

            // Fallback: resolve via getNumberId (retorna @lid para contas migradas)
            broadcast({ type: 'log', text: `⚠️  @c.us falhou — resolvendo via LID...` });
            await microPausa();
            const wid = await client.getNumberId(numeroPuro);
            if (!wid) throw new Error(`Número ${contato.celular} não possui WhatsApp.`);
            broadcast({ type: 'log', text: `📲 Re-enviando para: ${wid._serialized}` });
            msg = await client.sendMessage(wid._serialized, media, { caption: mensagem });
          }

          broadcast({ type: 'log', text: `✅ Enviado! ID: ${msg.id._serialized}` });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          // Sessão perdeu o contexto da página (WWebJS não injetado / browser morreu)
          const sessaoMorta = err.message?.includes('getChat')
                           || err.message?.includes('WWebJS')
                           || err.message?.includes('pupPage')
                           || err.message?.includes('Execution context');
          if (sessaoMorta) {
            // Limpa o estado para que o frontend mostre "Desconectado"
            const { resetarCliente } = require('./contas');
            resetarCliente(contaId);
          }
          const msgErro = sessaoMorta
            ? `Sessão da Conta ${contaId} perdida. Reconecte em Configurações > Contas WhatsApp e tente novamente.`
            : (err.message || 'Falha no envio.');
          broadcast({ type: 'log', text: `❌ Erro no envio avulso: ${msgErro}` });
          res.writeHead(sessaoMorta ? 400 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, erro: msgErro }));
        } finally {
          avulsoAtivo = false;
        }
      })();
    });
    return true;
  }

  // Parar processo
  if (url === '/api/stop' && req.method === 'POST') {
    const result = stop();
    res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  return false;
}

module.exports = { handler };
