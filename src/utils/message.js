'use strict';

const { carregar: carregarTemplates } = require('../services/templatesService');

/**
 * 5 variações da mesma mensagem para reduzir detecção de envio em massa.
 * O conteúdo e as regras são idênticos — apenas a estrutura e o vocabulário variam.
 * O CTA é sorteado separadamente, gerando 25 combinações possíveis.
 */
const MODELOS = [
  // Modelo 1 — original reformulado
  (nome, matricula, cta) => `🚌 *VIAÇÃO CATEDRAL — INFORMATIVO AOS MOTORISTAS*

Olá, *${nome} — Matrícula: ${matricula}* 👋

⚠️ *ATENÇÃO, MOTORISTA!*

Reforçamos as regras sobre a *PARADA PARA REFEIÇÃO:*

⏱️ O tempo máximo de permanência é de *30 MINUTOS.*

🔑 *MANTENHA O VEÍCULO DESLIGADO* durante a parada de refeição e também nos terminais.

⚠️ *IMPORTANTE:* Se o veículo estiver distante do ponto de refeição por ocorrência na rota, a autorização para parar em outro ponto de apoio — cadastrado no sistema de GPS — será dada *EXCLUSIVAMENTE PELO CCO.*

${cta}`,

  // Modelo 2 — saudação diferente, ordem dos pontos variada
  (nome, matricula, cta) => `🚌 *CATEDRAL — INFORMATIVO OPERACIONAL*

Bom dia, *${nome}!* _(Matrícula: ${matricula})_

📋 *LEMBRETE IMPORTANTE — PARADA PARA REFEIÇÃO:*

🔑 Desligue o veículo durante a parada de refeição e nos terminais.

⏱️ O tempo de permanência *não deve ultrapassar 30 minutos.*

⚠️ Caso esteja longe do ponto de refeição por ocorrência na rota, a autorização para utilizar outro ponto de apoio cadastrado no GPS será concedida *EXCLUSIVAMENTE PELO CCO.*

${cta}`,

  // Modelo 3 — tom mais direto, emojis diferentes
  (nome, matricula, cta) => `📢 *VIAÇÃO CATEDRAL — AVISO AOS MOTORISTAS*

Olá, *${nome}* — Matrícula *${matricula}*

Estamos reforçando as orientações sobre a *parada para refeição:*

✅ Tempo máximo na parada: *30 minutos*
✅ *Veículo deve permanecer desligado* na parada e nos terminais
✅ Parada em ponto alternativo (cadastrado no GPS): somente com autorização *do CCO*

${cta}`,

  // Modelo 4 — formato de lista numerada
  (nome, matricula, cta) => `🚌 *VIAÇÃO CATEDRAL*
*Informativo — ${nome} | Mat. ${matricula}*

Prezado motorista, seguem as regras da *parada para refeição:*

1️⃣ Permanência máxima: *30 minutos*
2️⃣ Mantenha o *veículo desligado* durante a parada e nos terminais
3️⃣ Para parar em ponto alternativo cadastrado no GPS, acione *o CCO* para autorização

⚠️ O cumprimento dessas regras é obrigatório.

${cta}`,

  // Modelo 5 — texto corrido, menos uso de negrito
  (nome, matricula, cta) => `Olá ${nome} _(matrícula ${matricula})_, tudo bem?

Passando para reforçar as regras da *parada para refeição* da Viação Catedral 🚌

O tempo máximo de permanência é de *30 minutos* e o veículo deve ser mantido *desligado* durante a parada e também nos terminais.

Caso esteja longe do ponto de refeição por alguma ocorrência na rota, a autorização para usar outro ponto de apoio cadastrado no GPS é dada *exclusivamente pelo CCO.*

${cta}`,
];

/**
 * Retorna uma variação aleatória da mensagem para o motorista informado.
 * A rotação aleatória entre modelos reduz padrões detectáveis pelo WhatsApp.
 *
 * @param {string} nome - Nome completo do motorista.
 * @param {string} matricula - Número de matrícula do motorista.
 * @returns {string} Texto formatado da mensagem.
 */
function montarMensagem(nome, matricula) {
  const { ctas, rodapes } = carregarTemplates();
  const modelo = MODELOS[Math.floor(Math.random() * MODELOS.length)];
  const cta    = ctas[Math.floor(Math.random() * ctas.length)];
  const rodape = rodapes[Math.floor(Math.random() * rodapes.length)];
  return `${modelo(nome, matricula, cta)}\n\n${rodape}`;
}

/**
 * Monta a mensagem a partir dos modelos customizados de uma campanha (texto livre
 * digitado no wizard "Nova Campanha"), substituindo os placeholders literais
 * `${nome}` e `${matricula}` pelos dados do motorista.
 *
 * @param {string[]} modelos - Textos dos modelos configurados na campanha.
 * @param {string} nome
 * @param {string} matricula
 * @returns {string}
 */
function montarMensagemCampanha(modelos, nome, matricula) {
  const { ctas, rodapes } = carregarTemplates();
  const modelo = modelos[Math.floor(Math.random() * modelos.length)];
  const texto = modelo
    .split('${nome}').join(nome)
    .split('${matricula}').join(matricula);
  const cta    = ctas[Math.floor(Math.random() * ctas.length)];
  const rodape = rodapes[Math.floor(Math.random() * rodapes.length)];
  return `${texto}\n\n${cta}\n\n${rodape}`;
}

module.exports = { montarMensagem, montarMensagemCampanha };
