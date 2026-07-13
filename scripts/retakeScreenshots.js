#!/usr/bin/env node
'use strict';

// Retira prints de chats para motoristas que foram marcados como ENVIADO
// mas cujo arquivo de print está ausente ou corrompido.
// Uso: node scripts/retakeScreenshots.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { carregar, salvar } = require('../src/services/progressService');
const { sleep } = require('../src/utils/delay');

const PASTA_PRINTS = config.paths.prints;

if (!fs.existsSync(PASTA_PRINTS)) {
  fs.mkdirSync(PASTA_PRINTS, { recursive: true });
}

/**
 * Lista todos os motoristas com status ENVIADO mas sem print válido no disco.
 *
 * @returns {Array<{nome: string, matricula: string, celular: string}>}
 *   Motoristas que precisam ter o print retirado.
 */
function listarSemPrint() {
  const prog = carregar();
  return Object.values(prog).filter(
    (v) =>
      v.status === 'ENVIADO' &&
      (!v.print || !fs.existsSync(v.print)) &&
      v.celular
  );
}

/**
 * Tira um screenshot do chat de um motorista no WhatsApp Web.
 * Procura o chat pelo número (últimos 8 dígitos) na lista de conversas.
 * Faz fallback para o primeiro chat se não encontrar o número exato.
 *
 * @param {import('puppeteer').Page} page - Página Puppeteer do cliente WhatsApp Web.
 * @param {string} celular - Número do motorista (somente dígitos, sem @c.us).
 * @param {string} nome - Nome do motorista para nomear o arquivo PNG.
 * @returns {Promise<string|null>} Caminho do arquivo de print ou null em caso de falha.
 */
async function tirarPrint(page, celular, nome) {
  try {
    const nomeArquivo = nome.replace(/[^a-zA-Z0-9]/g, '_');
    const caminhoArquivo = path.join(PASTA_PRINTS, `${nomeArquivo}_${celular}.png`);

    await page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 6000 });

    // Procura o chat do motorista pelos últimos 8 dígitos do número
    const chatEncontrado = await page.evaluate((num) => {
      const itens = document.querySelectorAll('[data-testid="cell-frame-container"]');
      const ultimos = num.slice(-8);
      for (const item of itens) {
        const texto = item.innerText || '';
        if (texto.includes(ultimos)) {
          item.click();
          return true;
        }
      }
      // Fallback: clica no primeiro chat da lista
      if (itens[0]) {
        itens[0].click();
        return true;
      }
      return false;
    }, celular);

    if (!chatEncontrado) return null;

    await page.waitForSelector('#main .message-out', { timeout: 8000 });
    await sleep(1500);

    const chatPanel = await page.$('#main');
    if (chatPanel) {
      await chatPanel.screenshot({ path: caminhoArquivo });
      return caminhoArquivo;
    }
  } catch (e) {
    console.log(`  ⚠️  Falhou: ${e.message}`);
  }
  return null;
}

/**
 * Ponto de entrada do script de retirada de prints.
 * Inicializa um cliente WhatsApp, aguarda autenticação e itera pelos motoristas
 * sem print para capturar as confirmações de envio.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const semPrint = listarSemPrint();

  console.log('═══════════════════════════════════════════');
  console.log('   CATEDRAL — RETIRAR PRINTS PENDENTES    ');
  console.log('═══════════════════════════════════════════\n');
  console.log(`📋 Motoristas sem print: ${semPrint.length}\n`);

  if (semPrint.length === 0) {
    console.log('✅ Todos os enviados já têm print!');
    process.exit(0);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'catedral-conta-1' }),
    puppeteer: { headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  client.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => console.log('✅ Autenticado!\n'));

  client.on('ready', async () => {
    console.log('🚀 Pronto! Tirando prints...\n');
    const page = client.pupPage;
    const prog = carregar();
    let ok = 0;
    let falhou = 0;

    for (let i = 0; i < semPrint.length; i++) {
      const { nome, matricula, celular } = semPrint[i];
      console.log(`[${i + 1}/${semPrint.length}] 📸 ${nome}`);

      const printPath = await tirarPrint(page, celular, nome);

      if (printPath) {
        prog[matricula].print = printPath;
        salvar(prog);
        console.log('  ✅ Print salvo!');
        ok++;
      } else {
        falhou++;
      }

      if (i < semPrint.length - 1) await sleep(2000);
    }

    console.log(`\n📊 Resultado: ✅ ${ok} prints tirados | ❌ ${falhou} falharam`);
    try {
      await client.destroy();
    } catch (_) {}
    process.exit(0);
  });

  client.on('auth_failure', () => {
    console.error('❌ Falha na autenticação.');
    process.exit(1);
  });

  client.on('disconnected', () => {
    console.log('⚠️  Desconectado.');
    process.exit(0);
  });

  await client.initialize();
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
