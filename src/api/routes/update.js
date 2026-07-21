'use strict';

const { atualizarNumeros } = require('../../services/spreadsheetService');
const campanhasSvc = require('../../services/campanhasService');
const progressService = require('../../services/progressService');

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
      // Limpa o SEM_NUMERO no progresso da campanha ativa, se houver, senão no
      // arquivo legado global — evitar mexer num arquivo que ninguém mais lê.
      const ativa = campanhasSvc.obterAtiva();
      const arquivoProgresso = progressService.caminho(ativa?.id);
      const resultado = atualizarNumeros(motoristas, arquivoProgresso);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...resultado }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
  });
}

module.exports = { handler };
