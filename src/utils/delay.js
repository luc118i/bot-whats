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
 * Aguarda até `ms` milissegundos, mas retorna mais cedo se `cancelToken.cancelado`
 * virar true durante a espera — checa em passos de 1s. Usado nas pausas longas
 * (pausaLonga, respiroDuracao) para que um pedido de pausa do usuário não fique
 * preso esperando o fim de uma espera de minutos/horas.
 * @param {number} ms - Tempo total a aguardar em milissegundos.
 * @param {{cancelado: boolean}} [cancelToken] - Se `cancelado` virar true, interrompe a espera.
 * @param {number} [passo] - Intervalo de checagem em ms. Padrão: 1000.
 * @returns {Promise<void>}
 */
async function sleepCancelavel(ms, cancelToken, passo = 1000) {
  let restante = ms;
  while (restante > 0) {
    if (cancelToken?.cancelado) return;
    await sleep(Math.min(passo, restante));
    restante -= passo;
  }
}

/**
 * Aguarda um tempo aleatório entre DELAY_MIN e DELAY_MAX e loga o progresso.
 * A espera é cancelável: se `cancelToken.cancelado` virar true, retorna mais cedo.
 * @param {string} prefixo - Prefixo de identificação para o log (ex: "[CONTA 1]").
 * @param {number} delayMin - Delay mínimo em ms.
 * @param {number} delayMax - Delay máximo em ms.
 * @param {(text: string) => void} [log] - Função de log. Padrão: console.log.
 * @param {{cancelado: boolean}} [cancelToken] - Se `cancelado` virar true, interrompe a espera.
 * @returns {Promise<void>}
 */
async function delayAleatorio(prefixo, delayMin, delayMax, log = console.log, cancelToken = null) {
  const ms = aleatorio(delayMin, delayMax);
  log(`${prefixo} ⏳ Aguardando ${(ms / 1000).toFixed(1)}s...\n`);
  await sleepCancelavel(ms, cancelToken);
}

/**
 * Simula comportamento humano com uma micro-pausa aleatória entre 300ms e 800ms.
 * @returns {Promise<void>}
 */
function microPausa() {
  return sleep(aleatorio(300, 800));
}

module.exports = { sleep, aleatorio, delayAleatorio, microPausa, sleepCancelavel };
