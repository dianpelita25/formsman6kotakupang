export function ensureSpace({ doc, y, required, pageHeight, marginBottom, marginTop }) {
  if (y + required <= pageHeight - marginBottom) return y;
  doc.addPage();
  return marginTop;
}

export function getHeadingStyle(level, font, lineHeight) {
  if (level === 1) {
    return { size: font.section, lineHeight: lineHeight.heading };
  }
  if (level === 2) {
    return { size: font.headingLevel2, lineHeight: lineHeight.heading };
  }
  return { size: font.headingLevel3, lineHeight: lineHeight.heading };
}

export function applyBlockGap(previousBlock, nextType, gap) {
  if (!previousBlock) return 0;

  if (previousBlock.type === 'table') {
    let delta = gap.afterTable;
    if (nextType === 'heading') delta += gap.tableToHeadingExtra;
    return delta;
  }

  if (previousBlock.type === 'paragraph') {
    let delta = gap.afterParagraph;
    if (nextType === 'heading') delta += gap.beforeSubheading;
    return delta;
  }

  if (previousBlock.type === 'bullet-list' || previousBlock.type === 'numbered-list') {
    let delta = gap.afterList;
    if (nextType === 'heading') delta += gap.beforeSubheading;
    return delta;
  }

  if (previousBlock.type === 'heading') {
    if (nextType === 'heading') {
      return gap.beforeSubheading;
    }
    return previousBlock.level === 1 ? gap.afterSectionTitle : gap.afterSubheading;
  }

  return 0;
}
