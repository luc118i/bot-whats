'use strict';

const fs = require('fs');
const config = require('../../config');

const MODELO = config.paths.modeloSemNumero;

const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Handler HTTP para GET /baixar-modelo.
 * Serve o arquivo `motoristas_sem_numero.xlsx` como download para o usuário.
 * Retorna 404 se o arquivo não existir no caminho configurado.
 *
 * @param {import('http').IncomingMessage} req - Requisição HTTP.
 * @param {import('http').ServerResponse} res - Resposta HTTP.
 * @returns {void}
 */
function handler(req, res) {
  if (fs.existsSync(MODELO)) {
    res.writeHead(200, {
      'Content-Type': MIME_XLSX,
      'Content-Disposition': 'attachment; filename="motoristas_sem_numero.xlsx"',
    });
    fs.createReadStream(MODELO).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Arquivo não encontrado');
  }
}

module.exports = { handler };
