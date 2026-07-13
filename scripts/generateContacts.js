#!/usr/bin/env node
'use strict';

// Gera um arquivo VCF com os contatos de todos os motoristas ativos com número cadastrado.
// O arquivo é salvo em output/contatos/ com data no nome.
// Uso: node scripts/generateContacts.js

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { isAtivo } = require('../src/services/spreadsheetService');
const { normalizarCelular } = require('../src/utils/phone');

const PLANILHA = config.paths.planilha;
const PASTA_SAIDA = config.paths.contatos;

/**
 * Gera um arquivo VCF (vCard 3.0) com todos os motoristas ativos que possuem celular.
 * O nome do contato segue o padrão: "MATRICULA - NOME - BASE".
 * O arquivo é salvo em `output/contatos/contatos_catedral_DD-MM-YYYY.vcf`.
 *
 * @returns {void}
 */
function gerarContatos() {
  if (!fs.existsSync(PASTA_SAIDA)) {
    fs.mkdirSync(PASTA_SAIDA, { recursive: true });
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const arquivoSaida = path.join(PASTA_SAIDA, `contatos_catedral_${dataHoje}.vcf`);

  console.log('Lendo planilha...');

  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const dados = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = dados[1];
  const idxNome = header.indexOf('Nome');
  const idxMatricula = header.indexOf('Matrícula');
  const idxCelular = header.indexOf('Celular');
  const idxTelefone = header.indexOf('Telefone');
  const idxDemissao = header.indexOf('Data de Demissão');
  const idxBase = header.indexOf('Base Operacional');

  const vcfLinhas = [];
  let total = 0;
  let semNumero = 0;
  let desligados = 0;

  for (let i = 2; i < dados.length; i++) {
    const row = dados[i];
    const nome = String(row[idxNome] || '').trim();
    const matricula = String(row[idxMatricula] || '').trim();
    const base = String(row[idxBase] || '').trim();

    if (!nome) continue;

    if (!isAtivo(row[idxDemissao], row[idxBase])) {
      desligados++;
      continue;
    }

    const celularRaw = row[idxCelular] || row[idxTelefone];
    const celularNorm = normalizarCelular(celularRaw);

    if (!celularNorm) {
      semNumero++;
      continue;
    }

    // Padrão: MATRICULA - NOME - BASE (compatível com importação em massa)
    const nomeContato = `${matricula} - ${nome} - ${base}`;
    const telefone = `+${celularNorm}`;

    vcfLinhas.push('BEGIN:VCARD');
    vcfLinhas.push('VERSION:3.0');
    vcfLinhas.push(`FN:${nomeContato}`);
    vcfLinhas.push(`N:${nome};;;${matricula};`);
    vcfLinhas.push(`TEL;TYPE=CELL:${telefone}`);
    vcfLinhas.push(`ORG:Viação Catedral;${base}`);
    vcfLinhas.push('END:VCARD');
    vcfLinhas.push('');
    total++;
  }

  fs.writeFileSync(arquivoSaida, vcfLinhas.join('\n'), 'utf8');

  console.log(`\n✅ Arquivo gerado: ${arquivoSaida}`);
  console.log(`   Contatos gerados:  ${total}`);
  console.log(`   Sem número:        ${semNumero}`);
  console.log(`   Desligados:        ${desligados}`);
  console.log(`\n📲 Como importar:`);
  console.log(`   1. Transfira o arquivo para o celular`);
  console.log(`   2. Abra o arquivo no celular → "Importar contatos"`);
  console.log(`   3. O WhatsApp reconhece automaticamente os novos nomes`);
}

gerarContatos();
