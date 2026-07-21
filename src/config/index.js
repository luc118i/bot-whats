'use strict';

const path = require('path');
const fs   = require('fs');

const ROOT     = path.join(__dirname, '..', '..');
const OVERRIDE = path.join(ROOT, 'config.override.json');

/** Defaults imutáveis — nunca altere aqui, use config.override.json */
const DEFAULTS = {
  bot: {
    delayMin:       20000,
    delayMax:       45000,
    pausaACada:     20,
    pausaLonga:     3 * 60000,
    limitePorConta: 0,
    respiroCada:    50,
    respiroDuracao: 60 * 60000,
  },
  server: {
    porta: 3000,
  },
  whatsapp: {
    datasAtivo: ['31/12/9999', '11/02/2099'],
  },
};

/** Carrega overrides do arquivo JSON (se existir) e mescla com defaults. */
function carregarConfig() {
  let overrides = {};
  if (fs.existsSync(OVERRIDE)) {
    try { overrides = JSON.parse(fs.readFileSync(OVERRIDE, 'utf8')); } catch (_) {}
  }
  return {
    paths: {
      planilha:       path.join(ROOT, 'Pessoa - 30-06-2026 10-07.xlsx'),
      // Progresso do fluxo avulso/legado sem campanha (ex: scripts/send.js standalone).
      progresso:      path.join(ROOT, 'progresso.json'),
      // Progresso por campanha: um arquivo `<campanhaId>.json` por campanha, nunca
      // compartilhado entre elas — ver src/services/progressService.js.
      progressoDir:   path.join(ROOT, 'progresso'),
      imagem:         path.join(ROOT, 'informativo.png'),
      prints:         path.join(ROOT, 'output', 'prints'),
      relatorio:      path.join(ROOT, 'output', 'relatorio'),
      contatos:       path.join(ROOT, 'output', 'contatos'),
      modeloSemNumero: path.join(ROOT, 'motoristas_sem_numero.xlsx'),
    },
    bot:      { ...DEFAULTS.bot,      ...(overrides.bot      || {}) },
    server:   { ...DEFAULTS.server,   ...(overrides.server   || {}) },
    whatsapp: { ...DEFAULTS.whatsapp, ...(overrides.whatsapp || {}) },
    _defaults: DEFAULTS,
    _overridePath: OVERRIDE,
  };
}

module.exports = carregarConfig();
