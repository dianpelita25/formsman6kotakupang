import { drawMarkdownTable } from './table-renderer.js';

export function renderAiBlocks(primitives, doc, blocks = []) {
  const { drawWrappedText, drawHangingList, getHeadingStyle, applyBlockGap } = primitives;
  if (!blocks.length) {
    drawWrappedText('Data analisis belum tersedia.', { size: primitives.font.body, lineHeight: primitives.lineHeight.body });
    return;
  }

  let previousBlock = null;
  blocks.forEach((block) => {
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
      drawWrappedText(block.text, { size: primitives.font.body, lineHeight: primitives.lineHeight.body });
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
      drawMarkdownTable(primitives, doc, block);
      previousBlock = { type: 'table' };
    }
  });
}
