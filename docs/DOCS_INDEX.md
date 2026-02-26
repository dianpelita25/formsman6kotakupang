# DOCS Index (Single Source of Truth)

Status: ACTIVE
As of: 2026-02-26
Status dashboard completion: D11-D50 CLOSED (lihat `docs/DEBT_REGISTER_LOCKED.md` dan `docs/DEBT_CLOSURE_REPORT.md`)

Dokumen ini adalah pintu masuk utama agar status proyek tidak membingungkan.

Mode susunan docs saat ini:
1. Dokumen aktif berada di folder `docs/`.
2. Dokumen historical/archived berada di folder `docs/_archive/`.
3. Khusus keluarga `UAT_FINAL_RELEASE_REPORT_YYYY-MM-DD.md`, snapshot historis boleh tetap di `docs/` jika diberi marker `ARCHIVED` + `Superseded by`.
4. Pindah struktur folder docs hanya boleh setelah approval eksplisit owner repo.
5. Dokumen di `docs/_archive/` tidak boleh dijadikan dasar status current tanpa verifikasi ulang ke register + closure report.
6. Jika ada file operasional duplikat di root repo (contoh `UAT_CHECKLIST_HARDENING.md`), versi canonical tetap yang berada di `docs/`.

## Dokumen Aktif (Wajib Acuan)

1. `docs/DEBT_REGISTER_LOCKED.md`  
   Status resmi debt (OPEN/IN_PROGRESS/READY_FOR_CLOSE/CLOSED).
2. `docs/DEBT_CLOSURE_REPORT.md`  
   Bukti penutupan debt by gate + proof.
3. `docs/MODULAR_MONOLITH_GUARDRAILS.md`  
   Rule arsitektur modular monolith dan checker wajib.
4. `docs/ANTI_ENDLESS_REFACTOR_PROTOCOL.md`  
   Protokol anti-loop agar tidak closure by claim.
5. `docs/ARCHITECTURE_MODULE_OWNERSHIP.md`  
   Ownership module/table/API/UI.
6. `docs/LEGACY_BOUNDARY.md`  
   Policy rollback-only untuk stack legacy.
7. `docs/BLUEPRINT_D16_POST_DASHBOARD_HARDENING.md`  
   Blueprint siklus berikutnya (post-dashboard) dengan scope sempit anti-loop.
8. `docs/PUBLIC_DASHBOARD_CONTRACT_D30.md`  
   Contract lock dashboard publik read-only + privacy threshold (`minSampleSize=10`, `minBucketSize=10`).
9. `docs/UI_UX_LANGUAGE_READABILITY_CONTRACT_D32.md`  
   Contract lock Bahasa Indonesia UI + readability light mode (WCAG AA) untuk cycle D32-D37.
10. `docs/UI_UX_EVIDENCE_MANIFEST_D32_D37.md`  
   Registry bukti screenshot/log lokal untuk closure D32-D37 (folder evidence di-ignore dari git).
11. D38-D41 closure source:
   - `docs/DEBT_REGISTER_LOCKED.md` (row D38-D41)
   - `docs/DEBT_CLOSURE_REPORT.md` (section Update D38-D41, deploy + smoke proof)

## Dokumen Operasional (Aktif saat rilis/UAT/incident)

1. `docs/UAT_CHECKLIST_HARDENING.md`
2. `docs/CLOUDFLARE_CUTOVER_RUNBOOK.md`
3. `docs/MONITORING_72H_TEMPLATE.md`
4. `docs/INCIDENT_LOG_TEMPLATE.md`
5. `docs/PRODUCTION_CUTOVER_REPORT_2026-02-16.md`
6. `docs/MONITORING_72H_RUN_2026-02-17.md`
7. `docs/UAT_FINAL_RELEASE_REPORT_2026-02-20.md` (ACTIVE)
8. `docs/UAT_FINAL_RELEASE_REPORT_2026-02-19.md` (ARCHIVED snapshot, in place)
9. `docs/UI_UX_EVIDENCE_MANIFEST_D32_D37.md` (ACTIVE)
10. Root helper pointer: `UAT_CHECKLIST_HARDENING.md` (non-canonical helper; isi operasional canonical tetap di `docs/UAT_CHECKLIST_HARDENING.md`)

## Dokumen Referensi Historis (Jangan jadi status final)

1. `docs/_archive/CODE_REVIEW_V3_VALIDATION_BY_CODEX_2026-02-18.md`
2. `docs/_archive/DASHBOARD_PLAN_READOUT_AND_MODULAR_DECISION_2026-02-18.md`
3. `docs/_archive/BLUEPRINT_D07_D10_CLOSURE.md`
4. `docs/_archive/CODE_REVIEW_V2_MODULAR_AUDIT.md`
5. `docs/_archive/CODE_REVIEW_ANALYSIS.md`
6. `docs/_archive/CODE_REVIEW_V3_FINAL_COMPREHENSIVE.md`
7. `docs/_archive/CODE_REVIEW_ANALYSIS.pdf`
8. `docs/_archive/CODE_REVIEW_V3_FINAL_COMPREHENSIVE.pdf`
9. `docs/_archive/README.md`

## Rule Baca Dokumen

1. Mulai dari dokumen aktif di atas, jangan langsung dari dokumen historis.
2. Keputusan terbaru selalu diverifikasi lewat:
   - `DEBT_REGISTER_LOCKED`
   - `DEBT_CLOSURE_REPORT`
   - hasil gate checker/CI
3. Jangan menutup debt berdasarkan narasi dokumen lama; wajib berdasarkan gate lulus + proof commit.
4. Untuk keluarga dokumen `UAT_FINAL_RELEASE_REPORT_*`, hanya boleh ada satu dokumen berstatus `ACTIVE` pada satu waktu.

## Runtime Snapshot (Current Baseline)

1. Worker production route aktif:
   - `aitiglobal.link/robots.txt`
   - `aitiglobal.link/sitemap.xml`
   - `aitiglobal.link/forms*`
   - `aitiglobal.link/formsman6kotakupang*`
2. SEO defensive baseline aktif:
   - robots/sitemap tersedia di root dan `/forms/` path.
   - halaman admin + public dashboard bertanda noindex (header/meta).
3. Quality gate D41 aktif di pipeline:
   - `smoke:seo:baseline`
   - `smoke:lighthouse:forms`
   - `smoke:ux:css-payload`
