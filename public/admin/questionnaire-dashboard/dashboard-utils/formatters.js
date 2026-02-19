export function formatNumber(value, fractionDigits = 0) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return fractionDigits > 0 ? '0.00' : '0';
  return number.toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatVersionShort(versionId) {
  const text = String(versionId || '').trim();
  if (!text) return '-';
  return text.length <= 12 ? text : `${text.slice(0, 8)}...`;
}

export function truncateText(value, maxLength = 72) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
