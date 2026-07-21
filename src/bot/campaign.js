'use strict';

const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');
const { lerMotoristas } = require('../services/spreadsheetService');
const { carregar, salvar, marcar } = require('../services/progressService');
const { gerarRelatorio } = require('../services/reportService');
const { rodarConta, processarConta } = require('./worker');
const campanhasSvc = require('../services/campanhasService');

/**
 * Normaliza número para comparação: remove @c.us, mantém só dígitos,
 * remove prefixo 55 se o número tiver 13+ dígitos (ex: 5511999... → 11999...)
 */
function normalizarNum(celular) {
  let n = celular.replace('@c.us', '').replace(/\D/g, '');
  if (n.length >= 12 && n.startsWith('55')) n = n.slice(2);
  return n;
}

/**
 * Roda o envio de uma conta reaproveitando o cliente WhatsApp já conectado em
 * memória (ex: sessão aberta pelo painel em Configurações > Contas), se houver.
 * Isso evita abrir um segundo Chromium apontando para a mesma pasta de sessão,
 * o que causa o erro "browser already running" do Puppeteer.
 *
 * Se não houver sessão conectada em memória, cai no fluxo padrão (abre navegador
 * próprio e mostra QR Code) — mantém o comportamento de uso standalone.
 */
async function rodarContaComReuso(contaId, lista, media, modelosCampanha, delayConfig, log, cancelToken, campanhaId) {
  // Import tardio para evitar custo de carregar o servidor HTTP quando este
  // módulo é usado fora do contexto da API (ex: scripts/send.js standalone).
  let clienteConectado = null;
  try {
    const contas = require('../api/routes/contas');
    clienteConectado = contas.getClientConectado(contaId);
  } catch (_) {
    clienteConectado = null;
  }

  if (clienteConectado) {
    log(`[CONTA ${contaId}] ♻️  Reaproveitando sessão já conectada (sem abrir novo navegador).`);
    return processarConta(contaId, clienteConectado, lista, media, modelosCampanha, delayConfig, log, cancelToken, campanhaId);
  }

  return rodarConta(contaId, lista, media, modelosCampanha, delayConfig, log, cancelToken, campanhaId);
}

/**
 * Executa o fluxo completo de uma campanha de envio: lê a planilha, aplica os
 * filtros/config da campanha ativa, divide os pendentes entre as contas e
 * dispara o envio em paralelo, reaproveitando sessões já conectadas quando
 * possível. Ao final, gera o relatório em PDF.
 *
 * @param {object} opts
 * @param {number} [opts.totalContas] - Quantas contas usar em paralelo (1 ou 2). Padrão: 1.
 * @param {(text: string) => void} [opts.log] - Função de log. Padrão: console.log.
 * @param {{cancelado: boolean}} [opts.cancelToken] - Permite interromper o envio graciosamente.
 * @returns {Promise<void>}
 */
async function executarCampanha({ totalContas = 1, log = console.log, cancelToken = null } = {}) {
  const TOTAL_CONTAS = Math.min(Math.max(totalContas, 1), 2);

  const campanhaAtiva = campanhasSvc.obterAtiva();

  log('═══════════════════════════════════════════════');
  log(`   BOT CATEDRAL — ${TOTAL_CONTAS} CONTA(S) EM PARALELO`);
  if (campanhaAtiva) log(`   Campanha: ${campanhaAtiva.nome}`);
  log('═══════════════════════════════════════════════\n');

  [config.paths.prints, config.paths.relatorio, config.paths.contatos].forEach((p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  // Progresso isolado por campanha (progresso/<id>.json). Sem campanha ativa
  // (fluxo avulso/standalone), cai no arquivo legado global (progresso.json).
  const campanhaId = campanhaAtiva?.id || null;
  const temImagemCustomizada = campanhaAtiva?.imagem && fs.existsSync(campanhaAtiva.imagem);

  if (!temImagemCustomizada && !fs.existsSync(config.paths.imagem)) {
    throw new Error(`IMAGEM NÃO ENCONTRADA: ${config.paths.imagem}`);
  }

  const motoristas = lerMotoristas();
  const progresso = carregar(campanhaId);

  const filtroBaseOp = campanhaAtiva?.config?.filtroBaseOp || [];
  const filtroStatus = campanhaAtiva?.config?.filtroStatus || 'PENDENTE';
  if (filtroBaseOp.length > 0) {
    log(`🎯 Filtro de base operacional: ${filtroBaseOp.join(', ')}`);
  }
  if (filtroStatus !== 'PENDENTE') {
    log(`🎯 Filtro de status: ${filtroStatus}`);
  }

  // Recorte pelo público-alvo da campanha (base operacional) — os totais/logs e o
  // relatório final devem refletir só quem essa campanha realmente mira, não a
  // planilha inteira (senão "Total: 336" engana quando a campanha só mira 122).
  const motoristasAlvo = filtroBaseOp.length > 0
    ? motoristas.filter((m) => filtroBaseOp.includes(m.base))
    : motoristas;

  for (const m of motoristasAlvo) {
    if (m.semNumero && !progresso[m.matricula]) {
      progresso[m.matricula] = {
        nome: m.nome,
        matricula: m.matricula,
        celular: null,
        status: 'SEM_NUMERO',
        print: null,
        erro: 'Número não cadastrado na planilha',
        enviadoEm: new Date().toLocaleString('pt-BR'),
      };
    }
  }
  salvar(progresso, campanhaId);

  const jaEnviados = Object.values(progresso).filter((v) => v.status === 'ENVIADO').length;
  const semNumero = Object.values(progresso).filter((v) => v.status === 'SEM_NUMERO').length;
  const semWpp = Object.values(progresso).filter((v) => v.status === 'SEM_WHATSAPP').length;

  const pendentesRaw = motoristasAlvo.filter((m) => {
    if (m.semNumero) return false;

    const p = progresso[m.matricula];
    if (filtroStatus === 'TODOS') return true;
    if (filtroStatus === 'FALHOU') return !!p && p.status === 'FALHOU';
    // Inclui também 'PROCESSANDO': é marcado antes do envio e só vira ENVIADO/
    // SEM_WHATSAPP/FALHOU depois — se o bot for encerrado à força (crash, kill,
    // fechar o app) bem nesse meio-tempo, o registro fica travado em
    // PROCESSANDO para sempre. Sem isso aqui, esse motorista nunca mais entra
    // na fila e nunca recebe a mensagem, sem nenhum erro visível.
    return !p || p.status === 'FALHOU' || p.status === 'PROCESSANDO';
  });

  const numerosVistos = new Set();
  const pendentes = [];
  const duplicados = [];

  for (const m of pendentesRaw) {
    const num = m.celular.replace('@c.us', '');
    const numNorm = normalizarNum(m.celular);
    if (numerosVistos.has(numNorm)) {
      duplicados.push(m);
      marcar(m.matricula, {
        nome: m.nome,
        matricula: m.matricula,
        celular: num,
        status: 'DUPLICADO',
        print: null,
        erro: 'Número já existe para outro motorista na planilha (número normalizado coincide)',
      }, campanhaId);
    } else {
      numerosVistos.add(numNorm);
      pendentes.push(m);
    }
  }

  log(`📋 Total na planilha:  ${motoristasAlvo.length}`);
  log(`✅ Já enviados:        ${jaEnviados}`);
  log(`⚠️  Sem número:        ${semNumero}`);
  log(`⚠️  Sem WhatsApp:      ${semWpp}`);
  if (duplicados.length > 0) {
    log(`🔁 Números duplicados: ${duplicados.length} (ignorados)`);
  }
  log(`📤 Pendentes agora:    ${pendentes.length}`);
  log(`📱 Contas em uso:      ${TOTAL_CONTAS}\n`);

  if (duplicados.length > 0) {
    log('⚠️  DUPLICADOS ENCONTRADOS (mesmo número, motoristas diferentes):');
    duplicados.forEach((d) =>
      log(`   - ${d.nome} (${d.matricula}) → ${d.celular.replace('@c.us', '')}`)
    );
    log('');
  }

  if (pendentes.length === 0) {
    log('🎉 Todos os motoristas já receberam o informativo!');
    return;
  }

  const listas = Array.from({ length: TOTAL_CONTAS }, () => []);
  pendentes.forEach((m, i) => listas[i % TOTAL_CONTAS].push(m));

  listas.forEach((lista, i) => {
    log(`  Conta ${i + 1}: ${lista.length} motoristas`);
  });

  if (TOTAL_CONTAS > 1) {
    log('\n⚠️  Dois navegadores podem abrir (a menos que já haja sessão conectada). Escaneie o QR Code de cada um, se aparecer.\n');
  } else {
    log('\n⚠️  Um navegador pode abrir (a menos que já haja sessão conectada). Escaneie o QR Code, se aparecer.\n');
  }

  const imagemPath = temImagemCustomizada ? campanhaAtiva.imagem : config.paths.imagem;
  const modelosCampanha = campanhaAtiva?.modelos || [];
  if (imagemPath !== config.paths.imagem) {
    log(`🖼️  Usando imagem customizada da campanha: ${imagemPath}`);
  }
  if (modelosCampanha.length > 0) {
    log(`✍️  Usando ${modelosCampanha.length} modelo(s) de mensagem customizado(s) da campanha.`);
  }
  const media = MessageMedia.fromFilePath(imagemPath);

  const delayConfig = (campanhaAtiva?.config?.delayMin && campanhaAtiva?.config?.delayMax)
    ? { delayMin: campanhaAtiva.config.delayMin * 1000, delayMax: campanhaAtiva.config.delayMax * 1000 }
    : undefined;
  if (delayConfig) {
    log(`⏱️  Usando delay customizado da campanha: ${campanhaAtiva.config.delayMin}s–${campanhaAtiva.config.delayMax}s`);
  }

  await Promise.all(
    listas.map((lista, i) => rodarContaComReuso(i + 1, lista, media, modelosCampanha, delayConfig, log, cancelToken, campanhaId))
  );

  log('\n═══════════════════════════════════════════════');
  log('   TODOS OS ENVIOS CONCLUÍDOS! Gerando PDF...');
  log('═══════════════════════════════════════════════\n');

  const progressoFinal = carregar(campanhaId);
  const todosResultados = motoristasAlvo.map((m) => {
    const p = progressoFinal[m.matricula];
    return (
      p || {
        nome: m.nome,
        matricula: m.matricula,
        celular: m.celular ? m.celular.replace('@c.us', '') : null,
        status: 'PENDENTE',
        print: null,
        erro: null,
      }
    );
  });

  gerarRelatorio(todosResultados);

  const env = todosResultados.filter((r) => r.status === 'ENVIADO').length;
  const sWpp = todosResultados.filter((r) => r.status === 'SEM_WHATSAPP').length;
  const sNum = todosResultados.filter((r) => r.status === 'SEM_NUMERO').length;
  const falha = todosResultados.filter((r) => r.status === 'FALHOU').length;
  const pend = todosResultados.filter((r) => r.status === 'PENDENTE').length;

  log('📊 RESUMO GERAL:');
  log(`   ✅ Enviados:       ${env}`);
  log(`   ⚠️  Sem WhatsApp:  ${sWpp}`);
  log(`   ➖ Sem número:     ${sNum}`);
  log(`   ❌ Falhou:         ${falha}`);
  log(`   🕐 Pendentes:      ${pend}`);
  log(`   📋 Total:          ${motoristasAlvo.length}`);
  log('\n📄 Relatório PDF gerado na pasta "output/relatorio"');
}

module.exports = { executarCampanha };
