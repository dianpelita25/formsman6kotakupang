# Dashboard Plan Readout + Modular Decision (2026-02-18)

Dokumen ini merangkum status aktual code terhadap `PLAN_DASHBOARD.md` dan keputusan urutan eksekusi yang paling aman.

## Executive Decision

Jangan langsung gas fitur dashboard baru di struktur saat ini.

Urutan yang disarankan:
1. Lakukan modularisasi fondasi dulu (terbatas, 3-5 hari, tanpa ubah behavior).
2. Setelah itu lanjut fase dashboard sesuai blueprint.

Alasan: hotspot monolitik frontend/backend sudah terlalu besar dan akan membuat fase berikutnya makin lambat, rawan bug, dan sulit direview.

## Fakta Kode Saat Ini (Verified)

1. Target route plan sudah benar di questionnaire dashboard:
- `src/worker.js:771`
- `src/worker.js:778`

2. File dashboard target sangat monolitik:
- `public/admin/questionnaire-dashboard.js` = 2976 baris
- `public/admin/questionnaire-dashboard.html` = 299 baris

3. Service questionnaire backend juga sangat gemuk:
- `src/modules/questionnaires/service.js` = 1291 baris

4. Worker router masih sangat besar:
- `src/worker.js` = 1139 baris

5. Modular checker saat ini hanya menjaga debt baru agar tidak bertambah, belum bersih total:
- `pnpm check:modularity` -> PASS (new violation = 0, waived = 17)
- `pnpm check:modularity:strict` -> FAIL (17 violation existing debt)

## Gap Terhadap Blueprint Dashboard

## Fase 0 - Hardening Fondasi

Status: belum selesai.

1. Login rate limit belum terlihat implementasinya:
- login route: `src/worker.js:247`
- login service: `src/modules/auth/service.js:52`

2. AI cooldown/dedup belum ada:
- analyze route: `src/worker.js:561`
- analyze service: `src/modules/ai/service.js:241`

3. Data quality object (`sampleSize`, `confidence`, `warnings`) belum ada di analytics summary questionnaire:
- summary builder: `src/modules/questionnaires/service.js:1142`
- tidak ada field `dataQuality` pada payload yang dikembalikan.

## Fase 1 - Segmentasi General + Drilldown

Status: parsial.

Yang sudah ada:
1. Segment summary otomatis sudah dibentuk backend:
- `src/modules/questionnaires/service.js:802`
- dipakai di summary/distribution:
  - `src/modules/questionnaires/service.js:1180`
  - `src/modules/questionnaires/service.js:1213`

Yang belum ada:
1. Metadata builder `segmentRole`, `segmentLabel`, `isSensitive` belum ada:
- schema field masih: `type,name,label,criterion,required` di `src/modules/questionnaires/schema.js:12`

2. Query filter segment global (`segmentDimensionId`, `segmentBucket`) belum terlihat masuk API query builder frontend:
- `public/admin/questionnaire-dashboard.js:641`

3. Drilldown bucket ke responses terfilter belum terlihat sebagai flow API contract baru.

## Fase 2 - Visual Analitis Utama

Status: parsial.

Yang sudah ada:
1. Advanced viz mode sudah ada (criteria/likert/weekly/period/segment) di dashboard script.

Yang belum ada:
1. Endpoint compare segmen belum ada:
- blueprint minta `.../analytics/segment-compare`
- route tersebut tidak ditemukan di `src/worker.js`.

## Fase 3 - UX Operasional Admin

Status: parsial-tinggi.

Yang sudah ada:
1. Empty/error/success state cukup jelas di layer UI:
- error/status helpers ada di `public/admin/questionnaire-dashboard.js:526` dan seterusnya.

2. Saved preference sudah ada, tapi kontraknya berbeda dari blueprint key tunggal:
- key sekarang:
  - `public/admin/questionnaire-dashboard.js:221`
  - `public/admin/questionnaire-dashboard.js:227`
- blueprint minta: `dashboard_visual_prefs_v2` (single key object).

## Fase 4 - Export + Stabilization + Cleanup

Status: parsial.

1. Export PDF yang terlihat saat ini fokus ke analisis AI report, bukan snapshot dashboard panel secara umum:
- `public/admin/questionnaire-dashboard.js:2245` ke bawah (pipeline PDF AI).

2. Jalur rollback legacy masih disediakan dan memang disengaja:
- `package.json` scripts `legacy:dev`, `legacy:start`.

## Risiko Jika Lanjut Fitur Tanpa Modularisasi Fondasi

1. Regression risk tinggi karena satu file JS 2976 baris memegang state, API, chart, AI, PDF, dan event binding sekaligus.
2. Review code lambat karena diff akan menumpuk di file yang sama.
3. Bug fixing jadi mahal karena coupling antar bagian UI dan analytics tinggi.
4. Target "modular monolith strict" tertunda terus meski checker masih hijau (karena waiver).

## Urutan Eksekusi Yang Disarankan

## Sprint M0 (Wajib dulu, 3-5 hari, no behavior change)

1. Pecah frontend `questionnaire-dashboard.js` jadi modul:
- `public/admin/questionnaire-dashboard/index.js` (bootstrap)
- `public/admin/questionnaire-dashboard/state.js`
- `public/admin/questionnaire-dashboard/api.js`
- `public/admin/questionnaire-dashboard/features/filters.js`
- `public/admin/questionnaire-dashboard/features/charts.js`
- `public/admin/questionnaire-dashboard/features/segment.js`
- `public/admin/questionnaire-dashboard/features/responses.js`
- `public/admin/questionnaire-dashboard/features/ai.js`
- `public/admin/questionnaire-dashboard/features/pdf.js`
- `public/admin/questionnaire-dashboard/features/preferences.js`

2. Pecah backend analytics questionnaire dari `questionnaires/service.js`:
- `src/modules/questionnaire-analytics/service.js`
- `src/modules/questionnaire-analytics/segment.js`
- `src/modules/questionnaire-analytics/distribution.js`
- `src/modules/questionnaire-analytics/data-quality.js`

3. Buat facade tipis di `questionnaires/service.js` agar route existing tidak berubah.

## Sprint M1 (lanjut blueprint fitur)

1. Implement contract `dataQuality` di summary endpoint.
2. Implement `segmentRole/segmentLabel/isSensitive` di schema + builder + publish validation.
3. Implement query filter `segmentDimensionId` + `segmentBucket` di summary/distribution/trend/responses.
4. Implement endpoint `segment-compare` + guard max 3 bucket.
5. Tambahkan AI cooldown/dedup.

## Definisi "Benar Modular" untuk Scope Dashboard

Scope dashboard dianggap modular jika semua ini terpenuhi:
1. Tidak ada file frontend dashboard > 500 baris.
2. Tidak ada file service backend dashboard > 400 baris.
3. Worker hanya jadi composition + routing, logic bisnis di service.
4. Query builder/filter parsing tidak duplikat lintas fitur.
5. `pnpm check:modularity` tetap PASS (new = 0) dan daftar waiver berkurang bertahap.

## Catatan Penting Ke Tim Dev

1. Ini bukan usulan big-bang rewrite.
2. Ini urutan untuk mengurangi risiko sambil tetap mengejar timeline blueprint.
3. Jika M0 dilewati, biaya perubahan fase 1-4 akan naik tajam.

