# DOCS Index (Single Source of Truth)

Status: ACTIVE
As of: 2026-02-20
Status dashboard completion: D11-D15 CLOSED (lihat `docs/DEBT_REGISTER_LOCKED.md` dan `docs/DEBT_CLOSURE_REPORT.md`)

Dokumen ini adalah pintu masuk utama agar status proyek tidak membingungkan.

Mode susunan docs saat ini:
1. Dokumen aktif berada di folder `docs/`.
2. Dokumen historical/archived berada di folder `docs/_archive/`.
3. Pindah struktur folder docs hanya boleh setelah approval eksplisit owner repo.
4. Dokumen di `docs/_archive/` tidak boleh dijadikan dasar status current tanpa verifikasi ulang ke register + closure report.

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

## Dokumen Operasional (Aktif saat rilis/UAT/incident)

1. `docs/UAT_CHECKLIST_HARDENING.md`
2. `docs/CLOUDFLARE_CUTOVER_RUNBOOK.md`
3. `docs/MONITORING_72H_TEMPLATE.md`
4. `docs/INCIDENT_LOG_TEMPLATE.md`
5. `docs/PRODUCTION_CUTOVER_REPORT_2026-02-16.md`
6. `docs/MONITORING_72H_RUN_2026-02-17.md`

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
