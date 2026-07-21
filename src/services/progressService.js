'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const ARQUIVO_GLOBAL = config.paths.progresso;
const DIR_CAMPANHAS = config.paths.progressoDir;
// Campanhas criadas antes da migração para arquivo por campanha tinham o
// progresso salvo aqui (ver campanhasService.js, removido). Mantido só como
// fonte de recuperação para campanhas antigas — ver migrarSnapshotSeExistir().
const SNAPSHOTS_DIR = path.join(path.dirname(DIR_CAMPANHAS), 'snapshots');

/**
 * Resolve o arquivo de progresso a usar: um arquivo próprio por campanha
 * (`progresso/<campanhaId>.json`), nunca compartilhado entre campanhas, ou o
 * arquivo legado global (`progresso.json`) quando não há `campanhaId` — usado
 * pelo fluxo avulso/standalone (ex: scripts/send.js, envio sem campanha ativa).
 *
 * @param {string} [campanhaId]
 * @returns {string} Caminho absoluto do arquivo.
 */
function caminho(campanhaId) {
  return campanhaId ? path.join(DIR_CAMPANHAS, `${campanhaId}.json`) : ARQUIVO_GLOBAL;
}

// Se uma campanha antiga (de antes da migração para arquivo por campanha) ainda
// não tem progresso/<id>.json mas tem um snapshots/<id>.json com dados reais,
// copia para o lugar novo antes de qualquer leitura — sem isso, retomar essa
// campanha faria o bot achar que nada foi enviado ainda e reprocessar todo mundo
// (incidente real: ver conversa de 21/07/2026, campanha "INFORMATIVO CORITO").
function migrarSnapshotSeExistir(campanhaId, arquivo) {
  if (!campanhaId || fs.existsSync(arquivo)) return;
  const snap = path.join(SNAPSHOTS_DIR, `${campanhaId}.json`);
  if (!fs.existsSync(snap)) return;
  try {
    const dados = JSON.parse(fs.readFileSync(snap, 'utf8'));
    if (Object.keys(dados).length === 0) return;
    if (!fs.existsSync(DIR_CAMPANHAS)) fs.mkdirSync(DIR_CAMPANHAS, { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Carrega o progresso do disco. Retorna um objeto vazio se o arquivo não existir.
 *
 * @param {string} [campanhaId] - Se informado, carrega o progresso dessa campanha.
 *   Se ausente, carrega o arquivo legado global.
 * @returns {Object.<string, Object>} Mapa de matrícula para registro de progresso.
 */
function carregar(campanhaId) {
  const arquivo = caminho(campanhaId);
  migrarSnapshotSeExistir(campanhaId, arquivo);
  if (fs.existsSync(arquivo)) {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  }
  return {};
}

/**
 * Persiste o objeto de progresso no disco como JSON formatado.
 *
 * @param {Object.<string, Object>} progresso - Mapa de matrícula para registro de progresso.
 * @param {string} [campanhaId] - Se informado, grava no arquivo dessa campanha.
 * @returns {void}
 */
function salvar(progresso, campanhaId) {
  const arquivo = caminho(campanhaId);
  if (campanhaId && !fs.existsSync(DIR_CAMPANHAS)) fs.mkdirSync(DIR_CAMPANHAS, { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(progresso, null, 2), 'utf8');
}

/**
 * Atualiza de forma atômica o registro de um único motorista no progresso.
 * Lê o arquivo atual antes de escrever para evitar conflito entre múltiplas contas
 * rodando em paralelo.
 *
 * @param {string} matricula - Matrícula do motorista a ser atualizado.
 * @param {Object} dados - Dados a serem gravados (status, celular, print, erro, etc.).
 * @param {string} [campanhaId] - Se informado, atualiza o progresso dessa campanha.
 * @returns {void}
 */
function marcar(matricula, dados, campanhaId) {
  const prog = carregar(campanhaId);
  prog[matricula] = { ...dados, enviadoEm: new Date().toLocaleString('pt-BR') };
  salvar(prog, campanhaId);
}

module.exports = { carregar, salvar, marcar, caminho };
