'use strict';

const ExcelJS = require('exceljs');
const fs      = require('fs');
const config  = require('../../config');
const { lerContatosCompletos } = require('../../services/spreadsheetService');
const progressService = require('../../services/progressService');

function lerProgresso(campanhaId) {
  try {
    return progressService.carregar(campanhaId);
  } catch (_) { return {}; }
}

// Cores
const COR = {
  laranja:     'FFF56600',
  laranjaClaro:'FFFFF0E6',
  cinzaHeader: 'FF1F1F1F',
  branco:      'FFFFFFFF',
  verde:       'FFE6F9EE',
  verdeTexto:  'FF166534',
  amarelo:     'FFFEFCE8',
  amareloTexto:'FF854D0E',
  cinzaClaro:  'FFF3F4F6',
  cinzaTexto:  'FF4B5563',
  vermelho:    'FFFEF2F2',
  vermelhoTxt: 'FF991B1B',
  linhaAlt:    'FFFAFAFA',
  borda:       'FFE5E7EB',
};

const STATUS_MAP = {
  enviado:     { label: 'Enviado',     bg: COR.verde,    txt: COR.verdeTexto  },
  pendente:    { label: 'Pendente',    bg: COR.amarelo,  txt: COR.amareloTexto },
  semNumero:   { label: 'Sem número',  bg: COR.cinzaClaro, txt: COR.cinzaTexto },
  semWhatsapp: { label: 'Sem WhatsApp',bg: COR.vermelho, txt: COR.vermelhoTxt  },
};

function formatarData(valor) {
  if (!valor) return '—';
  // Já está no formato pt-BR (ex: "30/06/2026, 11:20:40") — retorna direto
  if (typeof valor === 'string' && valor.includes('/')) return valor;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function bordaFina(cor = COR.borda) {
  const s = { style: 'thin', color: { argb: cor } };
  return { top: s, left: s, bottom: s, right: s };
}

async function gerarExcel(res, campanhaId) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Catedral Bot';
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Relatório de Disparo', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // ── Larguras das colunas ──────────────────────────────────────────────────
  ws.columns = [
    { key: 'A', width: 3  },  // margem esq
    { key: 'B', width: 14 },  // matrícula
    { key: 'C', width: 38 },  // nome
    { key: 'D', width: 16 },  // base
    { key: 'E', width: 20 },  // celular
    { key: 'F', width: 18 },  // status
    { key: 'G', width: 20 },  // enviado em
    { key: 'H', width: 3  },  // margem dir
  ];

  // ── Linha 1-2: espaço topo ────────────────────────────────────────────────
  ws.addRow([]);
  ws.addRow([]);

  // ── Linhas 3-6: cabeçalho com logo ───────────────────────────────────────
  const logoPath = config.paths.imagem;
  let logoRow = 3;

  if (fs.existsSync(logoPath)) {
    const logoId = wb.addImage({ filename: logoPath, extension: 'png' });
    ws.addImage(logoId, { tl: { col: 1, row: 2 }, ext: { width: 110, height: 55 } });
  }

  // Fundo laranja nas linhas 3-6
  for (let r = 3; r <= 6; r++) {
    ws.addRow([]);
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.laranja } };
    }
  }

  // Título na linha 3 (coluna D)
  const titleCell = ws.getCell('D3');
  titleCell.value = 'VIAÇÃO CATEDRAL';
  titleCell.font  = { name: 'Calibri', bold: true, size: 16, color: { argb: COR.branco } };
  titleCell.alignment = { vertical: 'middle' };

  const subtitleCell = ws.getCell('D4');
  subtitleCell.value = 'Relatório de Disparo — Informativo de Tempo de Parada';
  subtitleCell.font  = { name: 'Calibri', size: 10, color: { argb: COR.branco } };

  const dateCell = ws.getCell('D5');
  dateCell.value = `Gerado em: ${formatarData(new Date().toISOString())}`;
  dateCell.font  = { name: 'Calibri', size: 9, color: { argb: 'FFFFD0A0' } };

  // ── Linha 7: espaço ───────────────────────────────────────────────────────
  ws.addRow([]);

  // ── Linha 8-11: resumo estatístico ───────────────────────────────────────
  const progresso  = lerProgresso(campanhaId);
  let total = 0, enviados = 0, pendentes = 0, semNumero = 0, semWA = 0;

  const motoristas = await lerContatosCompletos();
  const lista = motoristas.map(m => {
    const p = progresso[m.matricula] || {};
    let status = 'pendente';
    if (p.status === 'ENVIADO' || p.status === 'PROCESSANDO') status = 'enviado';
    else if (p.status === 'SEM_WHATSAPP')                     status = 'semWhatsapp';
    else if (!m.celular || p.status === 'SEM_NUMERO')         status = 'semNumero';
    total++;
    if (status === 'enviado')        enviados++;
    else if (status === 'pendente')  pendentes++;
    else if (status === 'semNumero') semNumero++;
    else if (status === 'semWhatsapp') semWA++;
    return { ...m, status, enviadoEm: p.enviadoEm || null };
  });

  const taxa = total > 0 ? ((enviados / total) * 100).toFixed(1) : '0.0';

  const stats = [
    ['Total', total],
    ['Enviados', enviados],
    ['Pendentes', pendentes],
    ['Sem número', semNumero],
    ['Sem WhatsApp', semWA],
    ['Taxa de entrega', `${taxa}%`],
  ];

  // Cabeçalho do resumo
  const resumoHeader = ws.addRow([]);
  ws.mergeCells(`B${resumoHeader.number}:G${resumoHeader.number}`);
  const rhCell = ws.getCell(`B${resumoHeader.number}`);
  rhCell.value     = 'RESUMO EXECUTIVO';
  rhCell.font      = { name: 'Calibri', bold: true, size: 9, color: { argb: COR.laranja } };
  rhCell.alignment = { vertical: 'middle' };

  // Grid de resumo 2 colunas × 3 linhas
  const gridCols = [['B','C','D'], ['E','F','G']];
  for (let i = 0; i < stats.length; i += 2) {
    const row = ws.addRow([]);
    const rn  = row.number;

    for (let j = 0; j < 2; j++) {
      const [s1, s2, s3] = gridCols[j];
      const stat = stats[i + j];
      if (!stat) continue;

      ws.mergeCells(`${s1}${rn}:${s3}${rn}`);
      const cell = ws.getCell(`${s1}${rn}`);
      cell.value = `${stat[0]}: ${stat[1]}`;
      cell.font  = { name: 'Calibri', size: 10, bold: stat[0] === 'Taxa de entrega', color: { argb: stat[0] === 'Taxa de entrega' ? COR.laranja : COR.cinzaHeader } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.laranjaClaro } };
      cell.border = bordaFina();
      cell.alignment = { vertical: 'middle', indent: 1 };
      row.height = 20;
    }
  }

  // ── Espaço ────────────────────────────────────────────────────────────────
  ws.addRow([]);

  // ── Cabeçalho da tabela ───────────────────────────────────────────────────
  const headerRow = ws.addRow(['', 'MATRÍCULA', 'NOME COMPLETO', 'BASE', 'CELULAR', 'STATUS', 'ENVIADO EM', '']);
  headerRow.height = 26;
  ['B','C','D','E','F','G'].forEach(col => {
    const cell = ws.getCell(`${col}${headerRow.number}`);
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaHeader } };
    cell.font      = { name: 'Calibri', bold: true, size: 9, color: { argb: COR.branco } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border    = bordaFina(COR.cinzaHeader);
  });

  // ── Dados ─────────────────────────────────────────────────────────────────
  lista.forEach((m, idx) => {
    const isAlt = idx % 2 === 1;
    const st    = STATUS_MAP[m.status] || STATUS_MAP.pendente;

    const row = ws.addRow([
      '',
      m.matricula,
      m.nome,
      m.base || '—',
      m.celular || '—',
      st.label,
      formatarData(m.enviadoEm),
      '',
    ]);
    row.height = 18;

    ['B','C','D','E','G'].forEach(col => {
      const cell = ws.getCell(`${col}${row.number}`);
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? COR.linhaAlt : COR.branco } };
      cell.font      = { name: 'Calibri', size: 9, color: { argb: COR.cinzaHeader } };
      cell.alignment = { vertical: 'middle', indent: 1 };
      cell.border    = bordaFina();
    });

    // Coluna status com cor própria
    const statusCell = ws.getCell(`F${row.number}`);
    statusCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.bg } };
    statusCell.font      = { name: 'Calibri', bold: true, size: 9, color: { argb: st.txt } };
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    statusCell.border    = bordaFina();
  });

  // ── Rodapé ────────────────────────────────────────────────────────────────
  ws.addRow([]);
  const footerRow = ws.addRow(['', '', '', '', '', '', 'Catedral Bot © ' + new Date().getFullYear(), '']);
  const footerCell = ws.getCell(`G${footerRow.number}`);
  footerCell.font      = { name: 'Calibri', size: 8, color: { argb: 'FF9CA3AF' }, italic: true };
  footerCell.alignment = { horizontal: 'right' };

  // ── Enviar ────────────────────────────────────────────────────────────────
  const filename = `relatorio_catedral_${new Date().toISOString().slice(0,10)}.xlsx`;
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

function handler(req, res) {
  const { parse } = require('url');
  const url = (req.url || '/').split('?')[0];
  if (url === '/api/relatorio/excel' && req.method === 'GET') {
    const qs = parse(req.url, true).query;
    const campanhaId = qs.campanha || null;
    gerarExcel(res, campanhaId).catch(err => {
      console.error('[relatorioExcel]', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: 'Erro ao gerar relatório.' }));
      }
    });
    return true;
  }
  return false;
}

module.exports = { handler };
