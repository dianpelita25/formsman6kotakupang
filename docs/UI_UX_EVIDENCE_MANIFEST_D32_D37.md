# UI/UX Evidence Manifest D32-D37

Status: ACTIVE  
As of: 2026-02-22  
Scope: Closure evidence cycle `D32-D37` (Bahasa Indonesia UI + readability light mode)

## Tujuan

Dokumen ini menjadi registry bukti resmi untuk evidence visual/log yang disimpan lokal dan tidak di-commit ke repository.

## Kebijakan Penyimpanan Bukti

1. Folder evidence lokal:
   - `temuan-ui-ux-2026-02-22/`
   - `temuan-ui-ux-2026-02-23-after/`
2. Kedua folder di atas sengaja di-ignore di `.gitignore` untuk menghindari noise binary besar pada commit source code.
3. Semua referensi proof untuk D32-D37 harus tetap bisa ditelusuri lewat dokumen ini + `docs/DEBT_CLOSURE_REPORT.md`.

## Inventaris Bukti Lokal

### A. Screenshot baseline dan after-fix

1. Baseline temuan utama:
   - `temuan-ui-ux-2026-02-22/screenshots/11-superadmin-overview-desktop-fresh.png`
   - `temuan-ui-ux-2026-02-22/screenshots/12-superadmin-tenant-type-options-mixed-language.png`
   - `temuan-ui-ux-2026-02-22/screenshots/13-superadmin-prompt-scope-options-mixed-language.png`
   - `temuan-ui-ux-2026-02-22/screenshots/18-superadmin-mobile-fresh.png`
   - `temuan-ui-ux-2026-02-22/screenshots/08-questionnaire-dashboard.png`
2. After2 (final bersih untuk validasi manual):
   - `temuan-ui-ux-2026-02-22/screenshots/21-superadmin-overview-desktop-after2.png`
   - `temuan-ui-ux-2026-02-22/screenshots/22-tenant-admin-panel-desktop-after2.png`
   - `temuan-ui-ux-2026-02-22/screenshots/23-builder-desktop-after2.png`
   - `temuan-ui-ux-2026-02-22/screenshots/24-questionnaire-dashboard-desktop-after2.png`
   - `temuan-ui-ux-2026-02-22/screenshots/25-portal-desktop-after2.png`
   - `temuan-ui-ux-2026-02-22/screenshots/26-superadmin-mobile-after2.png`
3. Snapshot tambahan after:
   - `temuan-ui-ux-2026-02-23-after/screenshots/21-superadmin-overview-desktop-after.png`
   - `temuan-ui-ux-2026-02-23-after/screenshots/24-tenant-admin-desktop-after.png`
   - `temuan-ui-ux-2026-02-23-after/screenshots/25-questionnaire-dashboard-desktop-after.png`
   - `temuan-ui-ux-2026-02-23-after/screenshots/26-portal-mobile-after.png`
   - `temuan-ui-ux-2026-02-23-after/screenshots/27-superadmin-mobile-after.png`
   - `temuan-ui-ux-2026-02-23-after/screenshots/28-public-dashboard-mobile-after.png`

### B. Log smoke UX

1. `temuan-ui-ux-2026-02-22/log-smoke-ux-mobile.txt`
2. `temuan-ui-ux-2026-02-22/log-smoke-ux-contrast-nav.txt`
3. `temuan-ui-ux-2026-02-22/log-smoke-ux-theme.txt`

### C. Bukti Live Deploy (Production)

1. Deploy command:
   - `pnpm exec wrangler deploy src/worker.js --env production`
2. Worker version live:
   - `83f31b93-3c51-42a1-a401-dda3a8293080`
3. Live smoke:
   - `pnpm smoke:ux:language-id -- --base-url https://aitiglobal.link` -> PASS.
4. Marker verifikasi UI live:
   - `/forms/admin/` menampilkan `Admin Utama Panel Organisasi`.
   - `/forms/admin/` menampilkan `Pengelola Prompt AI`.
   - `/forms-static/shared/top-nav.js` menampilkan `Masuk Admin`, `Admin Utama`, `Keluar`.
5. Savepoint tags:
   - `savepoint-predeploy-20260222-1` -> `7a5b329`
   - `savepoint-postdeploy-20260222-1` -> `7a5b329`

## Kebijakan Savepoint Sebelum Live

1. Sebelum deploy production, wajib buat tag:
   - `savepoint-predeploy-YYYYMMDD-N`
2. Setelah deploy sukses, opsional buat:
   - `savepoint-postdeploy-YYYYMMDD-N`
3. Aturan ini dikunci di `docs/CLOUDFLARE_CUTOVER_RUNBOOK.md`.

## Re-assessment UAT Manual (Risk-Based, UI-Only Cycle)

Untuk cycle `D32-D37`, perubahan bersifat UI copy + CSS readability, tanpa perubahan backend/API/schema.

| Item UAT | Relevansi untuk D32-D37 | Risiko jika dipaksa di production | Keputusan |
| --- | --- | --- | --- |
| A Migration Safety | Tidak langsung relevan | Sedang (operasi migrasi di prod tetap sensitif) | Tidak diulang untuk D32-D37 |
| B Auth + Signed Session Integrity | Tidak langsung relevan | Rendah-Sedang | Opsional di staging/local, tidak wajib di prod |
| C Role Uniqueness (Superadmin) | Tidak relevan | Sedang (write seed ke DB) | Tidak diulang untuk D32-D37 |
| D Routing Resilience (DB down simulation) | Tidak relevan | Tinggi (uji DB-down berpotensi ganggu layanan) | Jangan di prod; hanya staging terisolasi |
| E Publish Concurrency Safety | Tidak relevan | Tinggi (write paralel pada data nyata) | Jangan di prod; hanya staging |
| F Legacy Compatibility | Sudah ada coverage otomatis + cutover evidence | Rendah | Tidak wajib rerun untuk D32-D37 |
| H Alias `/admin/*` by env | Tidak relevan | Tinggi (butuh toggle env/restart) | Jangan di prod; validasi saat perubahan env policy |
| G/I/J/K | Sudah covered proof di closure sebelumnya + gate aktif | Rendah | Tetap PASS sesuai evidence yang sudah ada |

## Trigger Kapan Manual UAT Wajib Diulang

1. Ulang A/C/D/E/H hanya jika ada perubahan backend, auth/session, publish lifecycle, routing alias, atau environment policy.
2. Ulang B jika ada perubahan mekanisme signing/verifikasi cookie session.
3. Ulang F jika ada perubahan rule redirect legacy/public routes.
4. Untuk cycle UI-only, gunakan gate otomatis + visual proof tanpa menjalankan test destruktif di production.
