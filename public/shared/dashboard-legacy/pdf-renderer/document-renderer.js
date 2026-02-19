import { PDF_LAYOUT } from '../pdf-layout.js';
import { isNumericLike, sanitizeMarkdownInline } from '../pdf-parser.js';
import { applyBlockGap, getHeadingStyle } from './layout-helpers.js';
import { renderAnalysisBlocks } from './block-renderer.js';
import { renderTableBlock } from './table-renderer.js';
import { drawHangingList, drawSectionTitle, drawWrappedText } from './text-renderers.js';

export function renderPdfDocumentImpl(doc, context) {
  const { marginLeft, marginRight, marginTop, marginBottom, font, lineHeight, gap, listIndent, listMarkerGap } =
    PDF_LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

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

  y = drawSectionTitle({
    doc,
    text: 'Informasi Dokumen',
    sectionNumber: 1,
    y,
    gap,
    lineHeight,
    font,
    marginLeft,
    pageHeight,
    marginBottom,
    marginTop,
  });
  y = drawWrappedText({
    doc,
    text: `Mode Analisa: ${context.modeLabel}`,
    y,
    sanitizeMarkdownInline,
    marginLeft,
    contentWidth,
    pageHeight,
    marginBottom,
    marginTop,
    options: {
      style: 'bold',
      size: font.body,
      lineHeight: lineHeight.metadata,
    },
  });
  y = drawWrappedText({
    doc,
    text: `Tanggal Analisa: ${context.analyzedAt}`,
    y,
    sanitizeMarkdownInline,
    marginLeft,
    contentWidth,
    pageHeight,
    marginBottom,
    marginTop,
    options: {
      size: font.body,
      lineHeight: lineHeight.metadata,
    },
  });

  context.metadataLines.forEach((line) => {
    y = drawWrappedText({
      doc,
      text: `- ${line}`,
      y,
      sanitizeMarkdownInline,
      marginLeft,
      contentWidth,
      pageHeight,
      marginBottom,
      marginTop,
      options: {
        size: font.body,
        lineHeight: lineHeight.metadata,
      },
    });
  });

  y = drawSectionTitle({
    doc,
    text: 'Hasil Analisa',
    sectionNumber: 2,
    y,
    gap,
    lineHeight,
    font,
    marginLeft,
    pageHeight,
    marginBottom,
    marginTop,
  });

  if (!context.blocks.length) {
    drawWrappedText({
      doc,
      text: 'Data analisa belum tersedia.',
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
    return;
  }

  y = renderAnalysisBlocks({
    doc,
    blocks: context.blocks,
    y,
    gap,
    font,
    lineHeight,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    pageWidth,
    pageHeight,
    contentWidth,
    listIndent,
    listMarkerGap,
    sanitizeMarkdownInline,
    isNumericLike,
    drawWrappedText,
    drawHangingList,
    applyBlockGap,
    getHeadingStyle,
    renderTableBlock,
  });
}
