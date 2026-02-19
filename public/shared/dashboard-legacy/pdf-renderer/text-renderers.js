import { ensureSpace } from './layout-helpers.js';

export function drawWrappedText({
  doc,
  text,
  y,
  sanitizeMarkdownInline,
  marginLeft,
  contentWidth,
  pageHeight,
  marginBottom,
  marginTop,
  options = {},
}) {
  const {
    font = 'helvetica',
    style = 'normal',
    size = 10,
    color = [15, 23, 42],
    lineHeight = 5.8,
    x = marginLeft,
    maxWidth = contentWidth,
  } = options;

  const safeText = sanitizeMarkdownInline(text);
  if (!safeText) return y;
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const wrapped = doc.splitTextToSize(safeText, maxWidth);
  for (const line of wrapped) {
    y = ensureSpace({ doc, y, required: lineHeight, pageHeight, marginBottom, marginTop });
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function drawSectionTitle({
  doc,
  text,
  sectionNumber,
  y,
  gap,
  lineHeight,
  font,
  marginLeft,
  pageHeight,
  marginBottom,
  marginTop,
}) {
  y = ensureSpace({
    doc,
    y,
    required: gap.beforeSectionTitle + lineHeight.heading + gap.afterSectionTitle,
    pageHeight,
    marginBottom,
    marginTop,
  });
  y += gap.beforeSectionTitle;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font.section);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sectionNumber}. ${text}`, marginLeft, y);
  y += lineHeight.heading + gap.afterSectionTitle;
  return y;
}

export function drawHangingList({
  doc,
  items,
  ordered,
  y,
  marginLeft,
  marginRight,
  pageWidth,
  lineHeight,
  listIndent,
  listMarkerGap,
  sanitizeMarkdownInline,
  pageHeight,
  marginBottom,
  marginTop,
}) {
  if (!items.length) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const baseMarkerX = marginLeft;
  const maxLabelWidth = ordered ? Math.max(...items.map((_, index) => doc.getTextWidth(`${index + 1}.`))) : doc.getTextWidth('-');
  const markerTextX = baseMarkerX;
  const contentX = marginLeft + Math.max(listIndent, maxLabelWidth + listMarkerGap);
  const availableWidth = pageWidth - marginRight - contentX;

  items.forEach((item, index) => {
    const marker = ordered ? `${index + 1}.` : '-';
    const safeItem = sanitizeMarkdownInline(item);
    if (!safeItem) return;
    const wrapped = doc.splitTextToSize(safeItem, availableWidth);
    wrapped.forEach((line, lineIndex) => {
      y = ensureSpace({ doc, y, required: lineHeight.list, pageHeight, marginBottom, marginTop });
      if (lineIndex === 0) {
        doc.text(marker, markerTextX, y);
      }
      doc.text(line, contentX, y);
      y += lineHeight.list;
    });
  });
  return y;
}
