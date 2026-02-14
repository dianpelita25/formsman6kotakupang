import {
  ensureAiAnalysisTable,
  getLatestAiAnalysis,
  insertAiAnalysis,
} from './repository.js';
import { getResponsesForAi } from '../submission/repository.js';
import { getAnalyticsDistribution, getAnalyticsSummary } from '../submission/service.js';

let aiTableEnsured = false;

export const AI_ANALYSIS_MODES = Object.freeze({
  INTERNAL: 'internal',
  EXTERNAL_PEMERINTAH: 'external_pemerintah',
  EXTERNAL_MITRA: 'external_mitra',
  LIVE_GURU: 'live_guru',
});

const VALID_AI_ANALYSIS_MODES = new Set(Object.values(AI_ANALYSIS_MODES));

async function ensureAiTableOnce() {
  if (aiTableEnsured) return;
  await ensureAiAnalysisTable();
  aiTableEnsured = true;
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} belum diset di environment.`);
  }
  return value;
}

export function normalizeAiAnalysisMode(mode) {
  const normalized = String(mode ?? AI_ANALYSIS_MODES.INTERNAL).trim().toLowerCase();
  if (!VALID_AI_ANALYSIS_MODES.has(normalized)) {
    return null;
  }
  return normalized;
}

function buildPromptInternal({ summary, distribution, responses }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  const instructionBlock = [
    'Kamu adalah Analis Produk & Growth untuk tim dev AITI GLOBAL NEXUS.',
    "Konteks: ini data feedback setelah demo 'AI Teaching Assistant untuk otomasi pembuatan soal (C1-C6/HOTS)'.",
    'Tujuan analisis: membantu tim memutuskan 3 hal:',
    '(1) seberapa kuat niat adopsi/try dari guru & rekomendasi ke sekolah,',
    '(2) seberapa besar minat mengikuti pelatihan AI general (bahkan jika belum adopsi aplikasi),',
    '(3) apa hambatan/area perbaikan paling berdampak untuk meningkatkan adopsi & kepuasan.',
    '',
    'Aturan interpretasi data:',
    '- Skala 1-5: 1 = negatif, 5 = positif. Hitung minimal: rata-rata, %favorable (4-5), %top-box (5).',
    '- Q10 adalah kategori minat pelatihan. Urutkan dari tertinggi ke terendah:',
    '  Sangat Berminat > Berminat > Cukup Berminat > Kurang Berminat > Tidak Berminat.',
    '- Q11 anggap sebagai rekomendasi/adopsi, BUKAN kepuasan (abaikan label puas jika ada).',
    '- Abaikan nama guru (jangan tampilkan identitas).',
    '',
    'KPI yang WAJIB kamu keluarkan (pakai data yang ada):',
    'A. Adoption Intent Score = gabungan Q9 & Q11 (jelaskan formula, mis. rata-rata keduanya).',
    'B. Training Interest Rate = persentase responden Berminat/Sangat Berminat pada Q10.',
    'C. Delivery Quality Score = gabungan Q3-Q6 dan Q12.',
    'D. Perceived Value Score = gabungan Q7-Q8.',
    '',
    'Segmentasi yang WAJIB (kalau memungkinkan dari data):',
    '- per lama_mengajar (dan sebutkan N tiap segmen).',
    '- opsional: per mata_pelajaran jika N per mapel memadai (>=3); kalau kurang, jangan paksa.',
    '',
    'Output format (HARUS mengikuti ini, ringkas & to the point):',
    '1) Ringkasan eksekutif (maks 6 bullet): angka kunci + kesimpulan siap pilot/tidak + peluang pelatihan AI general.',
    '2) Scorecard KPI (tabel kecil): N, mean, %4-5, %5 untuk item penting (Q3-Q9, Q11, Q12) + distribusi Q10.',
    '3) Temuan utama:',
    '   - 3 hal yang paling kuat (nilai tertinggi) -> bahan wow untuk presentasi.',
    '   - 3 risiko/gesekan terbesar (nilai terendah atau segmen yang drop) -> prioritas perbaikan.',
    '4) Segment insight: siapa paling siap adopsi vs siapa butuh dukungan/pelatihan (berbasis lama_mengajar).',
    '5) Rekomendasi tindak lanjut (konkret):',
    '   - Aksi produk (mis. fitur/demo/UX yang perlu ditegaskan),',
    '   - Aksi go-to-market untuk sekolah (pilot, paket, materi),',
    '   - Aksi pelatihan AI general (format, topik, funnel pendaftarannya).',
    '6) Catatan keterbatasan data (contoh: tidak ada pertanyaan terbuka, N kecil, bias respon).',
  ].join('\n');

  return [
    instructionBlock,
    '',
    'Ringkasan statistik:',
    summaryBlock,
    '',
    'Distribusi & rata-rata:',
    distributionBlock,
    '',
    'Semua respons (tanpa nama):',
    responsesBlock,
  ].join('\n');
}

function buildPromptExternalPemerintah({ summary, distribution, responses }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  return [
    'Kamu adalah Analis Program & Kebijakan Pendidikan (policy analyst) yang menulis laporan resmi untuk Dinas Pendidikan/Pemerintah Daerah.',
    'Konteks: kegiatan sosialisasi/demo AI Teaching Assistant untuk otomasi pembuatan soal (C1-C6/HOTS). Data berasal dari kuesioner guru setelah kegiatan.',
    'Tujuan dokumen: menyajikan potensi program, bukti minat/adopsi, kebutuhan pelatihan, dan rekomendasi langkah implementasi skala daerah.',
    '',
    'ATURAN KERJA (WAJIB):',
    '- Jangan mengarang angka, kutip hanya dari data yang diberikan.',
    '- Jika ada informasi tidak tersedia, tulis Data tidak tersedia.',
    '- Jangan tampilkan identitas responden (nama guru dilarang).',
    '- Gunakan bahasa Indonesia formal, jelas, ringkas, dan siap ditempel ke laporan dinas.',
    '- Tampilkan angka kunci: N responden, rata-rata, %favorable (4-5), distribusi minat pelatihan.',
    '',
    'Definisi metrik:',
    '- Skala 1-5: 1 negatif, 5 positif. Laporkan mean + %4-5 + %5.',
    '- Minat pelatihan (Q10): laporkan proporsi Sangat Berminat/Berminat/Cukup/Kurang/Tidak.',
    '- Rekomendasi adopsi (Q11) diperlakukan sebagai rekomendasi/dukungan adopsi, bukan kepuasan.',
    '',
    'OUTPUT (ikuti struktur ini):',
    '1) Ringkasan Eksekutif (maks 8 bullet)',
    '   - 3 angka terkuat sebagai bukti (mis. minat pelatihan, kesiapan mencoba, rekomendasi adopsi).',
    '   - Kesimpulan singkat: potensi implementasi + kebutuhan dukungan.',
    '2) Temuan Berbasis Data',
    '   - Kualitas pelaksanaan (Q3-Q6, Q12): ringkas dengan angka.',
    '   - Persepsi manfaat (Q7-Q8): ringkas dengan angka.',
    '   - Kesiapan adopsi (Q9, Q11): ringkas dengan angka.',
    '   - Minat pelatihan (Q10): tampilkan distribusi.',
    '3) Implikasi untuk Kebijakan Daerah',
    '   - Apa manfaat praktis bagi sekolah/guru (efisiensi kerja, standarisasi kualitas soal, peningkatan kapasitas digital).',
    '   - Risiko/mitigasi (akurasi konten, kesesuaian kurikulum, etika penggunaan AI, kesiapan infrastruktur).',
    '4) Rekomendasi Tindak Lanjut (konkret, 30-90 hari)',
    '   - Rekomendasi pilot terbatas (siapa sasaran awal, bentuk pendampingan, indikator sukses).',
    '   - Rencana pelatihan AI general untuk guru (format, durasi, output yang diharapkan).',
    '   - Kebutuhan dukungan pemda/dinas (mis. regulasi internal, fasilitasi perangkat/internet, surat edaran praktik aman).',
    '5) Lampiran Angka (tabel ringkas)',
    '   - Tabel: item utama (Q3-Q9, Q11, Q12) dengan mean, %4-5, %5.',
    '   - Distribusi Q10 (minat pelatihan).',
    '6) Keterbatasan Data',
    '   - Misalnya: tidak ada pertanyaan terbuka, sampel terbatas, bias respon, dll.',
    '',
    'Data input:',
    'Ringkasan statistik:',
    summaryBlock,
    '',
    'Distribusi & rata-rata:',
    distributionBlock,
    '',
    'Semua respons (tanpa nama):',
    responsesBlock,
  ].join('\n');
}

function buildPromptExternalMitra({ summary, distribution, responses }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);
  const responsesBlock = JSON.stringify(responses, null, 2);

  return [
    'Kamu adalah Analis Bisnis & Dampak yang menulis memo ringkas untuk MITRA / SPONSOR / INVESTOR.',
    'Konteks: kegiatan demo AI Teaching Assistant untuk otomasi pembuatan soal (C1-C6/HOTS) kepada guru. Data berasal dari kuesioner guru setelah demo.',
    'Tujuan memo: menunjukkan bukti demand (traction), kesiapan adopsi/pilot, minat pelatihan AI general sebagai jalur scale/monetisasi, serta rencana 90 hari yang realistis.',
    '',
    'ATURAN WAJIB (anti-halusinasi):',
    '- Jangan mengarang angka atau klaim yang tidak ada di data.',
    '- Jika ada info tidak tersedia (mis. harga, biaya, jumlah sekolah), tulis Data tidak tersedia dan sebutkan data apa yang dibutuhkan.',
    '- Jangan tampilkan identitas responden (nama guru dilarang).',
    '- Gunakan bahasa Indonesia profesional, singkat, dan investor-ready.',
    '- Semua kesimpulan harus ditopang angka (mean, %4-5, distribusi), atau nyatakan sebagai hipotesis.',
    '',
    'Definisi metrik:',
    '- Skala 1-5: 1 negatif, 5 positif. Laporkan minimal: mean, %favorable (4-5), %top-box (5).',
    '- Q10 minat pelatihan: tampilkan distribusi kategori (Sangat Berminat, Berminat, dst.) dan hitung Training Demand Rate = % (Sangat Berminat + Berminat).',
    '- Q11 perlakukan sebagai rekomendasi/dukungan adopsi sekolah, bukan kepuasan.',
    '- Buat 3 skor komposit (jelaskan komponennya):',
    '  1) Delivery Quality Score = gabungan Q3, Q5, Q6, Q12',
    '  2) Perceived Value Score = gabungan Q4, Q7, Q8',
    '  3) Adoption Readiness Score = gabungan Q9 dan Q11',
    '  Untuk tiap skor: laporkan mean + %4-5.',
    '',
    'OUTPUT (WAJIB ikuti urutan ini, max 1 halaman + lampiran tabel):',
    '1) Header singkat:',
    '   - Judul memo',
    '   - Tanggal kegiatan (jika tersedia)',
    '   - N responden (jumlah pengisi kuesioner)',
    '2) One-paragraph pitch (maks 90 kata):',
    '   - masalah -> solusi -> bukti demand dari data -> next step (pilot + pelatihan)',
    '3) Traction Snapshot (angka kunci):',
    '   - Delivery Quality Score (mean, %4-5)',
    '   - Perceived Value Score (mean, %4-5)',
    '   - Adoption Readiness Score (mean, %4-5)',
    '   - Training Demand Rate (% Sangat Berminat+Berminat pada Q10)',
    '4) What the data suggests (3-6 bullet):',
    '   - 2-3 sinyal terkuat (yang bisa jadi value proposition)',
    '   - 1-2 sinyal risiko/gesekan (yang perlu mitigasi)',
    '5) Partnership angles (pilih sesuai data, tulis sebagai opsi):',
    '   - Opsi A: Sponsor pelatihan AI general (capacity building)',
    '   - Opsi B: Mitra pilot sekolah (implementasi terbatas + evaluasi)',
    '   - Opsi C: Paket gabungan (pilot + training + support)',
    '   Untuk tiap opsi: jelaskan manfaat mitra + output yang bisa dilaporkan (tanpa mengarang biaya).',
    '6) 90-day plan (konkret):',
    '   - Minggu 1-2: desain pilot + materi training',
    '   - Minggu 3-6: pilot + pengumpulan feedback',
    '   - Minggu 7-12: iterasi produk + perluasan training/sekolah',
    '   Sertakan indikator keberhasilan yang terukur dari survei (mis. %4-5 pada niat adopsi, kepuasan, minat training).',
    '7) Risks & mitigations (3-5 poin realistis):',
    '   - akurasi konten, kesesuaian kurikulum, etika AI, kesiapan infrastruktur, resistensi perubahan',
    '   - mitigasi: SOP validasi, panduan penggunaan, pendampingan, dsb',
    '8) Data limitations:',
    '   - contoh: sampel terbatas, tidak ada pertanyaan terbuka, tidak ada baseline, dll (sesuaikan dengan data)',
    '9) Lampiran (tabel ringkas):',
    '   - Tabel untuk Q3-Q9, Q11, Q12: mean, %4-5, %5',
    '   - Distribusi Q10 (% tiap kategori)',
    '',
    'Data input:',
    'Ringkasan statistik:',
    summaryBlock,
    '',
    'Distribusi & rata-rata:',
    distributionBlock,
    '',
    'Semua respons (tanpa nama):',
    responsesBlock,
  ].join('\n');
}

function buildPromptLiveGuru({ summary, distribution }) {
  const summaryBlock = JSON.stringify(summary, null, 2);
  const distributionBlock = JSON.stringify(distribution, null, 2);

  return [
    'Kamu adalah analis program yang menampilkan hasil kuesioner secara LIVE di depan guru dan pimpinan sekolah (Kepsek/Wakasek/Kurikulum).',
    'Tujuan: transparansi + membantu sekolah mengambil keputusan tindak lanjut (pilot/adopsi/pelatihan).',
    'Data bersifat anonim. Jangan tampilkan nama guru, mapel spesifik per orang, atau respons mentah yang bisa mengidentifikasi.',
    '',
    'Aturan:',
    '- Skala 1-5: tampilkan mean, %setuju (4-5), dan N responden.',
    '- Q10 (minat pelatihan): tampilkan distribusi persentase tiap kategori.',
    '- Q11 perlakukan sebagai rekomendasi/adopsi, bukan kepuasan (abaikan label puas jika ada).',
    '- Gunakan bahasa netral, sopan, tidak menghakimi. Hindari kata buruk/jelek; gunakan perlu ditingkatkan/perlu dukungan.',
    '- Maksimal untuk tampil layar: 1 halaman ringkasan + 1 halaman rekomendasi (atau setara 2 slide).',
    '- Jangan membuat klaim di luar data. Jika info tidak ada, tulis Data tidak tersedia.',
    '',
    'Fokus yang harus ditampilkan (decision pillars):',
    'A) Kualitas pelaksanaan kegiatan (materi, fasilitator, waktu, kepuasan umum)',
    'B) Persepsi manfaat/value (apakah membantu & relevan)',
    'C) Kesiapan/niat mencoba & rekomendasi sekolah (adopsi)',
    'D) Minat pelatihan AI general (meski belum adopsi aplikasi)',
    '',
    'Buat 3 skor ringkas (jelaskan komponennya):',
    '1) Delivery Score = gabungan Q3, Q5, Q6, Q12',
    '2) Value Score = gabungan Q4, Q7, Q8',
    '3) Adoption Readiness Score = gabungan Q9 dan Q11',
    '(Laporkan mean + %4-5 untuk masing-masing skor, pakai data yang ada)',
    '',
    'OUTPUT (HARUS mengikuti format ini):',
    '',
    'SLIDE 1 - Ringkasan Transparan (untuk layar)',
    '- Judul + tanggal/konteks singkat',
    '- N responden (berapa guru mengisi)',
    '- 5 angka kunci (mean + %4-5):',
    '  1) Materi mudah dipahami (Q3)',
    '  2) Fasilitator jelas (Q6)',
    '  3) Contoh relevan (Q4)',
    '  4) Siap mencoba implementasi (Q9)',
    '  5) Rekomendasi sekolah untuk adopsi (Q11)',
    '- Distribusi minat pelatihan (Q10) dalam % (Sangat Berminat sampai Tidak Berminat)',
    '',
    'SLIDE 2 - Apa artinya untuk keputusan sekolah?',
    '- Tampilkan 3 skor ringkas: Delivery Score, Value Score, Adoption Readiness Score (mean + %4-5)',
    '- 2 kekuatan utama (nilai tertinggi) -> yang sudah bagus',
    '- 2 area yang perlu dukungan/perbaikan (nilai terendah) -> yang perlu ditingkatkan',
    '- Rekomendasi tindak lanjut untuk sekolah (pilih 1 dari 3 jalur, berdasarkan sinyal data):',
    '  Jalur A: Pilot kecil 2-4 minggu (siapa sasaran, apa output, bagaimana evaluasi)',
    '  Jalur B: Pelatihan AI general dulu (format singkat + output yang diharapkan)',
    '  Jalur C: Kombinasi pilot + pelatihan (paling ideal)',
    '',
    'SLIDE 3 (opsional jika muat) - Komitmen tim penyelenggara',
    '- 3 komitmen konkret (mis. panduan singkat, sesi lanjutan, kanal support, perbaikan demo)',
    '- Cara sekolah memberi keputusan (mis. siapa PIC sekolah + timeline)',
    '',
    'Terakhir:',
    '- Buat script pembacaan 60-90 detik (seperti MC) untuk menyampaikan hasil di depan audiens.',
    '',
    'Data input:',
    'Ringkasan statistik:',
    summaryBlock,
    'Distribusi & rata-rata:',
    distributionBlock,
  ].join('\n');
}

function buildPromptByMode({ mode, summary, distribution, responses }) {
  if (mode === AI_ANALYSIS_MODES.EXTERNAL_PEMERINTAH) {
    return buildPromptExternalPemerintah({ summary, distribution, responses });
  }
  if (mode === AI_ANALYSIS_MODES.EXTERNAL_MITRA) {
    return buildPromptExternalMitra({ summary, distribution, responses });
  }
  if (mode === AI_ANALYSIS_MODES.LIVE_GURU) {
    return buildPromptLiveGuru({ summary, distribution });
  }
  return buildPromptInternal({ summary, distribution, responses });
}

export async function analyzeAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const normalizedMode = normalizeAiAnalysisMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  const apiKey = requireEnv('GEMINI_API_KEY');
  const model = requireEnv('GEMINI_MODEL');

  const [summary, distribution] = await Promise.all([
    getAnalyticsSummary(),
    getAnalyticsDistribution(),
  ]);

  const responses =
    normalizedMode === AI_ANALYSIS_MODES.LIVE_GURU ? [] : await getResponsesForAi();

  const prompt = buildPromptByMode({
    mode: normalizedMode,
    summary,
    distribution,
    responses,
  });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Gemini request gagal: ${resp.status} ${errorText}`);
  }

  const json = await resp.json();
  const analysis =
    json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ??
    'Tidak ada hasil analisis.';

  const result = {
    mode: normalizedMode,
    analysis,
    meta: {
      totalResponses: Number(summary?.totalResponses ?? 0),
      summary,
      distribution,
    },
  };

  await ensureAiTableOnce();
  const saved = await insertAiAnalysis({
    mode: normalizedMode,
    analysis: result.analysis,
    meta: result.meta,
  });

  return {
    ...result,
    createdAt: saved?.created_at ?? null,
  };
}

export async function getLatestAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const normalizedMode = normalizeAiAnalysisMode(mode);
  if (!normalizedMode) {
    throw new Error('Mode analisa AI tidak valid.');
  }

  await ensureAiTableOnce();
  const row = await getLatestAiAnalysis({ mode: normalizedMode });

  if (!row) return null;

  return {
    mode: row.mode ?? normalizedMode,
    analysis: row.analysis,
    meta: row.meta,
    createdAt: row.created_at,
  };
}
