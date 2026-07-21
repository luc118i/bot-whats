'use strict';

const { lerMotoristas } = require('../../services/spreadsheetService');
const campanhasSvc = require('../../services/campanhasService');
const progressService = require('../../services/progressService');

/**
 * Calcula estatísticas atuais de envio cruzando a planilha com o progresso.
 * Usa o progresso da campanha ativa, se houver, senão o arquivo legado global.
 * Pendentes = motoristas ainda não tentados (não aparecem no progresso) somados
 * aos explicitamente marcados como PENDENTE — não deve ser confundido com FALHOU.
 *
 * @returns {{ total: number, enviados: number, semNumero: number, semWhatsapp: number, pendentes: number }}
 *   Objeto com contagens de motoristas por categoria.
 */
function calcularStats() {
  let motoristas = [];
  try { motoristas = lerMotoristas(); } catch (_) {}
  const total = motoristas.length;

  const ativa = campanhasSvc.obterAtiva();
  const entries = Object.values(progressService.carregar(ativa?.id));

  const enviados    = entries.filter((v) => v.status === 'ENVIADO').length;
  const semNumero   = entries.filter((v) => v.status === 'SEM_NUMERO').length;
  const semWhatsapp = entries.filter((v) => v.status === 'SEM_WHATSAPP').length;
  const pendentes   = entries.filter((v) => v.status === 'PENDENTE').length + Math.max(0, total - entries.length);

  return { total, enviados, semNumero, semWhatsapp, pendentes };
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
