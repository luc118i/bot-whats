'use strict';

const fs = require('fs');
const { lerLinhasBrutas } = require('../../services/spreadsheetService');
const config = require('../../config');

const PROGRESSO = config.paths.progresso;

/**
 * Calcula estatísticas atuais de envio cruzando a planilha com o progresso.json.
 *
 * @returns {{ total: number, enviados: number, semNumero: number, pendentes: number }}
 *   Objeto com contagens de motoristas por categoria.
 */
function calcularStats() {
  const rows = lerLinhasBrutas();
  const header = rows[1];
  const idxNome = header.indexOf('Nome');
  const idxCelular = header.indexOf('Celular');
  const idxTelefone = header.indexOf('Telefone');

  let total = 0;
  let semNumero = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r[idxNome]) continue;
    total++;
    if (!r[idxCelular] && !r[idxTelefone]) semNumero++;
  }

  let enviados = 0;
  let pendentes = 0;

  if (fs.existsSync(PROGRESSO)) {
    const p = JSON.parse(fs.readFileSync(PROGRESSO, 'utf8'));
    enviados = Object.values(p).filter((v) => v.status === 'ENVIADO').length;
    pendentes = Object.values(p).filter((v) => v.status === 'FALHOU').length;
  }

  return { total, enviados, semNumero, pendentes };
}

/**
 * Handler HTTP para GET /api/stats.
 * Responde com JSON contendo as estatísticas atuais de envio.
 *
 * @param {import('http').IncomingMessage} req - Requisição HTTP.
 * @param {import('http').ServerResponse} res - Resposta HTTP.
 * @returns {void}
 */
function handler(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(calcularStats()));
}

module.exports = { handler, calcularStats };
