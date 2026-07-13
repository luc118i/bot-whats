'use strict';

/**
 * Normaliza um valor bruto de celular (vindo de planilha) para string de dígitos.
 * Remove caracteres não numéricos, arredonda floats do Excel e adiciona DDI 55
 * caso o número tenha 10 ou 11 dígitos.
 * Retorna null se o número resultante for inválido (não tiver 12 ou 13 dígitos).
 *
 * @param {string|number|null|undefined} valor - Valor bruto do campo celular/telefone.
 * @returns {string|null} Número normalizado apenas com dígitos (ex: "5516991234567") ou null.
 */
function normalizarCelular(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  // Trata floats gerados pelo Excel (ex: 16991234567.0 → "16991234567")
  let n = String(Math.round(Number(valor))).replace(/\D/g, '');

  if (!n) return null;

  if (n.length === 10 || n.length === 11) {
    n = '55' + n;
  }

  if (n.length < 12 || n.length > 13) return null;

  return n;
}

/**
 * Converte um número normalizado (somente dígitos) para o formato aceito pela
 * API do whatsapp-web.js como ID de chat.
 *
 * @param {string} numero - Número com DDI, somente dígitos (ex: "5516991234567").
 * @returns {string} Número no formato WhatsApp (ex: "5516991234567@c.us").
 */
function formatarParaWhatsApp(numero) {
  return `${numero}@c.us`;
}

module.exports = { normalizarCelular, formatarParaWhatsApp };
