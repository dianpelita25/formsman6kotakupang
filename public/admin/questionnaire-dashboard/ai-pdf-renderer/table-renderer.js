import { isNumericLike, sanitizeMarkdownInline } from '../ai-markdown.js';

export function drawSimpleTable(primitives, doc, heading, rows) {
  const { drawSectionTitle, drawWrappedText, ensureSpace, marginLeft, marginRight, font, gap, PDF_LAYOUT } = primitives;

  drawSectionTitle(heading);
  if (!rows.length) {
    drawWrappedText('Belum ada data.', { size: font.body, lineHeight: primitives.lineHeight.body });
    return;
  }

  if (typeof doc.autoTable !== 'function') {
    rows.forEach(([label, value]) => drawWrappedText(`${label}: ${value}`, { size: font.body, lineHeight: primitives.lineHeight.body }));
    return;
  }

  ensureSpace(16);
  doc.autoTable({
    startY: primitives.getY(),
    margin: { left: marginLeft, right: marginRight },
    head: [['Metrik', 'Nilai']],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: font.table,
      cellPadding: PDF_LAYOUT.table.cellPadding,
      lineColor: [214, 224, 238],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: { fillColor: [237, 242, 248], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });
  primitives.setY(doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : primitives.getY() + 24);
}

export function drawMarkdownTable(primitives, doc, block) {
  const { ensureSpace, marginLeft, marginRight, font, gap, PDF_LAYOUT, drawWrappedText } = primitives;
  const header = (block.header || []).map((cell) => sanitizeMarkdownInline(cell));
  const rows = (block.rows || []).map((row) => row.map((cell) => sanitizeMarkdownInline(cell))).filter((row) => row.some((cell) => cell));

  if (!header.length || !rows.length || typeof doc.autoTable !== 'function') {
    if (rows.length) rows.forEach((row) => drawWrappedText(row.join(' | '), { size: font.body, lineHeight: primitives.lineHeight.body }));
    return;
  }

  const columnCount = header.length;
  const normalizedRows = rows.map((row) => {
    const cloned = [...row];
    while (cloned.length < columnCount) cloned.push('');
    return cloned.slice(0, columnCount);
  });

  const columnStyles = {};
  for (let col = 0; col < columnCount; col += 1) {
    const allNumeric = normalizedRows.every((row) => !row[col] || isNumericLike(row[col]));
    if (allNumeric) columnStyles[col] = { halign: 'right' };
  }

  ensureSpace(16);
  doc.autoTable({
    startY: primitives.getY(),
    margin: { left: marginLeft, right: marginRight },
    head: [header],
    body: normalizedRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: font.table,
      cellPadding: PDF_LAYOUT.table.cellPadding,
      lineColor: [214, 224, 238],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: { fillColor: [237, 242, 248], textColor: [30, 41, 59], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles,
  });
  primitives.setY(doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + gap.afterTableImmediate : primitives.getY() + 24);
}
