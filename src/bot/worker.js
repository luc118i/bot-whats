'use strict';

const qrcode = require('qrcode-terminal');
const { sleep, aleatorio, delayAleatorio } = require('../utils/delay');
const { marcar } = require('../services/progressService');
const { enviarMensagem } = require('./sender');
const { tirarPrint } = require('./screenshot');
const { criarCliente } = require('./client');
const { montarMensagem, montarMensagemCampanha } = require('../utils/message');
const config = require('../config');

const { delayMin, delayMax, pausaACada, pausaLonga, respiroCada, respiroDuracao } = config.bot;

/**
 * Executa o fluxo completo de envio para uma única conta WhatsApp.
 * Inicializa o cliente, aguarda autenticação via QR, itera pela lista de motoristas
 * atribuída a esta conta e envia a mídia com mensagem personalizada para cada um.
 * Gera prints de confirmação, marca o progresso após cada envio e aplica delays
 * aleatórios entre mensagens para evitar bloqueios por spam.
 *
 * @param {number} contaId - Identificador numérico da conta (1 ou 2).
 * @param {Array<{nome: string, matricula: string, celular: string}>} lista
 *   Lista de motoristas pendentes atribuída a esta conta.
 * @param {import('whatsapp-web.js').MessageMedia} media - Objeto de mídia (imagem) a enviar.
 * @param {string[]} [modelosCampanha] - Modelos de mensagem customizados da campanha ativa.
 *   Se vazio/ausente, usa os modelos padrão do sistema.
 * @returns {Promise<Array<{nome: string, matricula: string, celular: string, conta: number, status: string, print: string|null, erro: string|null}>>}
 *   Lista de resultados individuais de cada envio desta conta.
 */
async function rodarConta(contaId, lista, media, modelosCampanha) {
  const prefixo = `[CONTA ${contaId}]`;

  return new Promise((resolve) => {
    const client = criarCliente(contaId);

    client.on('qr', (qr) => {
      console.log(`\n${prefixo} 📱 Escaneie o QR Code com a CONTA ${contaId}:\n`);
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
      console.log(`${prefixo} ✅ Autenticado!\n`);
    });

    client.on('auth_failure', () => {
      console.error(`${prefixo} ❌ Falha na autenticação.`);
      resolve([]);
    });

    client.on('disconnected', async (reason) => {
      console.log(`${prefixo} ⚠️  Desconectado: ${reason}`);
      if (reason === 'LOGOUT') {
        console.log(
          `${prefixo} 🔑 Sessão encerrada. Delete a pasta ".wwebjs_auth/session-catedral-conta-${contaId}" e escaneie o QR novamente.`
        );
      }
      resolve([]);
    });

    client.on('ready', async () => {
      console.log(`${prefixo} 🚀 Pronto! Processando ${lista.length} motoristas...\n`);

      const resultados = [];
      const limite = lista.length;

      for (let i = 0; i < limite; i++) {
        const { nome, matricula, celular } = lista[i];
        console.log(`${prefixo} [${i + 1}/${limite}] 📤 ${nome} (${celular.replace('@c.us', '')})`);

        const resultado = {
          nome,
          matricula,
          celular: celular.replace('@c.us', ''),
          conta: contaId,
          status: '',
          print: null,
          erro: null,
        };

        try {
          // Marca como PROCESSANDO antes de qualquer ação para evitar reenvio em caso de crash
          marcar(matricula, { ...resultado, status: 'PROCESSANDO' });

          const texto = modelosCampanha && modelosCampanha.length > 0
            ? montarMensagemCampanha(modelosCampanha, nome, matricula)
            : montarMensagem(nome, matricula);

          const { ok, idCorreto, erro } = await enviarMensagem(
            client,
            celular,
            media,
            texto
          );

          if (!ok) {
            resultado.status = 'SEM_WHATSAPP';
            resultado.erro = erro;
            console.log(`${prefixo}   ⚠️  Sem WhatsApp.`);
            marcar(matricula, resultado);
          } else {
            await sleep(aleatorio(1500, 3000));

            const page = client.pupPage;
            const printPath = await tirarPrint(page, idCorreto, nome, prefixo);
            resultado.status = 'ENVIADO';
            resultado.print = printPath;
            console.log(`${prefixo}   ✅ Enviado!`);
            marcar(matricula, resultado);
          }
        } catch (err) {
          resultado.status = 'FALHOU';
          resultado.erro = err.message;
          console.log(`${prefixo}   ❌ Falhou: ${err.message}`);
          marcar(matricula, resultado);
        }

        resultados.push(resultado);

        const enviados = resultados.filter((r) => r.status === 'ENVIADO').length;
        if (i < limite - 1) {
          if (enviados > 0 && enviados % respiroCada === 0) {
            console.log(`${prefixo} 🕐 Respiro de 1 hora após ${enviados} envios...\n`);
            await sleep(respiroDuracao);
          } else if (enviados > 0 && enviados % pausaACada === 0) {
            console.log(`${prefixo} ☕ Pausa de ${pausaLonga / 60000} minutos...\n`);
            await sleep(pausaLonga);
          } else {
            await delayAleatorio(prefixo, delayMin, delayMax);
          }
        }
      }

      console.log(`\n${prefixo} ✅ Concluído! Encerrando conta ${contaId}...\n`);
      try {
        await client.destroy();
      } catch (_) {}
      resolve(resultados);
    });

    client.initialize();
  });
}

module.exports = { rodarConta };
