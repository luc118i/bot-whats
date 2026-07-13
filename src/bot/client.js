'use strict';

const fs   = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const AUTH_DIR = path.join(__dirname, '..', '..', '.wwebjs_auth');

/**
 * Verifica se já existe uma sessão salva para a conta (login já foi escaneado antes).
 *
 * @param {number} contaId
 * @returns {boolean}
 */
function sessaoExiste(contaId) {
  return fs.existsSync(path.join(AUTH_DIR, `session-catedral-conta-${contaId}`));
}

/**
 * Cria e configura uma instância do cliente WhatsApp com autenticação local persistente.
 * Cada conta recebe um clientId único para que as sessões não se misturem.
 * O navegador abre visível apenas na primeira execução (sem sessão salva), para
 * permitir o scan do QR Code; nas execuções seguintes roda oculto (headless).
 *
 * @param {number} contaId - Identificador numérico da conta (1, 2, ...).
 * @returns {Client} Instância configurada do whatsapp-web.js Client.
 */
function criarCliente(contaId) {
  return new Client({
    authStrategy: new LocalAuth({ clientId: `catedral-conta-${contaId}` }),
    puppeteer: {
      headless: sessaoExiste(contaId),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });
}

module.exports = { criarCliente };
