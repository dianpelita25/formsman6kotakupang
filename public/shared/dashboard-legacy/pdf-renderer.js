import { PDF_LAYOUT } from './pdf-layout.js';
import { renderPdfDocumentImpl } from './pdf-renderer/document-renderer.js';

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
  return renderPdfDocumentImpl(doc, context);
}
