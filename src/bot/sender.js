'use strict';

const { microPausa } = require('../utils/delay');

/**
 * Envia a imagem informativa com legenda para um motorista via WhatsApp.
 * Antes do envio, verifica se o número existe no WhatsApp usando `getNumberId`.
 * Inclui micro-pausas para simular comportamento humano e reduzir risco de bloqueio.
 *
 * @param {import('whatsapp-web.js').Client} client - Instância autenticada do cliente WhatsApp.
 * @param {string} celular - Número no formato "@c.us" (ex: "5516991234567@c.us").
 * @param {import('whatsapp-web.js').MessageMedia} media - Objeto de mídia (imagem) a enviar.
 * @param {string} texto - Legenda já montada para este motorista.
 * @returns {Promise<{ok: boolean, idCorreto: string|null, erro: string|null}>}
 *   Resultado do envio: ok=true e idCorreto com o ID serializado em caso de sucesso,
 *   ou ok=false com erro descritivo em caso de falha.
 */
async function enviarMensagem(client, celular, media, texto) {
  const numeroSemSufixo = celular.replace('@c.us', '');

  await microPausa();
  const numeroValido = await client.getNumberId(numeroSemSufixo);
  await microPausa();

  if (!numeroValido) {
    return { ok: false, idCorreto: null, erro: 'Número não tem WhatsApp' };
  }

  const idCorreto = numeroValido._serialized;
  await microPausa();
  await client.sendMessage(idCorreto, media, { caption: texto });

  return { ok: true, idCorreto, erro: null };
}

module.exports = { enviarMensagem };
