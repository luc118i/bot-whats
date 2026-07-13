'use strict';

const { atualizarNumeros } = require('../../services/spreadsheetService');
const config = require('../../config');

const PROGRESSO = config.paths.progresso;

/**
 * Handler HTTP para POST /api/atualizar.
 * Recebe um JSON com a lista de motoristas e seus novos números,
 * atualiza a planilha principal e remove do progresso.json
 * quaisquer entradas SEM_NUMERO que receberam número.
 *
 * Body esperado: `{ "motoristas": [{ "matricula": "1234", "celular": "16991234567" }, ...] }`
 *
 * Resposta de sucesso: `{ "ok": true, "atualizados": N, "naoEncontrados": M }`
 * Resposta de erro:    `{ "ok": false, "erro": "mensagem de erro" }`
 *
 * @param {import('http').IncomingMessage} req - Requisição HTTP POST.
 * @param {import('http').ServerResponse} res - Resposta HTTP.
 * @returns {void}
 */
function handler(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const { motoristas } = JSON.parse(body);
      const resultado = atualizarNumeros(motoristas, PROGRESSO);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...resultado }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  });
}

module.exports = { handler };
