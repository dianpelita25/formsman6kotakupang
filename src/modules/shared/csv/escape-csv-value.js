export function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
