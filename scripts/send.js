#!/usr/bin/env node
'use strict';

// Uso: node scripts/send.js [numero_de_contas]
// Exemplo: node scripts/send.js 2  → usa duas contas WhatsApp em paralelo

const { executarCampanha } = require('../src/bot/campaign');

const TOTAL_CONTAS = Math.min(Math.max(parseInt(process.argv[2]) || 1, 1), 2);

executarCampanha({ totalContas: TOTAL_CONTAS, log: console.log })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
