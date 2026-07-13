'use strict';

const fs   = require('fs');
const path = require('path');

const TEMPLATES_FILE = path.join(__dirname, '..', '..', 'templates.json');

const DEFAULTS = {
  ctas: [
    `👇 *Responda OK para confirmar que recebeu este informativo.*`,
    `📩 *Confirme o recebimento respondendo CIENTE.* ✅`,
    `👇 Por favor, responda *CONFIRMO* para registrarmos seu recebimento.`,
    `✅ _Responda com *RECEBI* para confirmarmos sua ciência._`,
    `💬 Nos retorne com *CIENTE* assim que possível. Obrigado!`,
  ],
  rodapes: [
    `_Atenciosamente, Equipe de Monitoramento — Viação Catedral_ 🚌`,
    `_Obrigado pela atenção! Equipe de Monitoramento Catedral._ 🤝`,
    `_Contamos com sua colaboração. Equipe de Monitoramento Catedral._ 🙏`,
    `_Agradecemos a compreensão. Equipe de Monitoramento — Catedral._ ✅`,
    `_Bom trabalho! Equipe de Monitoramento Catedral._ 💪`,
  ],
};

function carregar() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const data = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
      return {
        ctas:    Array.isArray(data.ctas)    ? data.ctas    : DEFAULTS.ctas,
        rodapes: Array.isArray(data.rodapes) ? data.rodapes : DEFAULTS.rodapes,
      };
    }
  } catch (_) {}
  return { ...DEFAULTS };
}

function salvar(data) {
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { carregar, salvar, DEFAULTS };
