# Blueprint Closure D07-D10 (No-Loop, One-by-One)

Dokumen ini mengunci eksekusi empat debt tersisa agar tidak lompat scope dan tidak muter tanpa akhir.

## Tujuan
1. Menuntaskan debt aktif D07-D10 sampai `CLOSED`.
2. Menutup blind spot checker dan debt baseline yang masih grandfathered.
3. Menetapkan ending yang objektif sebelum pindah ke pekerjaan lain.

## Keputusan Terkunci
1. Urutan wajib: `D09 -> D08 -> D07 -> D10`.
2. WIP limit: maksimal 1 Debt ID `IN_PROGRESS` pada saat yang sama.
3. Satu PR hanya boleh menutup satu Debt ID.
4. Tidak ada waiver baru.

## Ringkasan Scope

| Debt ID | Fokus | Risiko | Alasan Prioritas |
| --- | --- | --- | --- |
| D09 | Checker parse `export ... from ...` | Medium | Menutup loophole guardrail sebelum refactor lanjutan |
| D08 | Dedup validation 1:1 identik | Medium | Mengurangi logic drift ganda aktif |
| D07 | Enam file over-max masih lewat baseline | High | Debt ukuran file masih hidup walau gate hijau |
| D10 | Verifikasi branch protection required checks | Medium | Governance enforcement belum terbukti objektif |

## Rencana PR Detail (Decision-Complete)

## PR D09-1 — Guardrail Re-export Coverage
In scope:
1. `scripts/check-modular-boundaries.js`
2. `scripts/check-module-cycles.js`
3. `scripts/report-module-deps.js`

Implementasi:
1. Perluas parser dependency agar menangkap:
   - `export { ... } from '...'`
   - `export * from '...'`
2. Pastikan dependency hasil re-export ikut evaluasi rule boundary dan cycle.
3. Pertahankan dukungan dynamic import literal yang sudah ada.

Acceptance:
1. `pnpm check:modularity` PASS
2. `pnpm check:cycles` PASS
3. `pnpm check:architecture` PASS
4. D09 pindah ke `READY_FOR_CLOSE`.

## PR D08-1 — Canonical Validation Source
In scope:
1. `src/modules/questionnaires/validation.js`
2. `src/modules/submissions/validation.js`
3. Shared canonical baru untuk logic validasi bersama (lokasi diputuskan saat implementasi PR).

Implementasi:
1. Ekstrak logic bersama ke source canonical.
2. Kedua module consume source canonical yang sama.
3. Contract export publik existing tetap sama.

Acceptance:
1. `pnpm check:duplication` PASS
2. `pnpm check:architecture` PASS
3. `pnpm smoke:e2e` PASS
4. Tidak ada lagi file validation identik 1:1.
5. D08 pindah ke `READY_FOR_CLOSE`.

## PR D07-1 — Backend Grandfathered Budget (2 file)
In scope:
1. `src/lib/db/bootstrap/questionnaire-sync.js`
2. `src/lib/db/bootstrap/schema-ddl.js`

Implementasi:
1. Pecah jadi submodule lokal sesuai concern.
2. File utama jadi facade/orchestrator tipis.
3. Turunkan line count <= hard rule (`260`) tanpa ubah behavior.

Acceptance:
1. `pnpm check:file-budgets` PASS
2. `pnpm check:architecture` PASS
3. File target <= 260.

## PR D07-2 — Public Legacy Dashboard Budget (3 file)
In scope:
1. `public/shared/dashboard-legacy/pdf-renderer.js`
2. `public/shared/dashboard-legacy/charts.js`
3. `public/shared/dashboard-legacy/ai.js`

Implementasi:
1. Split per concern ke submodule lokal.
2. Pertahankan export contract entry file lama.
3. Pastikan behavior visual/PDF tetap identik.

Acceptance:
1. `pnpm check:file-budgets` PASS
2. `pnpm smoke:dashboard:pdf` PASS
3. `pnpm visual:legacy-dashboard:diff` PASS
4. `pnpm visual:questionnaire-dashboard:diff` PASS
5. Tiga file target <= 220.

## PR D07-3 — Public Form Legacy Script Budget (1 file)
In scope:
1. `public/script.js`

Implementasi:
1. Turunkan menjadi loader tipis + submodule.
2. Pertahankan behavior form submit public legacy.

Acceptance:
1. `pnpm check:file-budgets` PASS
2. `pnpm smoke:e2e` PASS
3. `public/script.js` <= 220.

## PR D07-4 — Baseline Cleanup for 6 Paths
In scope:
1. `scripts/file-budget-baseline.json`
2. `scripts/check-file-budgets.js` (jika perlu exact-path hard cap)

Implementasi:
1. Hapus exemption baseline untuk 6 path D07.
2. Pastikan 6 path terkunci hard-limit (tidak baseline-dependent).

Acceptance:
1. `pnpm check:file-budgets` PASS
2. `pnpm check:architecture` PASS
3. D07 pindah ke `READY_FOR_CLOSE`.

## PR D10-1 — Branch Protection Evidence
In scope:
1. Governance proof di `docs/DEBT_CLOSURE_REPORT.md` dan/atau lampiran bukti.

Implementasi:
1. Repo admin aktifkan required status checks untuk:
   - `check-architecture`
   - `smoke-e2e`
   - `smoke-dashboard-pdf`
   - `smoke-admin-ui`
   - `visual-regression-legacy-dashboard`
2. Dokumentasikan bukti (screenshot/settings export/link policy) ke closure report.

Acceptance:
1. Bukti branch protection terdokumentasi.
2. D10 pindah ke `READY_FOR_CLOSE`.

## PR F0-D07-D10 — Final Close
In scope:
1. `docs/DEBT_REGISTER_LOCKED.md`
2. `docs/DEBT_CLOSURE_REPORT.md`

Implementasi:
1. Ubah D07-D10 dari `READY_FOR_CLOSE` ke `CLOSED` jika proof lengkap.
2. Isi `Proof Commit`, `Proof Commands`, `Tanggal Tutup`.

Acceptance:
1. `pnpm check:debt-register` PASS
2. `pnpm check:architecture` PASS
3. Semua D07-D10 berstatus `CLOSED`.

## Gate Wajib Per Debt
1. Semua PR: `pnpm check:architecture`, `pnpm check:debt-register`, `pnpm smoke:e2e`
2. D07 frontend/dashboard: tambah smoke/visual/PDF suite penuh
3. D08: wajib `pnpm check:duplication`
4. D09: wajib `pnpm check:modularity` + `pnpm check:cycles`

## Rule Anti-Lompat Scope
1. Dilarang mulai D08 sebelum D09 `READY_FOR_CLOSE`.
2. Dilarang mulai D07 sebelum D08 `READY_FOR_CLOSE`.
3. Dilarang mulai D10 closure sebelum D07 `READY_FOR_CLOSE`.
4. Jika muncul temuan baru, buat Debt ID baru; jangan ubah scope D07-D10.

## Stop Condition
Siklus ini selesai hanya jika:
1. D07, D08, D09, D10 semuanya `CLOSED`.
2. `pnpm check:architecture` hijau.
3. `pnpm smoke:e2e` hijau.
4. Untuk scope dashboard, visual/PDF smoke hijau.
5. Tidak ada waiver baru.
