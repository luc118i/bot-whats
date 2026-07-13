#!/usr/bin/env node
'use strict';

// Uso: node scripts/send.js [numero_de_contas]
// Exemplo: node scripts/send.js 2  → usa duas contas WhatsApp em paralelo

const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../src/config');
const { lerMotoristas } = require('../src/services/spreadsheetService');
const { carregar, salvar, marcar } = require('../src/services/progressService');
const { gerarRelatorio } = require('../src/services/reportService');
const { rodarConta } = require('../src/bot/worker');
const campanhasSvc = require('../src/services/campanhasService');

const TOTAL_CONTAS = Math.min(Math.max(parseInt(process.argv[2]) || 1, 1), 2);

/**
 * Ponto de entrada principal do bot de envio.
 * Lê a planilha, filtra pendentes, divide entre contas e orquestra os workers.
 *
 * @returns {Promise<void>}
 */
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(`   BOT CATEDRAL — ${TOTAL_CONTAS} CONTA(S) EM PARALELO`);
  console.log('═══════════════════════════════════════════════\n');

  // Garante que as pastas de saída existam
  [config.paths.prints, config.paths.relatorio, config.paths.contatos].forEach((p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  if (!fs.existsSync(config.paths.imagem)) {
    console.error(`❌ IMAGEM NÃO ENCONTRADA: ${config.paths.imagem}`);
    process.exit(1);
  }

  const motoristas = lerMotoristas();
  const progresso = carregar();

  // Filtros da campanha ativa (público-alvo e status a (re)enviar)
  const campanhaAtiva = campanhasSvc.obterAtiva();
  const filtroBaseOp = campanhaAtiva?.config?.filtroBaseOp || [];
  const filtroStatus = campanhaAtiva?.config?.filtroStatus || 'PENDENTE';
  if (filtroBaseOp.length > 0) {
    console.log(`🎯 Filtro de base operacional: ${filtroBaseOp.join(', ')}`);
  }
  if (filtroStatus !== 'PENDENTE') {
    console.log(`🎯 Filtro de status: ${filtroStatus}`);
  }

  // Registra motoristas sem número no progresso para que apareçam no relatório
  for (const m of motoristas) {
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
  salvar(progresso);

  const jaEnviados = Object.values(progresso).filter((v) => v.status === 'ENVIADO').length;
  const semNumero = Object.values(progresso).filter((v) => v.status === 'SEM_NUMERO').length;
  const semWpp = Object.values(progresso).filter((v) => v.status === 'SEM_WHATSAPP').length;

  const pendentesRaw = motoristas.filter((m) => {
    if (m.semNumero) return false;
    if (filtroBaseOp.length > 0 && !filtroBaseOp.includes(m.base)) return false;

    const p = progresso[m.matricula];
    if (filtroStatus === 'TODOS') return true;
    if (filtroStatus === 'FALHOU') return !!p && p.status === 'FALHOU';
    // PENDENTE (padrão): só envia quem nunca foi tentado ou falhou com erro recuperável
    // PROCESSANDO = já foi tentado (evita reenvio mesmo em crash)
    return !p || p.status === 'FALHOU';
  });

  // Normaliza número para comparação: remove @c.us, mantém só dígitos,
  // remove prefixo 55 se o número tiver 13+ dígitos (ex: 5511999... → 11999...)
  function normalizarNum(celular) {
    let n = celular.replace('@c.us', '').replace(/\D/g, '');
    if (n.length >= 12 && n.startsWith('55')) n = n.slice(2);
    return n;
  }

  // Deduplica por número normalizado para não enviar 2x para o mesmo número
  const numerosVistos = new Set();
  const pendentes = [];
  const duplicados = [];

  for (const m of pendentesRaw) {
    const num    = m.celular.replace('@c.us', '');
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
      });
    } else {
      numerosVistos.add(numNorm);
      pendentes.push(m);
    }
  }

  console.log(`📋 Total na planilha:  ${motoristas.length}`);
  console.log(`✅ Já enviados:        ${jaEnviados}`);
  console.log(`⚠️  Sem número:        ${semNumero}`);
  console.log(`⚠️  Sem WhatsApp:      ${semWpp}`);
  if (duplicados.length > 0) {
    console.log(`🔁 Números duplicados: ${duplicados.length} (ignorados)`);
  }
  console.log(`📤 Pendentes agora:    ${pendentes.length}`);
  console.log(`📱 Contas em uso:      ${TOTAL_CONTAS}\n`);

  if (duplicados.length > 0) {
    console.log('⚠️  DUPLICADOS ENCONTRADOS (mesmo número, motoristas diferentes):');
    duplicados.forEach((d) =>
      console.log(`   - ${d.nome} (${d.matricula}) → ${d.celular.replace('@c.us', '')}`)
    );
    console.log();
  }

  if (pendentes.length === 0) {
    console.log('🎉 Todos os motoristas já receberam o informativo!');
    process.exit(0);
  }

  // Divide a lista igualmente entre as contas
  const listas = Array.from({ length: TOTAL_CONTAS }, () => []);
  pendentes.forEach((m, i) => listas[i % TOTAL_CONTAS].push(m));

  listas.forEach((lista, i) => {
    console.log(`  Conta ${i + 1}: ${lista.length} motoristas`);
  });

  if (TOTAL_CONTAS > 1) {
    console.log(
      '\n⚠️  Dois navegadores vão abrir. Escaneie o QR Code de cada um com uma conta diferente.\n'
    );
  } else {
    console.log('\n⚠️  Um navegador vai abrir. Escaneie o QR Code com sua conta WhatsApp.\n');
  }

  const media = MessageMedia.fromFilePath(config.paths.imagem);

  // Roda as contas em paralelo
  await Promise.all(listas.map((lista, i) => rodarConta(i + 1, lista, media)));

  // Relatório unificado
  console.log('\n═══════════════════════════════════════════════');
  console.log('   TODOS OS ENVIOS CONCLUÍDOS! Gerando PDF...');
  console.log('═══════════════════════════════════════════════\n');

  const progressoFinal = carregar();
  const todosResultados = motoristas.map((m) => {
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

  console.log('📊 RESUMO GERAL:');
  console.log(`   ✅ Enviados:       ${env}`);
  console.log(`   ⚠️  Sem WhatsApp:  ${sWpp}`);
  console.log(`   ➖ Sem número:     ${sNum}`);
  console.log(`   ❌ Falhou:         ${falha}`);
  console.log(`   🕐 Pendentes:      ${pend}`);
  console.log(`   📋 Total:          ${motoristas.length}`);
  console.log('\n📄 Relatório PDF gerado na pasta "output/relatorio"');

  process.exit(0);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
