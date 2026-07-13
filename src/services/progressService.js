'use strict';

const fs = require('fs');
const config = require('../config');

const ARQUIVO = config.paths.progresso;

/**
 * Carrega o arquivo de progresso (progresso.json) do disco.
 * Retorna um objeto vazio se o arquivo não existir.
 *
 * @returns {Object.<string, Object>} Mapa de matrícula para registro de progresso.
 */
function carregar() {
  if (fs.existsSync(ARQUIVO)) {
    return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  }
  return {};
}

/**
 * Persiste o objeto de progresso no disco como JSON formatado.
 *
 * @param {Object.<string, Object>} progresso - Mapa de matrícula para registro de progresso.
 * @returns {void}
 */
function salvar(progresso) {
  fs.writeFileSync(ARQUIVO, JSON.stringify(progresso, null, 2), 'utf8');
}

/**
 * Atualiza de forma atômica o registro de um único motorista no progresso.
 * Lê o arquivo atual antes de escrever para evitar conflito entre múltiplas contas
 * rodando em paralelo.
 *
 * @param {string} matricula - Matrícula do motorista a ser atualizado.
 * @param {Object} dados - Dados a serem gravados (status, celular, print, erro, etc.).
 * @returns {void}
 */
function marcar(matricula, dados) {
  const prog = carregar();
  prog[matricula] = { ...dados, enviadoEm: new Date().toLocaleString('pt-BR') };
  salvar(prog);
}

module.exports = { carregar, salvar, marcar };
