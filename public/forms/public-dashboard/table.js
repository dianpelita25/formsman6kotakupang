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
  distributionTableBody.innerHTML = '';

  if (!rows.length) {
    distributionTableBody.innerHTML = '<tr><td colspan="3">Belum ada distribusi yang memenuhi batas publik.</td></tr>';
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.question}</td>
      <td>${row.bucket}</td>
      <td>${row.total}</td>
    `;
    distributionTableBody.append(tr);
  });
}
