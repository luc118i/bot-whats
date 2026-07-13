'use strict';

/**
 * Retorna uma Promise que resolve após `ms` milissegundos.
 * @param {number} ms - Tempo de espera em milissegundos.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gera um número inteiro aleatório entre `min` e `max` (inclusive).
 * @param {number} min - Valor mínimo.
 * @param {number} max - Valor máximo.
 * @returns {number}
 */
function aleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Aguarda um tempo aleatório entre DELAY_MIN e DELAY_MAX e loga o progresso.
 * @param {string} prefixo - Prefixo de identificação para o log (ex: "[CONTA 1]").
 * @param {number} delayMin - Delay mínimo em ms.
 * @param {number} delayMax - Delay máximo em ms.
 * @returns {Promise<void>}
 */
async function delayAleatorio(prefixo, delayMin, delayMax) {
  const ms = aleatorio(delayMin, delayMax);
  console.log(`${prefixo} ⏳ Aguardando ${(ms / 1000).toFixed(1)}s...\n`);
  await sleep(ms);
}

/**
 * Simula comportamento humano com uma micro-pausa aleatória entre 300ms e 800ms.
 * @returns {Promise<void>}
 */
function microPausa() {
  return sleep(aleatorio(300, 800));
}

module.exports = { sleep, aleatorio, delayAleatorio, microPausa };
