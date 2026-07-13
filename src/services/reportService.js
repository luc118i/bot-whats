'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const PASTA_RELATORIO = config.paths.relatorio;

/**
 * Gera um relatório PDF com o resumo e detalhes individuais de cada motorista.
 * O arquivo é salvo em `output/relatorio/` com nome baseado na data e hora atuais.
 * Para cada motorista com status ENVIADO, inclui o print do chat se disponível.
 *
 * @param {Array<{nome: string, matricula: string, celular: string|null, status: string, print: string|null, erro: string|null}>} resultados
 *   Lista completa de motoristas com seus respectivos status de envio.
 * @returns {string} Caminho absoluto do arquivo PDF gerado.
 */
function gerarRelatorio(resultados) {
  if (!fs.existsSync(PASTA_RELATORIO)) {
    fs.mkdirSync(PASTA_RELATORIO, { recursive: true });
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const horaAgora = new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-');
  const arquivoPDF = path.join(PASTA_RELATORIO, `relatorio_${dataHoje}_${horaAgora}.pdf`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(fs.createWriteStream(arquivoPDF));

  // Capa
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F5F5F5');
  doc.fillColor('#E65C00').rect(0, 0, doc.page.width, 120).fill();

  doc
    .fillColor('white')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('VIAÇÃO CATEDRAL', 40, 30, { align: 'center' });

  doc
    .fontSize(14)
    .font('Helvetica')
    .text('Relatório de Envio — Informativo de Tempo de Parada', 40, 62, { align: 'center' });

  doc
    .fillColor('#333')
    .fontSize(11)
    .text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, 40, 135, { align: 'center' });

  // Blocos de resumo
  const enviados = resultados.filter((r) => r.status === 'ENVIADO').length;
  const semNumero = resultados.filter((r) => r.status === 'SEM_NUMERO').length;
  const falhou = resultados.filter((r) => r.status === 'FALHOU').length;
  const total = resultados.length;

  doc.moveDown(3);
  const yColunas = 180;

  const blocos = [
    { label: 'Total', valor: total, cor: '#2196F3' },
    { label: 'Enviados', valor: enviados, cor: '#4CAF50' },
    { label: 'Sem Número', valor: semNumero, cor: '#FF9800' },
    { label: 'Falhou', valor: falhou, cor: '#F44336' },
  ];

  blocos.forEach((b, i) => {
    const x = 40 + i * 128;
    doc.fillColor(b.cor).roundedRect(x, yColunas, 118, 60, 8).fill();
    doc
      .fillColor('white')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(b.valor, x, yColunas + 8, { width: 118, align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(b.label, x, yColunas + 36, { width: 118, align: 'center' });
  });

  doc.addPage();

  // Detalhes por motorista
  resultados.forEach((r, idx) => {
    if (idx > 0 && idx % 1 === 0 && doc.y > 650) doc.addPage();

    const corStatus =
      r.status === 'ENVIADO' ? '#4CAF50' : r.status === 'SEM_NUMERO' ? '#FF9800' : '#F44336';

    doc.fillColor('#E65C00').rect(40, doc.y, doc.page.width - 80, 24).fill();
    doc
      .fillColor('white')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`${idx + 1}. ${r.nome}  |  Matrícula: ${r.matricula}`, 48, doc.y - 18);

    doc.moveDown(0.3);
    doc
      .fillColor('#555')
      .fontSize(10)
      .font('Helvetica')
      .text(`Número: ${r.celular || 'Não informado'}`, 48, doc.y);

    doc
      .fillColor(corStatus)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Status: ${r.status}`, 300, doc.y - 12);

    if (r.erro) {
      doc
        .fillColor('#F44336')
        .fontSize(9)
        .font('Helvetica')
        .text(`Erro: ${r.erro}`, 48, doc.y + 2);
    }

    doc.moveDown(0.5);

    // Print do chat
    if (r.print && fs.existsSync(r.print)) {
      try {
        const imgY = doc.y;
        doc.image(r.print, 40, imgY, { width: doc.page.width - 80, height: 320 });
        doc.y = imgY + 330;
      } catch (e) {
        doc
          .fillColor('#999')
          .fontSize(9)
          .text('[Não foi possível carregar o print]', 48, doc.y);
      }
    } else {
      doc
        .fillColor('#999')
        .fontSize(9)
        .font('Helvetica')
        .text('[Print não disponível]', 48, doc.y);
    }

    doc.moveDown(1);
    doc.fillColor('#DDD').moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);
  });

  doc.end();
  console.log(`\n✅ Relatório PDF gerado: ${arquivoPDF}`);
  return arquivoPDF;
}

module.exports = { gerarRelatorio };
