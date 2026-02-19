import { createPdfPrimitives } from './primitives.js';
import { drawSimpleTable } from './table-renderer.js';
import { renderAiBlocks } from './block-layout.js';

export function renderPdfDocument(doc, context) {
  const primitives = createPdfPrimitives(doc);
  const { marginLeft, marginRight, drawWrappedText, drawSectionTitle, gap, font, lineHeight } = primitives;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font.title);
  doc.setTextColor(15, 23, 42);
  doc.text(context.title, marginLeft, primitives.getY());
  primitives.setY(primitives.getY() + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font.body);
  doc.setTextColor(71, 85, 105);
  doc.text(context.subtitle, marginLeft, primitives.getY());
  primitives.setY(primitives.getY() + 6);

  doc.setDrawColor(210, 220, 234);
  doc.line(marginLeft, primitives.getY(), pageWidth - marginRight, primitives.getY());
  primitives.setY(primitives.getY() + 6);

  drawSectionTitle('Informasi Dokumen');
  drawWrappedText(`Mode Analisis: ${context.modeLabel}`, { style: 'bold', size: font.body, lineHeight: lineHeight.metadata });
  drawWrappedText(`Tanggal Analisis: ${context.analyzedAt}`, { size: font.body, lineHeight: lineHeight.metadata });
  context.metadataLines.forEach((line) => {
    drawWrappedText(`- ${line}`, { size: font.body, lineHeight: lineHeight.metadata });
  });

  drawSimpleTable(primitives, doc, 'Ringkasan KPI', context.summaryRows);

  if (context.distributionRows.length) {
    drawSectionTitle(`Distribusi Pilihan (${context.distributionTitle})`);
    if (typeof doc.autoTable === 'function') {
      primitives.ensureSpace(16);
      doc.autoTable({
        startY: primitives.getY(),
        margin: { left: marginLeft, right: marginRight },
        head: [['Pilihan', 'Jumlah']],
        body: context.distributionRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: font.table,
          cellPadding: primitives.PDF_LAYOUT.table.cellPadding,
          lineColor: [214, 224, 238],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
        },
        headStyles: { fillColor: [237, 242, 248], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      });
      primitives.setY(doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : primitives.getY() + 24);
    } else {
      context.distributionRows.forEach(([label, total]) => {
        drawWrappedText(`${label}: ${total}`, { size: font.body, lineHeight: lineHeight.body });
      });
    }
  }

  drawSectionTitle('Hasil Analisis AI');
  renderAiBlocks(primitives, doc, context.blocks || []);
}
