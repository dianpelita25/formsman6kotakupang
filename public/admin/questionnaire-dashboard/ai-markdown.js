export function sanitizeMarkdownInline(value) {
  return String(value ?? '')
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function parseTableRow(row) {
  let cleaned = String(row ?? '').trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map((cell) => sanitizeMarkdownInline(cell));
}

function isMarkdownTableSeparator(row) {
  const compact = String(row ?? '').replace(/\s/g, '');
  return /^[|:-]+$/.test(compact) && compact.includes('-');
}

function isBulletListLine(line) {
  return /^(?:[-*]|\u2022)\s+/.test(String(line ?? '').trim());
}

function extractMarkdownTable(lines, startIndex) {
  const headerLine = lines[startIndex]?.trim() || '';
  const separatorLine = lines[startIndex + 1]?.trim() || '';
  if (!headerLine.includes('|') || !isMarkdownTableSeparator(separatorLine)) return null;

  const header = parseTableRow(headerLine);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const tableLine = String(lines[index] || '').trim();
    if (!tableLine || !tableLine.includes('|')) break;
    if (isMarkdownTableSeparator(tableLine)) {
      index += 1;
      continue;
    }
    rows.push(parseTableRow(tableLine));
    index += 1;
  }

  return {
    block: { type: 'table', header, rows },
    nextIndex: index - 1,
  };
}

export function isNumericLike(value) {
  const compact = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?%?$/.test(compact);
}

function detectHeadingBlock(line, nextLine) {
  const markdownHeading = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdownHeading) {
    const hashCount = markdownHeading[1].length;
    const level = hashCount === 1 ? 1 : hashCount === 2 ? 2 : 3;
    return { level, text: sanitizeMarkdownInline(markdownHeading[2]) };
  }

  if (/^\d+\.\d+\s+/.test(line)) {
    return { level: 3, text: sanitizeMarkdownInline(line) };
  }

  if (/^[A-Z]\.\s+/.test(line)) {
    return { level: 2, text: sanitizeMarkdownInline(line) };
  }

  if (/^\d+[.)]\s+/.test(line) && !/^\d+[.)]\s+/.test(nextLine)) {
    return { level: 1, text: sanitizeMarkdownInline(line) };
  }

  if (line.endsWith(':') && line.length <= 120) {
    return { level: 3, text: sanitizeMarkdownInline(line.slice(0, -1)) };
  }

  return null;
}

export function parseAnalysisToBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const blocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = sanitizeMarkdownInline(paragraphBuffer.join(' '));
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const nextLine = String(lines[index + 1] || '').trim();
    const tableExtraction = extractMarkdownTable(lines, index);
    if (tableExtraction) {
      flushParagraph();
      blocks.push(tableExtraction.block);
      index = tableExtraction.nextIndex;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      continue;
    }

    const headingBlock = detectHeadingBlock(line, nextLine);
    if (headingBlock) {
      flushParagraph();
      blocks.push({ type: 'heading', level: headingBlock.level, text: headingBlock.text });
      continue;
    }

    if (isBulletListLine(line)) {
      flushParagraph();
      const items = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = String(lines[listIndex] || '').trim();
        if (!isBulletListLine(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^(?:[-*]|\u2022)\s+/, '')));
        listIndex += 1;
      }
      blocks.push({ type: 'bullet-list', items });
      index = listIndex - 1;
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = String(lines[listIndex] || '').trim();
        if (!/^\d+[.)]\s+/.test(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^\d+[.)]\s+/, '')));
        listIndex += 1;
      }
      blocks.push({ type: 'numbered-list', items });
      index = listIndex - 1;
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}
