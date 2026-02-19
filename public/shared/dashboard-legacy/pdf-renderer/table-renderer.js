import { ensureSpace } from './layout-helpers.js';
import { drawWrappedText } from './text-renderers.js';

export function renderTableBlock({
  doc,
  block,
  y,
  marginLeft,
  marginRight,
  pageWidth,
  gap,
  font,
  lineHeight,
  pageHeight,
  marginBottom,
  marginTop,
  sanitizeMarkdownInline,
  isNumericLike,
  contentWidth,
}) {
  const header = (block.header || []).map((cell) => sanitizeMarkdownInline(cell));
  const rows = (block.rows || [])
    .map((row) => row.map((cell) => sanitizeMarkdownInline(cell)))
    .filter((row) => row.some((cell) => cell));

  if (!header.length || !rows.length || typeof doc.autoTable !== 'function') {
    if (rows.length) {
      rows.forEach((row) => {
        y = drawWrappedText({
          doc,
          text: row.join(' | '),
          y,
          sanitizeMarkdownInline,
          marginLeft,
          contentWidth,
          pageHeight,
          marginBottom,
          marginTop,
          options: {
            size: font.body,
            lineHeight: lineHeight.body,
          },
        });
      });
    }
    return y;
  }

  const columnCount = header.length;
  const normalizedRows = rows.map((row) => {
    const cloned = [...row];
    while (cloned.length < columnCount) cloned.push('');
    return cloned.slice(0, columnCount);
  });

  const columnStyles = {};
  for (let col = 0; col < columnCount; col += 1) {
    const allNumeric = normalizedRows.every((row) => {
      const value = row[col];
      return !value || isNumericLike(value);
    });
    if (allNumeric) {
      columnStyles[col] = { halign: 'right' };
    }
  }

  y = ensureSpace({ doc, y, required: 18, pageHeight, marginBottom, marginTop });
  doc.autoTable({
    startY: y,
    margin: { left: marginLeft, right: marginRight },
    head: [header],
    body: normalizedRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: font.table,
      cellPadding: 2,
      lineColor: [214, 224, 238],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [237, 242, 248],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    columnStyles,
  });

  return doc.lastAutoTable.finalY + gap.afterTableImmediate;
}
