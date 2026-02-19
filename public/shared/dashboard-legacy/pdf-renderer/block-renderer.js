export function renderAnalysisBlocks(context) {
  const {
    doc,
    blocks,
    y: initialY,
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
  } = context;

  let y = initialY;
  let previousBlock = null;
  blocks.forEach((block) => {
    y += applyBlockGap(previousBlock, block.type, gap);

    if (block.type === 'heading') {
      const headingLevel = Number(block.level) || 3;
      const headingStyle = getHeadingStyle(headingLevel, font, lineHeight);
      y = drawWrappedText({
        doc,
        text: block.text,
        y,
        sanitizeMarkdownInline,
        marginLeft,
        contentWidth,
        pageHeight,
        marginBottom,
        marginTop,
        options: {
          style: 'bold',
          size: headingStyle.size,
          color: [30, 41, 59],
          lineHeight: headingStyle.lineHeight,
        },
      });
      previousBlock = { type: 'heading', level: headingLevel };
      return;
    }

    if (block.type === 'paragraph') {
      y = drawWrappedText({
        doc,
        text: block.text,
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
      previousBlock = { type: 'paragraph' };
      return;
    }

    if (block.type === 'bullet-list') {
      y = drawHangingList({
        doc,
        items: block.items,
        ordered: false,
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
      });
      previousBlock = { type: 'bullet-list' };
      return;
    }

    if (block.type === 'numbered-list') {
      y = drawHangingList({
        doc,
        items: block.items,
        ordered: true,
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
      });
      previousBlock = { type: 'numbered-list' };
      return;
    }

    if (block.type === 'table') {
      y = renderTableBlock({
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
      });
      previousBlock = { type: 'table' };
    }
  });

  return y;
}
