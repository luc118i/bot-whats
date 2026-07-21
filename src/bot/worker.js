'use strict';

const qrcode = require('qrcode-terminal');
const { sleep, aleatorio, delayAleatorio, sleepCancelavel } = require('../utils/delay');
const { marcar } = require('../services/progressService');
const { enviarMensagem } = require('./sender');
const { tirarPrint } = require('./screenshot');
const { criarCliente } = require('./client');
const { montarMensagem, montarMensagemCampanha } = require('../utils/message');
const config = require('../config');

const { pausaACada, pausaLonga, respiroCada, respiroDuracao } = config.bot;

/**
 * Aplica uma variação aleatória de ±20% em cima de um valor configurado.
 * Usado para que "pausar a cada N envios" e a duração das pausas nunca sejam
 * exatamente os mesmos números toda vez — um limiar e uma duração sempre
 * idênticos criam um padrão de tempo previsível e detectável.
 * @param {number} base - Valor configurado (ex: config.bot.pausaACada).
 * @param {number} [pct] - Percentual de variação para cada lado. Padrão: 0.2 (±20%).
 * @returns {number}
 */
function comVariacao(base, pct = 0.2) {
  const delta = Math.round(base * pct);
  return aleatorio(base - delta, base + delta);
}

/**
 * Itera pela lista de motoristas atribuída a uma conta e envia a mídia com mensagem
 * personalizada para cada um, usando um cliente WhatsApp já pronto (autenticado e
 * conectado). Gera prints de confirmação, marca o progresso após cada envio e aplica
 * delays aleatórios entre mensagens para evitar bloqueios por spam.
 *
 * Extraído de `rodarConta` para poder ser reaproveitado tanto por quem abre um
 * navegador novo quanto por quem já tem uma sessão conectada (ex: painel).
 *
 * @param {number} contaId - Identificador numérico da conta (1 ou 2).
 * @param {import('whatsapp-web.js').Client} client - Cliente já autenticado e pronto (evento 'ready' já disparado).
 * @param {Array<{nome: string, matricula: string, celular: string}>} lista
 *   Lista de motoristas pendentes atribuída a esta conta.
 * @param {import('whatsapp-web.js').MessageMedia} media - Objeto de mídia (imagem) a enviar.
 * @param {string[]} [modelosCampanha] - Modelos de mensagem customizados da campanha ativa.
 *   Se vazio/ausente, usa os modelos padrão do sistema.
 * @param {{delayMin: number, delayMax: number}} [delayConfig] - Delay em ms a usar entre
 *   envios. Se ausente, usa o padrão global (config.bot.delayMin/delayMax).
 * @param {(text: string) => void} [log] - Função de log. Padrão: console.log.
 * @param {{cancelado: boolean}} [cancelToken] - Se `cancelado` virar true, para no próximo motorista.
 * @param {string} [campanhaId] - Id da campanha, para gravar o progresso no arquivo dela
 *   (progresso/<campanhaId>.json). Se ausente, usa o arquivo legado global.
 * @returns {Promise<Array<{nome: string, matricula: string, celular: string, conta: number, status: string, print: string|null, erro: string|null}>>}
 *   Lista de resultados individuais de cada envio desta conta.
 */
async function processarConta(contaId, client, lista, media, modelosCampanha, delayConfig, log = console.log, cancelToken = null, campanhaId = null) {
  const delayMin = delayConfig?.delayMin ?? config.bot.delayMin;
  const delayMax = delayConfig?.delayMax ?? config.bot.delayMax;
  const prefixo = `[CONTA ${contaId}]`;

  log(`${prefixo} 🚀 Pronto! Processando ${lista.length} motoristas...\n`);

  const resultados = [];
  const limite = lista.length;

  // Limiares de "enviados" nos quais a próxima pausa/respiro dispara — recalculados
  // com variação a cada disparo, para não repetir sempre a mesma contagem exata.
  let proximaPausa = comVariacao(pausaACada);
  let proximoRespiro = comVariacao(respiroCada);

  for (let i = 0; i < limite; i++) {
    if (cancelToken?.cancelado) {
      log(`${prefixo} ⛔ Interrompido pelo usuário.`);
      break;
    }

    const { nome, matricula, celular } = lista[i];
    log(`${prefixo} [${i + 1}/${limite}] 📤 ${nome} (${celular.replace('@c.us', '')})`);

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
      marcar(matricula, { ...resultado, status: 'PROCESSANDO' }, campanhaId);

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
        log(`${prefixo}   ⚠️  Sem WhatsApp.`);
        marcar(matricula, resultado, campanhaId);
      } else {
        await sleep(aleatorio(1500, 3000));

        const page = client.pupPage;
        const printPath = await tirarPrint(page, idCorreto, nome, prefixo);
        resultado.status = 'ENVIADO';
        resultado.print = printPath;
        log(`${prefixo}   ✅ Enviado!`);
        marcar(matricula, resultado, campanhaId);
      }
    } catch (err) {
      resultado.status = 'FALHOU';
      resultado.erro = err.message;
      log(`${prefixo}   ❌ Falhou: ${err.message}`);
      marcar(matricula, resultado, campanhaId);
    }

    resultados.push(resultado);

    const enviados = resultados.filter((r) => r.status === 'ENVIADO').length;
    if (i < limite - 1) {
      if (enviados > 0 && enviados >= proximoRespiro) {
        const duracao = comVariacao(respiroDuracao);
        log(`${prefixo} 🕐 Respiro de ${(duracao / 60000).toFixed(0)} min após ${enviados} envios...\n`);
        await sleepCancelavel(duracao, cancelToken);
        proximoRespiro = enviados + comVariacao(respiroCada);
        if (proximaPausa <= enviados) proximaPausa = enviados + comVariacao(pausaACada);
      } else if (enviados > 0 && enviados >= proximaPausa) {
        const duracao = comVariacao(pausaLonga);
        log(`${prefixo} ☕ Pausa de ${(duracao / 60000).toFixed(1)} minutos...\n`);
        await sleepCancelavel(duracao, cancelToken);
        proximaPausa = enviados + comVariacao(pausaACada);
        if (proximoRespiro <= enviados) proximoRespiro = enviados + comVariacao(respiroCada);
      } else {
        await delayAleatorio(prefixo, delayMin, delayMax, log, cancelToken);
      }
    }
  }

  log(`\n${prefixo} ✅ Concluído! Encerrando conta ${contaId}...\n`);
  return resultados;
}

/**
 * Executa o fluxo completo de envio para uma única conta WhatsApp abrindo (ou
 * reaproveitando, se já houver sessão salva) um navegador próprio: inicializa o
 * cliente, aguarda autenticação via QR e então processa a lista de motoristas.
 *
 * Use esta função apenas quando não houver uma sessão já conectada em memória
 * (ex: uso standalone via `scripts/send.js`). Quando já existe uma sessão conectada
 * (ex: painel com a conta autenticada em Configurações), prefira reaproveitá-la e
 * chamar `processarConta` diretamente — abrir outro navegador para o mesmo perfil
 * causa o erro "browser already running".
 *
 * @param {number} contaId - Identificador numérico da conta (1 ou 2).
 * @param {Array<{nome: string, matricula: string, celular: string}>} lista
 *   Lista de motoristas pendentes atribuída a esta conta.
 * @param {import('whatsapp-web.js').MessageMedia} media - Objeto de mídia (imagem) a enviar.
 * @param {string[]} [modelosCampanha] - Modelos de mensagem customizados da campanha ativa.
 * @param {{delayMin: number, delayMax: number}} [delayConfig] - Delay em ms a usar entre envios.
 * @param {(text: string) => void} [log] - Função de log. Padrão: console.log.
 * @param {{cancelado: boolean}} [cancelToken] - Se `cancelado` virar true, para no próximo motorista.
 * @param {string} [campanhaId] - Id da campanha, para gravar o progresso no arquivo dela.
 * @returns {Promise<Array<{nome: string, matricula: string, celular: string, conta: number, status: string, print: string|null, erro: string|null}>>}
 */
async function rodarConta(contaId, lista, media, modelosCampanha, delayConfig, log = console.log, cancelToken = null, campanhaId = null) {
  const prefixo = `[CONTA ${contaId}]`;

  return new Promise((resolve) => {
    const client = criarCliente(contaId);

    client.on('qr', (qr) => {
      log(`\n${prefixo} 📱 Escaneie o QR Code com a CONTA ${contaId}:\n`);
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
      log(`${prefixo} ✅ Autenticado!\n`);
    });

    client.on('auth_failure', () => {
      log(`${prefixo} ❌ Falha na autenticação.`);
      resolve([]);
    });

    client.on('disconnected', async (reason) => {
      log(`${prefixo} ⚠️  Desconectado: ${reason}`);
      if (reason === 'LOGOUT') {
        log(
          `${prefixo} 🔑 Sessão encerrada. Delete a pasta ".wwebjs_auth/session-catedral-conta-${contaId}" e escaneie o QR novamente.`
        );
      }
      resolve([]);
    });

    client.on('ready', async () => {
      const resultados = await processarConta(contaId, client, lista, media, modelosCampanha, delayConfig, log, cancelToken, campanhaId);
      try {
        await client.destroy();
      } catch (_) {}
      resolve(resultados);
    });

    client.initialize();
  });
}

module.exports = { rodarConta, processarConta };
