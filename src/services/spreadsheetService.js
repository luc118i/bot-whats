'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const config = require('../config');
const { normalizarCelular, formatarParaWhatsApp } = require('../utils/phone');

const PLANILHA = config.paths.planilha;
const DATAS_ATIVO = config.whatsapp.datasAtivo;

/**
 * Verifica se um motorista está ativo com base na data de demissão e base operacional.
 *
 * @param {string|undefined} dataDemissao - Data de demissão no formato DD/MM/YYYY.
 * @param {string|undefined} baseOperacional - Nome da base operacional.
 * @returns {boolean} true se o motorista estiver ativo, false se desligado.
 */
function isAtivo(dataDemissao, baseOperacional) {
  const base = String(baseOperacional || '').trim().toUpperCase();
  if (base === 'DESLIGADOS') return false;

  const data = String(dataDemissao || '').trim();
  if (!data) return true;

  if (DATAS_ATIVO.includes(data)) return true;

  const partes = data.split('/');
  if (partes.length === 3) {
    const dataObj = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    if (!isNaN(dataObj) && dataObj < new Date()) return false;
  }

  return true;
}

/**
 * Lê a planilha principal e retorna a lista de motoristas ativos.
 * Motoristas desligados são ignorados automaticamente.
 * Motoristas sem número recebem `semNumero: true` e `celular: null`.
 *
 * @returns {Array<{nome: string, matricula: string, celular: string|null, semNumero: boolean, ativo: boolean}>}
 *   Lista de motoristas processados.
 */
function lerMotoristas() {
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

  const motoristas = [];
  let desligados = 0;

  for (let i = 2; i < dados.length; i++) {
    const row = dados[i];
    const nome = row[idxNome];
    const matricula = row[idxMatricula];

    if (!nome) continue;

    const ativo = isAtivo(row[idxDemissao], row[idxBase]);
    if (!ativo) {
      desligados++;
      continue;
    }

    const base = String(row[idxBase] || '').trim();
    const celularRaw = row[idxCelular] || row[idxTelefone];
    const celularNorm = normalizarCelular(celularRaw);

    if (!celularNorm) {
      motoristas.push({
        nome: String(nome).trim(),
        matricula: String(matricula).trim(),
        celular: null,
        base,
        semNumero: true,
        ativo: true,
      });
      continue;
    }

    motoristas.push({
      nome: String(nome).trim(),
      matricula: String(matricula).trim(),
      celular: formatarParaWhatsApp(celularNorm),
      base,
      semNumero: false,
      ativo: true,
    });
  }

  if (desligados > 0) {
    console.log(`🚫 ${desligados} motorista(s) desligado(s) ignorado(s) automaticamente.\n`);
  }

  return motoristas;
}

/**
 * Lê todas as linhas brutas da planilha (sem processamento de status).
 * Usado pelo servidor de interface para calcular estatísticas rápidas.
 *
 * @returns {Array<Array<any>>} Linhas brutas da planilha como array de arrays.
 */
function lerLinhasBrutas() {
  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 });
}

/**
 * Atualiza os números de celular de motoristas na planilha principal.
 * Para cada motorista em `motoristasNovos`, localiza a linha pela matrícula
 * e preenche as colunas Celular e Telefone.
 * Também remove do progresso.json os motoristas que receberam número
 * e estavam marcados como SEM_NUMERO, liberando-os para o próximo envio.
 *
 * @param {Array<{matricula: string, celular: string}>} motoristasNovos
 *   Lista de motoristas com novos números a atualizar.
 * @param {string} arquivoProgresso - Caminho para o progresso.json.
 * @returns {{ atualizados: number, naoEncontrados: number }}
 *   Contagem de atualizações realizadas e matrículas não encontradas.
 */
function atualizarNumeros(motoristasNovos, arquivoProgresso) {
  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[1];
  const idxMatricula = header.indexOf('Matrícula');
  const idxCelular = header.indexOf('Celular');
  const idxTelefone = header.indexOf('Telefone');

  const mapaLinhas = {};
  for (let i = 2; i < rows.length; i++) {
    const mat = String(rows[i][idxMatricula] || '').trim();
    if (mat) mapaLinhas[mat] = i;
  }

  let atualizados = 0;
  let naoEncontrados = 0;

  for (const m of motoristasNovos) {
    const mat = String(m.matricula).trim();
    const cel = String(m.celular).replace(/\D/g, '');

    if (mapaLinhas[mat] !== undefined) {
      const rowIdx = mapaLinhas[mat];
      rows[rowIdx][idxCelular] = cel;
      rows[rowIdx][idxTelefone] = cel;
      atualizados++;
    } else {
      naoEncontrados++;
    }
  }

  const novoWs = XLSX.utils.aoa_to_sheet(rows);
  wb.Sheets[wb.SheetNames[0]] = novoWs;
  XLSX.writeFile(wb, PLANILHA);

  // Remove do progresso.json motoristas que agora têm número
  if (fs.existsSync(arquivoProgresso)) {
    const prog = JSON.parse(fs.readFileSync(arquivoProgresso, 'utf8'));
    for (const m of motoristasNovos) {
      const mat = String(m.matricula).trim();
      if (prog[mat] && prog[mat].status === 'SEM_NUMERO') {
        delete prog[mat];
      }
    }
    fs.writeFileSync(arquivoProgresso, JSON.stringify(prog, null, 2), 'utf8');
  }

  return { atualizados, naoEncontrados };
}

/**
 * Lê todos os motoristas ativos com dados completos incluindo base operacional.
 * Usado pela API de contatos para listagem na interface.
 *
 * @returns {Array<{nome, matricula, celular, base, semNumero, ativo}>}
 */
function lerContatosCompletos() {
  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const dados = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = dados[1];
  const idxNome      = header.indexOf('Nome');
  const idxMatricula = header.indexOf('Matrícula');
  const idxCelular   = header.indexOf('Celular');
  const idxTelefone  = header.indexOf('Telefone');
  const idxDemissao  = header.indexOf('Data de Demissão');
  const idxBase      = header.indexOf('Base Operacional');

  const contatos = [];

  for (let i = 2; i < dados.length; i++) {
    const row = dados[i];
    const nome      = row[idxNome];
    const matricula = row[idxMatricula];
    if (!nome) continue;

    const base = String(row[idxBase] || '').trim();
    if (!isAtivo(row[idxDemissao], base)) continue;

    const celularRaw  = row[idxCelular] || row[idxTelefone];
    const celularNorm = normalizarCelular(celularRaw);

    contatos.push({
      nome:       String(nome).trim(),
      matricula:  String(matricula).trim(),
      celular:    celularNorm || null,
      base:       base || '—',
      semNumero:  !celularNorm,
      ativo:      true,
    });
  }

  return contatos;
}

/**
 * Atualiza os dados de um único motorista na planilha pelo número de matrícula.
 * Campos suportados: nome, celular.
 *
 * @param {string} matricula
 * @param {{ nome?: string, celular?: string }} dados
 * @returns {{ ok: boolean, erro?: string }}
 */
function atualizarContato(matricula, dados) {
  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[1];
  const idxMatricula = header.indexOf('Matrícula');
  const idxNome      = header.indexOf('Nome');
  const idxCelular   = header.indexOf('Celular');
  const idxTelefone  = header.indexOf('Telefone');

  const mat = String(matricula).trim();
  let encontrado = false;

  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i][idxMatricula] || '').trim() !== mat) continue;
    encontrado = true;

    if (dados.nome   !== undefined && idxNome    >= 0) rows[i][idxNome]    = dados.nome.trim();
    if (dados.celular !== undefined) {
      const cel = String(dados.celular).replace(/\D/g, '');
      if (idxCelular  >= 0) rows[i][idxCelular]  = cel;
      if (idxTelefone >= 0) rows[i][idxTelefone] = cel;
    }
    break;
  }

  if (!encontrado) return { ok: false, erro: 'Matrícula não encontrada na planilha.' };

  const novoWs = XLSX.utils.aoa_to_sheet(rows);
  wb.Sheets[wb.SheetNames[0]] = novoWs;
  XLSX.writeFile(wb, PLANILHA);
  return { ok: true };
}

/**
 * Insere um novo motorista na planilha principal.
 * @param {{ matricula: string, nome: string, base?: string, celular?: string }} dados
 * @returns {{ ok: boolean, erro?: string }}
 */
function criarContato(dados) {
  const wb = XLSX.readFile(PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[1];
  const idxMatricula = header.indexOf('Matrícula');
  const idxNome      = header.indexOf('Nome');
  const idxCelular   = header.indexOf('Celular');
  const idxTelefone  = header.indexOf('Telefone');
  const idxBase      = header.indexOf('Base Operacional');

  const mat = String(dados.matricula || '').trim();
  if (!mat) return { ok: false, erro: 'Matrícula é obrigatória.' };

  // Verifica duplicata
  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i][idxMatricula] || '').trim() === mat) {
      return { ok: false, erro: 'Matrícula já existe na planilha.' };
    }
  }

  // Monta nova linha respeitando as colunas existentes
  const novaLinha = Array(header.length).fill('');
  novaLinha[idxMatricula] = mat;
  if (idxNome  >= 0) novaLinha[idxNome]  = String(dados.nome  || '').trim();
  if (idxBase  >= 0) novaLinha[idxBase]  = String(dados.base  || '').trim();
  if (dados.celular) {
    const cel = String(dados.celular).replace(/\D/g, '');
    if (idxCelular  >= 0) novaLinha[idxCelular]  = cel;
    if (idxTelefone >= 0) novaLinha[idxTelefone] = cel;
  }

  rows.push(novaLinha);

  const novoWs = XLSX.utils.aoa_to_sheet(rows);
  wb.Sheets[wb.SheetNames[0]] = novoWs;
  XLSX.writeFile(wb, PLANILHA);
  return { ok: true };
}

module.exports = { lerMotoristas, lerLinhasBrutas, atualizarNumeros, isAtivo, lerContatosCompletos, atualizarContato, criarContato };
