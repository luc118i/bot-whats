#!/usr/bin/env node
'use strict';

// Uso: node scripts/sendAvulso.js --conta=1 --matricula=12345

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path   = require('path');
const config = require('../src/config');
const { lerContatosCompletos } = require('../src/services/spreadsheetService');
const { montarMensagem } = require('../src/utils/message');
const { microPausa } = require('../src/utils/delay');

const ROOT     = path.join(__dirname, '..');
const AUTH_DIR = path.join(ROOT, '.wwebjs_auth');

function criarClienteAvulso(contaId) {
  // Configuração idêntica ao criarCliente() do bot principal (src/bot/client.js)
  // headless: false é necessário — headless: true quebra o envio no whatsapp-web.js
  return new Client({
    authStrategy: new LocalAuth({ clientId: `catedral-conta-${contaId}` }),
    puppeteer: {
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });
}

// Parseia --chave=valor
const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) args[m[1]] = m[2];
});

const contaId  = parseInt(args.conta  || '1', 10);
const matricula = String(args.matricula || '').trim();

if (!matricula) {
  console.error('❌ Matrícula não fornecida. Use --matricula=XXXX');
  process.exit(1);
}

// Verifica se a sessão existe antes de tentar conectar
const sessDir = path.join(AUTH_DIR, `session-catedral-conta-${contaId}`);
if (!require('fs').existsSync(sessDir)) {
  console.error(`❌ Sessão da Conta ${contaId} não encontrada. Conecte a conta em Configurações > Contas WhatsApp antes de enviar.`);
  process.exit(1);
}

async function main() {
  // Localiza o contato na planilha
  const contatos = lerContatosCompletos();
  const contato  = contatos.find(c => String(c.matricula).trim() === matricula);

  if (!contato) {
    console.error(`❌ Matrícula ${matricula} não encontrada na planilha.`);
    process.exit(1);
  }
  if (!contato.celular) {
    console.error(`❌ ${contato.nome} não tem número de celular cadastrado.`);
    process.exit(1);
  }

  const fs = require('fs');
  if (!fs.existsSync(config.paths.imagem)) {
    console.error(`❌ Imagem não encontrada: ${config.paths.imagem}`);
    process.exit(1);
  }

  const media = MessageMedia.fromFilePath(config.paths.imagem);
  console.log(`\n📤 ENVIO AVULSO — Conta ${contaId}`);
  console.log(`   Destinatário: ${contato.nome} (Mat. ${contato.matricula})`);
  console.log(`   Celular:      ${contato.celular}\n`);

  const client = criarClienteAvulso(contaId);

  client.on('qr', qr => {
    console.log(`\n📱 Escaneie o QR Code com a CONTA ${contaId}:\n`);
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => { console.log(`✅ Conta ${contaId} autenticada!\n`); });

  client.on('auth_failure', () => {
    console.error('❌ Falha na autenticação. Sessão expirada — exclua a pasta .wwebjs_auth e escaneie o QR novamente.');
    process.exit(1);
  });

  client.on('disconnected', async reason => {
    console.error(`⚠️  Desconectado: ${reason}`);
    process.exit(1);
  });

  client.on('ready', async () => {
    try {
      const me = client.info;
      console.log(`🔑 Conta conectada: ${me?.wid?.user ?? 'desconhecida'} (${me?.pushname ?? ''})`);

      // Aguarda o WhatsApp sincronizar a tabela de LIDs dos contatos.
      // Sem isso, getNumberId retorna um LID disfarçado (ex: 2257...@c.us) e o envio falha.
      console.log('⏳ Aguardando sincronização de contatos (10s)...');
      await new Promise(resolve => setTimeout(resolve, 10_000));

      console.log(`🚀 Verificando número ${contato.celular}...\n`);
      await microPausa();
      const numeroValido = await client.getNumberId(contato.celular);
      await microPausa();

      if (!numeroValido) {
        console.error(`❌ O número ${contato.celular} não possui WhatsApp.`);
        await client.destroy();
        process.exit(1);
      }

      console.log(`📲 Enviando para: ${numeroValido._serialized}`);

      const mensagem = montarMensagem(contato.nome, contato.matricula);
      const msg = await client.sendMessage(numeroValido._serialized, media, { caption: mensagem });

      console.log(`✅ Mensagem enviada! ID: ${msg.id._serialized}`);
      console.log('⏳ Aguardando confirmação do servidor WhatsApp...');

      // Aguarda ACK do servidor (message_ack) ou no máximo 10s antes de encerrar
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 10_000);
        client.on('message_ack', (m, ack) => {
          if (m.id._serialized === msg.id._serialized && ack >= 1) {
            clearTimeout(timeout);
            console.log(`✅ Confirmado pelo servidor! ACK: ${ack}`);
            resolve();
          }
        });
      });

      await client.destroy();
      process.exit(0);
    } catch (err) {
      console.error(`❌ Erro ao enviar: ${err.message}`);
      try { await client.destroy(); } catch (_) {}
      process.exit(1);
    }
  });

  client.initialize();
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
