'use strict';

const { microPausa } = require('../utils/delay');

/**
 * Envia a mídia (imagem ou vídeo) e, em seguida, o texto como mensagem separada,
 * para um motorista via WhatsApp. Antes do envio, verifica se o número existe no
 * WhatsApp usando `getNumberId`. Inclui micro-pausas para simular comportamento
 * humano e reduzir risco de bloqueio.
 *
 * @param {import('whatsapp-web.js').Client} client - Instância autenticada do cliente WhatsApp.
 * @param {string} celular - Número no formato "@c.us" (ex: "5516991234567@c.us").
 * @param {import('whatsapp-web.js').MessageMedia} media - Objeto de mídia (imagem ou vídeo) a enviar.
 * @param {string} texto - Mensagem de texto já montada para este motorista, enviada logo após a mídia.
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
  await client.sendMessage(idCorreto, media);
  await microPausa();
  if (texto) await client.sendMessage(idCorreto, texto);

  return { ok: true, idCorreto, erro: null };
}

module.exports = { enviarMensagem };
