import { appendCell, clearChildren } from '/forms-static/shared/safe-dom.js';

function buildDistributionRows(distribution = {}) {
  const rows = [];
  const questions = Array.isArray(distribution?.questions) ? distribution.questions : [];

  questions.forEach((question) => {
    const type = String(question?.type || '').trim();
    if (!['scale', 'radio', 'checkbox'].includes(type)) return;

    const questionLabel = String(question?.questionCode || question?.label || question?.name || '-').trim();
    const counts = Array.isArray(question?.counts) ? question.counts : [];
    counts.forEach((count) => {
      rows.push({
        question: questionLabel,
        bucket: String(count?.label || '-').trim(),
        total: Number(count?.total || 0),
      });
    });
  });

  rows.sort((left, right) => right.total - left.total);
  return rows.slice(0, 8);
}

export function renderDistributionTable(distributionTableBody, distribution = {}) {
  const rows = buildDistributionRows(distribution);
  clearChildren(distributionTableBody);

  if (!rows.length) {
    const emptyRow = document.createElement('tr');
    const cell = appendCell(emptyRow, 'Belum ada distribusi yang memenuhi batas publik.');
    cell.colSpan = 3;
    distributionTableBody.append(emptyRow);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    appendCell(tr, row.question);
    appendCell(tr, row.bucket);
    appendCell(tr, row.total);
    distributionTableBody.append(tr);
  });
}
