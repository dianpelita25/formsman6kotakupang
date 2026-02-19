import { PDF_LAYOUT } from './pdf-layout.js';
import { isNumericLike, sanitizeMarkdownInline } from './pdf-parser.js';

export function renderFooterAllPages(doc) {
  const { marginLeft, marginRight, footerTopOffset, footerTextOffset, font } = PDF_LAYOUT;
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTopY = pageHeight - footerTopOffset;
  const footerTextY = pageHeight - footerTextOffset;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 227, 238);
    doc.line(marginLeft, footerTopY, pageWidth - marginRight, footerTopY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.footer);
    doc.setTextColor(100, 116, 139);
    doc.text('PT. AITI GLOBAL NEXUS', marginLeft, footerTextY);
    doc.text(`Halaman ${page}/${pageCount}`, pageWidth - marginRight, footerTextY, {
      align: 'right',
    });
  }
}

export function renderPdfDocument(doc, context) {
  const { marginLeft, marginRight, marginTop, marginBottom, font, lineHeight, gap, listIndent, listMarkerGap } =
    PDF_LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

  const ensureSpace = (required = lineHeight.body) => {
    if (y + required <= pageHeight - marginBottom) return;
    doc.addPage();
    y = marginTop;
  };

  const drawWrappedText = (text, options = {}) => {
    const {
      font = 'helvetica',
      style = 'normal',
      size = PDF_LAYOUT.font.body,
      color = [15, 23, 42],
      lineHeight = PDF_LAYOUT.lineHeight.body,
      x = marginLeft,
      maxWidth = contentWidth,
    } = options;

    const safeText = sanitizeMarkdownInline(text);
    if (!safeText) return;
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(safeText, maxWidth);
    wrapped.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  const drawSectionTitle = (text, sectionNumber) => {
    ensureSpace(gap.beforeSectionTitle + lineHeight.heading + gap.afterSectionTitle);
    y += gap.beforeSectionTitle;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(font.section);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sectionNumber}. ${text}`, marginLeft, y);
    y += lineHeight.heading + gap.afterSectionTitle;
  };

  const drawHangingList = (items, ordered = false) => {
    if (!items.length) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.body);
    doc.setTextColor(15, 23, 42);

    const baseMarkerX = marginLeft;
    const maxLabelWidth = ordered
      ? Math.max(...items.map((_, index) => doc.getTextWidth(`${index + 1}.`)))
      : doc.getTextWidth('-');
    const markerTextX = baseMarkerX;
    const contentX = marginLeft + Math.max(listIndent, maxLabelWidth + listMarkerGap);
    const availableWidth = pageWidth - marginRight - contentX;

    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const safeItem = sanitizeMarkdownInline(item);
      if (!safeItem) return;
      const wrapped = doc.splitTextToSize(safeItem, availableWidth);
      wrapped.forEach((line, lineIndex) => {
        ensureSpace(lineHeight.list);
        if (lineIndex === 0) {
          doc.text(marker, markerTextX, y);
        }
        doc.text(line, contentX, y);
        y += lineHeight.list;
      });
    });
  };

  const getHeadingStyle = (level) => {
    if (level === 1) {
      return { size: font.section, lineHeight: lineHeight.heading };
    }
    if (level === 2) {
      return { size: font.headingLevel2, lineHeight: lineHeight.heading };
    }
    return { size: font.headingLevel3, lineHeight: lineHeight.heading };
  };

  const applyBlockGap = (previousBlock, nextType) => {
    if (!previousBlock) return;

    if (previousBlock.type === 'table') {
      y += gap.afterTable;
      if (nextType === 'heading') y += gap.tableToHeadingExtra;
      return;
    }

    if (previousBlock.type === 'paragraph') {
      y += gap.afterParagraph;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }

    if (previousBlock.type === 'bullet-list' || previousBlock.type === 'numbered-list') {
      y += gap.afterList;
      if (nextType === 'heading') y += gap.beforeSubheading;
      return;
    }

    if (previousBlock.type === 'heading') {
      if (nextType === 'heading') {
        y += gap.beforeSubheading;
        return;
      }
      y += previousBlock.level === 1 ? gap.afterSectionTitle : gap.afterSubheading;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font.title);
  doc.setTextColor(15, 23, 42);
  doc.text(context.title, marginLeft, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font.body);
  doc.setTextColor(71, 85, 105);
  doc.text(context.subtitle, marginLeft, y);
  y += 6;

  doc.setDrawColor(210, 220, 234);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  drawSectionTitle('Informasi Dokumen', 1);
  drawWrappedText(`Mode Analisa: ${context.modeLabel}`, {
    style: 'bold',
    size: font.body,
    lineHeight: lineHeight.metadata,
  });
  drawWrappedText(`Tanggal Analisa: ${context.analyzedAt}`, {
    size: font.body,
    lineHeight: lineHeight.metadata,
  });
  context.metadataLines.forEach((line) => {
    drawWrappedText(`- ${line}`, {
      size: font.body,
      lineHeight: lineHeight.metadata,
    });
  });

  drawSectionTitle('Hasil Analisa', 2);

  if (!context.blocks.length) {
    drawWrappedText('Data analisa belum tersedia.', { size: font.body, lineHeight: lineHeight.body });
    return;
  }

  let previousBlock = null;
  context.blocks.forEach((block) => {
    applyBlockGap(previousBlock, block.type);

    if (block.type === 'heading') {
      const headingLevel = Number(block.level) || 3;
      const headingStyle = getHeadingStyle(headingLevel);
      drawWrappedText(block.text, {
        style: 'bold',
        size: headingStyle.size,
        color: [30, 41, 59],
        lineHeight: headingStyle.lineHeight,
      });
      previousBlock = { type: 'heading', level: headingLevel };
      return;
    }

    if (block.type === 'paragraph') {
      drawWrappedText(block.text, {
        size: font.body,
        lineHeight: lineHeight.body,
      });
      previousBlock = { type: 'paragraph' };
      return;
    }

    if (block.type === 'bullet-list') {
      drawHangingList(block.items, false);
      previousBlock = { type: 'bullet-list' };
      return;
    }

    if (block.type === 'numbered-list') {
      drawHangingList(block.items, true);
      previousBlock = { type: 'numbered-list' };
      return;
    }

    if (block.type === 'table') {
      const header = (block.header || []).map((cell) => sanitizeMarkdownInline(cell));
      const rows = (block.rows || [])
        .map((row) => row.map((cell) => sanitizeMarkdownInline(cell)))
        .filter((row) => row.some((cell) => cell));

      if (!header.length || !rows.length || typeof doc.autoTable !== 'function') {
        if (rows.length) {
          rows.forEach((row) => {
            drawWrappedText(row.join(' | '), {
              size: font.body,
              lineHeight: lineHeight.body,
            });
          });
        }
        previousBlock = { type: 'table' };
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
        const allNumeric = normalizedRows.every((row) => {
          const value = row[col];
          return !value || isNumericLike(value);
        });
        if (allNumeric) {
          columnStyles[col] = { halign: 'right' };
        }
      }

      ensureSpace(18);
      doc.autoTable({
        startY: y,
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

      y = doc.lastAutoTable.finalY + gap.afterTableImmediate;
      previousBlock = { type: 'table' };
    }
  });
}
