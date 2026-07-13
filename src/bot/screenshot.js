'use strict';

const path = require('path');
const { sleep } = require('../utils/delay');
const config = require('../config');

const PASTA_PRINTS = config.paths.prints;

/**
 * Tira um screenshot do painel de chat do WhatsApp Web para o contato especificado.
 * Clica no primeiro chat da lista (o mais recente) e aguarda as mensagens carregarem.
 * O arquivo PNG é salvo em `output/prints/` com nome baseado no nome e número do motorista.
 *
 * @param {import('puppeteer').Page} page - Página Puppeteer do cliente WhatsApp Web.
 * @param {string} numero - Número WhatsApp serializado (ex: "5516991234567@c.us").
 * @param {string} nome - Nome do motorista (usado para nomear o arquivo).
 * @param {string} prefixo - Prefixo de log da conta (ex: "[CONTA 1]").
 * @returns {Promise<string|null>} Caminho absoluto do arquivo de print ou null em caso de falha.
 */
async function tirarPrint(page, numero, nome, prefixo) {
  try {
    const nomeArquivo = nome.replace(/[^a-zA-Z0-9]/g, '_');
    const numeroLimpo = numero.replace('@c.us', '').replace('@lid', '');
    const caminhoArquivo = path.join(PASTA_PRINTS, `${nomeArquivo}_${numeroLimpo}.png`);

    // O chat mais recente sempre fica no topo da lista — clica nele
    await page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 6000 });
    const primeiroChat = await page.$('[data-testid="cell-frame-container"]');
    if (primeiroChat) await primeiroChat.click();

    // Aguarda o painel do chat abrir com mensagens enviadas
    await page.waitForSelector('#main .message-out', { timeout: 8000 });

    // Aguarda renderização completa
    await sleep(1500);

    // Print apenas do painel direito (#main) para não capturar a lista de chats
    const chatPanel = await page.$('#main');
    if (chatPanel) {
      await chatPanel.screenshot({ path: caminhoArquivo });
    } else {
      await page.screenshot({ path: caminhoArquivo });
    }

    return caminhoArquivo;
  } catch (e) {
    console.log(`${prefixo} ⚠️  Print falhou: ${e.message}`);
    return null;
  }
}

module.exports = { tirarPrint };
