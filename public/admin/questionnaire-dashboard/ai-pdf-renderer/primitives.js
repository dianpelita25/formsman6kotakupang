import { sanitizeMarkdownInline } from '../ai-markdown.js';
import { PDF_LAYOUT } from '../ai-pdf-layout.js';

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
    doc.text('AITI FORMS', marginLeft, footerTextY);
    doc.text(`Halaman ${page}/${pageCount}`, pageWidth - marginRight, footerTextY, { align: 'right' });
  }
}

export function createPdfPrimitives(doc) {
  const { marginLeft, marginRight, marginTop, marginBottom, font, lineHeight, gap, listIndent, listMarkerGap } = PDF_LAYOUT;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginLeft - marginRight;

  let y = marginTop;
  let sectionNumber = 1;

  function ensureSpace(required = lineHeight.body) {
    if (y + required <= pageHeight - marginBottom) return;
    doc.addPage();
    y = marginTop;
  }

  function drawWrappedText(text, options = {}) {
    const {
      style = 'normal',
      size = font.body,
      color = [15, 23, 42],
      lineHeight: drawLineHeight = lineHeight.body,
      x = marginLeft,
      maxWidth = contentWidth,
    } = options;

    const safeText = sanitizeMarkdownInline(text);
    if (!safeText) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(safeText, maxWidth);
    wrapped.forEach((line) => {
      ensureSpace(drawLineHeight);
      doc.text(line, x, y);
      y += drawLineHeight;
    });
  }

  function drawSectionTitle(text) {
    ensureSpace(gap.beforeSectionTitle + lineHeight.heading + gap.afterSectionTitle);
    y += gap.beforeSectionTitle;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(font.section);
    doc.setTextColor(15, 23, 42);
    doc.text(`${sectionNumber}. ${text}`, marginLeft, y);
    sectionNumber += 1;
    y += lineHeight.heading + gap.afterSectionTitle;
  }

  function drawHangingList(items, ordered = false) {
    if (!items.length) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(font.body);
    doc.setTextColor(15, 23, 42);

    const markerX = marginLeft;
    const markerWidth = ordered ? Math.max(...items.map((_, index) => doc.getTextWidth(`${index + 1}.`))) : doc.getTextWidth('-');
    const contentX = marginLeft + Math.max(listIndent, markerWidth + listMarkerGap);
    const availableWidth = pageWidth - marginRight - contentX;

    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const safeItem = sanitizeMarkdownInline(item);
      if (!safeItem) return;
      const wrapped = doc.splitTextToSize(safeItem, availableWidth);
      wrapped.forEach((line, lineIndex) => {
        ensureSpace(lineHeight.list);
        if (lineIndex === 0) doc.text(marker, markerX, y);
        doc.text(line, contentX, y);
        y += lineHeight.list;
      });
    });
  }

  function getHeadingStyle(level) {
    if (level === 1) return { size: font.section, lineHeight: lineHeight.heading };
    if (level === 2) return { size: font.headingLevel2, lineHeight: lineHeight.heading };
    return { size: font.headingLevel3, lineHeight: lineHeight.heading };
  }

  function applyBlockGap(previousBlock, nextType) {
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
  }

  return {
    PDF_LAYOUT,
    marginLeft,
    marginRight,
    font,
    lineHeight,
    gap,
    ensureSpace,
    drawWrappedText,
    drawSectionTitle,
    drawHangingList,
    getHeadingStyle,
    applyBlockGap,
    getY: () => y,
    setY: (nextY) => {
      y = nextY;
    },
  };
}
