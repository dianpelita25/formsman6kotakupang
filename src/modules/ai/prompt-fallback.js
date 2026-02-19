import { AI_ANALYSIS_MODES } from '../shared/ai-modes.js';

export function buildPromptLegacy({ mode, schoolName, summary, distribution, responses }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  if (mode === AI_ANALYSIS_MODES.EXTERNAL_PEMERINTAH) {
    return [
      'Anda analis kebijakan pendidikan. Buat laporan formal untuk pemda/dinas.',
      `Sekolah: ${schoolName}`,
      'Gunakan bahasa Indonesia formal. Jangan mengarang angka.',
      'Wajib tampilkan ringkasan eksekutif, temuan data, rekomendasi 30-90 hari, dan keterbatasan data.',
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
      '',
      'Responses:',
      responsesBlock,
    ].join('\n');
  }

  if (mode === AI_ANALYSIS_MODES.EXTERNAL_MITRA) {
    return [
      'Anda analis bisnis dampak untuk memo mitra/sponsor/investor.',
      `Sekolah: ${schoolName}`,
      'Jangan mengarang data. Fokus traction, risiko, dan rencana 90 hari.',
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
      '',
      'Responses:',
      responsesBlock,
    ].join('\n');
  }

  if (mode === AI_ANALYSIS_MODES.LIVE_GURU) {
    return [
      'Anda analis program untuk materi presentasi live ke guru dan pimpinan sekolah.',
      `Sekolah: ${schoolName}`,
      'Outputkan 2 slide ringkasan + script 60-90 detik.',
      '',
      'Summary:',
      summaryBlock,
      '',
      'Distribution:',
      distributionBlock,
    ].join('\n');
  }

  return [
    'Anda analis internal produk AITI.',
    `Sekolah: ${schoolName}`,
    'Buat ringkasan eksekutif, KPI, temuan utama, segmentasi, dan rekomendasi aksi.',
    'Jangan mengarang angka. Gunakan data yang ada.',
    '',
    'Summary:',
    summaryBlock,
    '',
    'Distribution:',
    distributionBlock,
    '',
    'Responses:',
    responsesBlock,
  ].join('\n');
}
