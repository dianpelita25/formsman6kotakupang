# UAT Final Release Report (D27 Final Lock Refresh)

Status: ACTIVE  
Tanggal: 2026-02-20  
Referensi checklist: `docs/UAT_CHECKLIST_HARDENING.md`  
Policy status manual: `PASS | NOT RUN (strict evidence)`

## Ringkasan
Refresh UAT final release ini dijalankan pasca closure `D24-D27` di `main` untuk mengunci governance rilis pada baseline terbaru.

Hasil:
1. Report UAT final aktif dikunci ke dokumen ini (`2026-02-20`) sebagai source of truth.
2. Debt `D01-D27` berstatus `CLOSED` by proof di register locked.
3. Gate arsitektur/checker utama tervalidasi PASS pada baseline saat ini.
4. Item checklist manual hanya diberi status `PASS` jika ada bukti eksplisit; selain itu `NOT RUN`.

## Bukti Command Otomatis

1. `pnpm check:architecture` -> PASS (local)
2. `pnpm check:debt-register` -> PASS (local)
3. `pnpm check:modularity` -> PASS (local)
4. `pnpm smoke:ux:contrast-nav` -> PASS (local + live proof pada closure D27)
5. `pnpm smoke:ux:mobile -- --base-url https://aitiglobal.link` -> PASS (live proof pada closure D27)
6. `pnpm smoke:dashboard:parity -- --base-url https://aitiglobal.link` -> PASS (live proof pada closure D27)
7. `pnpm deploy:production` -> SUCCESS (Worker Version `24d2e0d6-e6d4-405e-bc02-cd98e0f4a37f`, closure D27)

## Mapping Checklist UAT (A-K)

| Item | Status | Owner | Tanggal Verifikasi | Evidence |
| --- | --- | --- | --- | --- |
| A. Migration Safety | NOT RUN | Platform Ops | 2026-02-20 | Belum ada bukti eksekusi manual `pnpm migrate:multi` ulang di environment target. |
| B. Auth + Signed Session Integrity | NOT RUN | QA Lead | 2026-02-20 | Belum ada bukti manual tamper cookie via browser devtools di environment target. |
| C. Role Uniqueness (Superadmin) | NOT RUN | Platform Ops | 2026-02-20 | Belum ada bukti manual repeated `pnpm seed:superadmin` di environment target. |
| D. Routing Resilience (DB vs Static) | NOT RUN | Platform Ops | 2026-02-20 | Belum ada bukti simulasi DB-down sesuai checklist. |
| E. Publish Concurrency Safety | NOT RUN | QA Lead | 2026-02-20 | Belum ada bukti dua request publish paralel pada flow operator nyata. |
| F. Legacy Compatibility | NOT RUN | Platform Ops | 2026-02-20 | Belum ada bukti manual verifikasi redirect `/formsman6kotakupang` di target run. |
| G. Dashboard Visual (School Admin) | PASS | QA Lead | 2026-02-20 | `pnpm smoke:dashboard:pdf` PASS, `pnpm visual:legacy-dashboard:diff` PASS, `pnpm visual:questionnaire-dashboard:diff` PASS. |
| H. Alias `/admin/*` by Environment | NOT RUN | Release Manager | 2026-02-20 | Belum ada bukti manual toggle env `APP_ENV` + `ENABLE_LEGACY_ADMIN_ALIAS` pada target run. |
| I. Login Throttle Fallback (App Layer) | PASS | Security QA | 2026-02-20 | Hardening proof closure D14/D27: login gagal berulang menghasilkan `429` + `retryAfterSeconds`. |
| J. AI Cooldown + Dedup | PASS | AI QA | 2026-02-20 | Hardening proof closure D14: request analyze identik dalam cooldown menghasilkan `reused=true`. |
| K. Tenant Dashboard Completion Contract | PASS | Dashboard QA | 2026-02-20 | Proof closure D17: parity contract summary/distribution/trend/segment-compare PASS (local + staging + live). |

## Keputusan Release

1. Baseline release pasca D27 dikunci dengan report UAT final aktif tunggal `2026-02-20`.
2. Scope dashboard tetap freeze; tidak ada refactor/fokus baru tanpa Debt ID baru.
3. Eksekusi berikutnya lanjut urutan blueprint anti-loop: `D28-2 -> D28-3 -> D29`.

## Open Manual Actions (Status `NOT RUN`)

1. Jalankan A (Migration Safety) di environment target dan lampirkan output `Diff rows: 0`.
2. Jalankan B (signed session tamper) dan simpan bukti `401 Unauthorized`.
3. Jalankan C (repeated superadmin seed) dan bukti tidak ada duplicate-effect.
4. Jalankan D (DB-down routing resilience) sesuai checklist endpoint.
5. Jalankan E (publish concurrency safety) dengan dua request paralel.
6. Jalankan F (legacy redirect compatibility) untuk `301` ke slug canonical.
7. Jalankan H (alias `/admin/*` by env) pada mode production/local.

## Catatan Risk-Based Pasca D32-D37 (UI-Only Cycle)

1. Cycle `D32-D37` hanya mengubah UI copy + CSS readability, tanpa perubahan backend/API/schema.
2. Karena itu, item manual berisiko tinggi (`D`, `E`, `H`) tidak perlu dijalankan ulang di production untuk cycle UI-only.
3. Item manual write-sensitive (`A`, `C`) juga tidak dijalankan ulang di production untuk cycle UI-only.
4. Validasi bukti UI terbaru dicatat di `docs/UI_UX_EVIDENCE_MANIFEST_D32_D37.md`.
5. Manual UAT A-H tetap wajib dijalankan kembali jika ada perubahan backend/runtime/auth/routing pada cycle berikutnya.
