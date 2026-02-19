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

function extractMarkdownTables(lines, startIndex) {
  const headerLine = lines[startIndex]?.trim() || '';
  const separatorLine = lines[startIndex + 1]?.trim() || '';
  if (!headerLine.includes('|') || !isMarkdownTableSeparator(separatorLine)) return null;

  const header = parseTableRow(headerLine);
  const rows = [];
  let i = startIndex + 2;

  while (i < lines.length) {
    const tableLine = lines[i].trim();
    if (!tableLine || !tableLine.includes('|')) break;
    if (isMarkdownTableSeparator(tableLine)) {
      i += 1;
      continue;
    }
    rows.push(parseTableRow(tableLine));
    i += 1;
  }

  return {
    block: { type: 'table', header, rows },
    nextIndex: i - 1,
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

  if (/^slide\s+\d+/i.test(line)) {
    return { level: 1, text: sanitizeMarkdownInline(line) };
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
    return { level: 3, text: sanitizeMarkdownInline(line.replace(/:$/, '')) };
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

  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] || '').trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const nextLine = (lines[i + 1] || '').trim();
    const tableExtraction = extractMarkdownTables(lines, i);
    if (tableExtraction) {
      flushParagraph();
      blocks.push(tableExtraction.block);
      i = tableExtraction.nextIndex;
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
      let j = i;
      while (j < lines.length) {
        const listLine = (lines[j] || '').trim();
        if (!isBulletListLine(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^(?:[-*]|\u2022)\s+/, '')));
        j += 1;
      }
      blocks.push({ type: 'bullet-list', items });
      i = j - 1;
      continue;
    }

    if (/^\d+[.\)]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      let j = i;
      while (j < lines.length) {
        const listLine = (lines[j] || '').trim();
        if (!/^\d+[.\)]\s+/.test(listLine)) break;
        items.push(sanitizeMarkdownInline(listLine.replace(/^\d+[.\)]\s+/, '')));
        j += 1;
      }
      blocks.push({ type: 'numbered-list', items });
      i = j - 1;
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}
