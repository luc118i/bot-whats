'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');

/**
 * Cria e configura uma instância do cliente WhatsApp com autenticação local persistente.
 * Cada conta recebe um clientId único para que as sessões não se misturem.
 * O navegador é aberto em modo visível (headless: false) para permitir scan do QR.
 *
 * @param {number} contaId - Identificador numérico da conta (1, 2, ...).
 * @returns {Client} Instância configurada do whatsapp-web.js Client.
 */
function criarCliente(contaId) {
  return new Client({
    authStrategy: new LocalAuth({ clientId: `catedral-conta-${contaId}` }),
    puppeteer: {
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });
}

module.exports = { criarCliente };
