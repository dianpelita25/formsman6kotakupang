export const CORE_FORM_META = Object.freeze({
  title: 'Feedback Kegiatan Sosialisasi AI Teaching Assistant untuk Otomasi Soal HOTS',
  greetingTitle: 'Salam Hormat,',
  greetingText:
    'Mohon berikan umpan balik Anda mengenai kegiatan ini. Jawaban Anda akan digunakan untuk evaluasi dan peningkatan kegiatan serupa di masa mendatang. Terima Kasih Guruku.',
});

export const CORE_FIELDS = Object.freeze([
  {
    type: 'text',
    name: 'namaGuru',
    label: 'Nama Guru',
    required: true,
  },
  {
    type: 'radio',
    name: 'lamaMengajar',
    label: 'Lama Mengajar',
    required: true,
    options: ['< 5 Tahun', '5-10 tahun', '> 10 Tahun'],
  },
  {
    type: 'text',
    name: 'mataPelajaran',
    label: 'Mata Pelajaran Yang Diampu',
    required: true,
  },
  {
    type: 'scale',
    name: 'q1',
    label:
      '1. Sebelum mengikuti kegiatan ini, seberapa sering Anda menggunakan teknologi digital dalam proses pembelajaran?',
    required: true,
    fromLabel: 'Tidak Pernah',
    toLabel: 'Sangat Sering',
  },
  {
    type: 'scale',
    name: 'q2',
    label: '2. Sejauh mana Anda memahami konsep Higher Order Thinking Skills (HOTS) sebelum kegiatan ini?',
    required: true,
    fromLabel: 'Tidak Memahami',
    toLabel: 'Sangat Memahami',
  },
  {
    type: 'scale',
    name: 'q3',
    label: '3. Materi yang disampaikan dalam kegiatan mudah dipahami.',
    required: true,
    fromLabel: 'Sangat Tidak Setuju',
    toLabel: 'Sangat Setuju',
  },
  {
    type: 'scale',
    name: 'q4',
    label:
      '4. Contoh penggunaan AI Teaching Assistant dalam kegiatan sesuai dengan kebutuhan pembelajaran.',
    required: true,
    fromLabel: 'Sangat Tidak Sesuai',
    toLabel: 'Sangat Sesuai',
  },
  {
    type: 'scale',
    name: 'q5',
    label: '5. Waktu pelaksanaan kegiatan sudah sesuai dengan jadwal yang diinformasikan.',
    required: true,
    fromLabel: 'Sangat Tidak Sesuai',
    toLabel: 'Sangat Sesuai',
  },
  {
    type: 'scale',
    name: 'q6',
    label: '6. Fasilitator atau narasumber menyampaikan materi dengan jelas dan sistematis.',
    required: true,
    fromLabel: 'Sangat Tidak Setuju',
    toLabel: 'Sangat Setuju',
  },
  {
    type: 'scale',
    name: 'q7',
    label: '7. AI Teaching Assistant berpotensi membantu dalam pembuatan soal HOTS secara otomatis.',
    required: true,
    fromLabel: 'Sangat Tidak Setuju',
    toLabel: 'Sangat Setuju',
  },
  {
    type: 'scale',
    name: 'q8',
    label: '8. Saya merasa terbantu dengan adanya fitur AI Teaching Assistant untuk pengembangan soal HOTS.',
    required: true,
    fromLabel: 'Sangat Tidak Terbantu',
    toLabel: 'Sangat Terbantu',
  },
  {
    type: 'scale',
    name: 'q9',
    label: '9. Saya siap mencoba mengimplementasikan AI Teaching Assistant dalam pembuatan soal HOTS di kelas.',
    required: true,
    fromLabel: 'Sangat Tidak Siap',
    toLabel: 'Sangat Siap',
  },
  {
    type: 'radio',
    name: 'q10',
    label:
      '10. Saya berminat mengikuti pelatihan lanjutan mengenai penggunaan AI Teaching Assistant untuk pembelajaran.',
    required: true,
    options: ['Sangat Berminat', 'Berminat', 'Cukup Berminat', 'Kurang Berminat', 'Tidak Berminat'],
  },
  {
    type: 'scale',
    name: 'q11',
    label: '11. Saya menyarankan sekolah untuk mengadopsi AI Teaching Assistant untuk pembelajaran.',
    required: true,
    fromLabel: 'Sangat Tidak Puas',
    toLabel: 'Sangat Puas',
  },
  {
    type: 'scale',
    name: 'q12',
    label: '12. Secara umum, saya puas dengan pelaksanaan kegiatan sosialisasi ini.',
    required: true,
    fromLabel: 'Sangat Tidak Puas',
    toLabel: 'Sangat Puas',
  },
]);

export const CORE_FIELD_NAMES = Object.freeze(CORE_FIELDS.map((field) => field.name));
export const CORE_QUESTION_KEYS = Object.freeze(
  CORE_FIELDS.filter((field) => /^q\d+$/.test(field.name)).map((field) => field.name)
);

export function getDefaultCoreSchema() {
  return structuredClone(CORE_FIELDS);
}

export function getDefaultMeta() {
  return structuredClone(CORE_FORM_META);
}

export function getDefaultDraft() {
  return {
    meta: getDefaultMeta(),
    coreFields: getDefaultCoreSchema(),
    extraFields: [],
  };
}
