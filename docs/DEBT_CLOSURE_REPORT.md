# Debt Closure Report

Dokumen ini dipakai saat menutup debt ID pada `docs/DEBT_REGISTER_LOCKED.md`.

## Ringkasan Penutupan

- Tanggal: 2026-02-19
- Penanggung jawab: Codex
- Scope release/PR: F0 closure D01..D15
- Catatan umum: D01-D15 sudah resmi ditutup setelah gate lokal PASS, commit proof sudah masuk ke `main`, dan branch protection required checks tervalidasi.

## Daftar Debt Ditutup

| Debt ID | Status Akhir | Commit Proof | Commands Proof | Catatan Verifikasi |
| --- | --- | --- | --- | --- |
| D01 | CLOSED | `603516979203de94f637c8bb89df053004b5c297` | `pnpm check:file-budgets` PASS<br>`pnpm check:architecture` PASS<br>`GitHub Actions #13` PASS | Budget blind spot rule aktif untuk `src/lib/**`, `public/shared/dashboard-legacy/**`, dan `public/script.js` |
| D02 | CLOSED | `603516979203de94f637c8bb89df053004b5c297` | `pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`pnpm smoke:e2e:full` PASS<br>`GitHub Actions #13` PASS | Lifecycle ensure published/draft sudah tunggal dan tervalidasi smoke flow |
| D03 | CLOSED | `603516979203de94f637c8bb89df053004b5c297` | `pnpm check:duplication` PASS<br>`pnpm check:architecture` PASS<br>`GitHub Actions #13` PASS | Canonical duplication checker aktif dan policy canonical terkunci |
| D04 | CLOSED | `2c29e9c1e08e75031f4e6de9a5534c145fc952aa` | `pnpm check:duplication` PASS<br>`pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`pnpm smoke:e2e:full` PASS<br>`GitHub Actions #11` PASS | Scope predicate tunggal aktif + forbiddenPattern checker aktif |
| D05 | CLOSED | `2c29e9c1e08e75031f4e6de9a5534c145fc952aa` | `pnpm check:file-budgets` PASS<br>`pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`GitHub Actions #11` PASS | 4 target D05 sudah <=220 dengan hard exact-path budget |
| D06 | CLOSED | `603516979203de94f637c8bb89df053004b5c297` | `pnpm check:modularity` PASS<br>`pnpm check:cycles` PASS<br>`pnpm check:architecture` PASS<br>`GitHub Actions #13` PASS | Checker guardrail sudah mencakup dynamic import literal dan menolak non-literal |
| D07 | CLOSED | `b7797ab06f6cba27454c1e4868f9cf454d0d7772` | `pnpm check:file-budgets` PASS<br>`pnpm check:architecture` PASS<br>`pnpm smoke:dashboard:pdf` PASS<br>`pnpm visual:legacy-dashboard:diff` PASS<br>`pnpm visual:questionnaire-dashboard:diff` PASS<br>`pnpm smoke:admin:ui` PASS<br>`GitHub check-runs` PASS | 6 file grandfathered budget sudah dipecah + hard exact-path lock aktif |
| D08 | CLOSED | `b7797ab06f6cba27454c1e4868f9cf454d0d7772` | `pnpm check:duplication` PASS<br>`pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`GitHub check-runs` PASS | Canonical shared validation aktif, facade validation tidak lagi duplikat implementasi |
| D09 | CLOSED | `b7797ab06f6cba27454c1e4868f9cf454d0d7772` | `pnpm check:modularity` PASS<br>`pnpm check:cycles` PASS<br>`pnpm check:architecture` PASS<br>`GitHub check-runs` PASS | Checker boundary/cycle/deps sudah memproses `export ... from ...` |
| D10 | CLOSED | `5bec9c71ff9a28a6013dbf1a87ad97236f571805` | `GET /branches/main/protection` 200<br>`GET /branches/backup/wip-20260218-1746/protection` 200<br>`required_status_checks.contexts` memuat `check-architecture`, `smoke-e2e`, `smoke-dashboard-pdf`, `smoke-admin-ui`, `visual-regression-legacy-dashboard` | Branch protection rule sudah aktif di `main` dan `backup/wip-20260218-1746` |
| D11 | CLOSED | `a6a9a21491ca960f93d44abe85df037e388fa584` | `pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`GitHub check-runs` PASS | Contract lock dashboard (segment query + metadata schema optional defaults) aktif dan backward-compatible |
| D12 | CLOSED | `a6a9a21491ca960f93d44abe85df037e388fa584` | `pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`pnpm smoke:e2e:full` PASS<br>Contract probe: invalid pair => 400, compare => 200<br>`GitHub check-runs` PASS | Endpoint `segment-compare`, `dataQuality`, dan contract drilldown/filter segment aktif |
| D13 | CLOSED | `a6a9a21491ca960f93d44abe85df037e388fa584` | `pnpm check:architecture` PASS<br>`pnpm smoke:dashboard:pdf` PASS<br>`pnpm visual:questionnaire-dashboard:diff` PASS<br>`pnpm smoke:admin:ui` PASS<br>`GitHub check-runs` PASS | UX compare/drilldown segment + migrasi preferences `dashboard_visual_prefs_v2` aktif |
| D14 | CLOSED | `a6a9a21491ca960f93d44abe85df037e388fa584` | `pnpm check:architecture` PASS<br>`pnpm smoke:e2e` PASS<br>`pnpm smoke:e2e:full` PASS<br>Hardening probe: login attempt #6 => 429, AI analyze => reused=true<br>`GitHub check-runs` PASS | Hardening hybrid WAF+app fallback login throttle dan AI cooldown/dedup aktif |
| D15 | CLOSED | `6e95fbaaa25dd7b6572f9127f4e91377ebde2971` | `pnpm check:debt-register` PASS<br>`pnpm check:architecture` PASS<br>`GitHub check-runs` PASS | Closure governance D11-D14 tervalidasi dengan proof commit di base branch protected |

## Eksekusi D17-D21 (Status Terkini)

Status real-time implementasi `Blueprint Final D17-D21`:

| Debt ID | Status Saat Ini | Bukti Saat Ini | Blocker Closure |
| --- | --- | --- | --- |
| D17 | CLOSED | Proof merge commit: `63a54a30f427009099497db4f7da083b66a63c12`.<br>`pnpm check:architecture` PASS (local)<br>`pnpm smoke:e2e` PASS (local)<br>`pnpm smoke:dashboard:parity` PASS (local)<br>`pnpm smoke:dashboard:parity -- --base-url https://aiti-forms-multischool-staging.aiti.workers.dev` PASS<br>`pnpm smoke:dashboard:parity -- --base-url https://aitiglobal.link` PASS<br>`GitHub check-runs` PASS (`check-architecture`, `smoke-e2e`, `smoke-dashboard-pdf`, `smoke-admin-ui`, `visual-regression-legacy-dashboard`, `smoke-ux-mobile`) | - |
| D18 | CLOSED | Proof merge commit: `63a54a30f427009099497db4f7da083b66a63c12`.<br>`pnpm check:architecture` PASS (local)<br>`pnpm smoke:admin:ui` PASS (local)<br>`pnpm smoke:ux:mobile` PASS (local)<br>`pnpm smoke:ux:mobile -- --base-url https://aitiglobal.link` PASS<br>Manual mobile audit 390x844 lulus pada login/admin/legacy dashboard/builder | - |
| D19 | CLOSED | Proof merge commit: `63a54a30f427009099497db4f7da083b66a63c12`.<br>`pnpm check:architecture` PASS (local)<br>`pnpm smoke:e2e` PASS (local)<br>`pnpm smoke:ux:mobile` PASS (local)<br>`pnpm smoke:ux:mobile -- --base-url https://aitiglobal.link` PASS<br>Manual mobile audit `/forms/kota/feedback-utama/`: overflow residual hilang (`doc/body scrollWidth == clientWidth`) | - |
| D20 | CLOSED | Proof merge commit: `63a54a30f427009099497db4f7da083b66a63c12`.<br>`pnpm check:architecture` PASS (local)<br>`pnpm smoke:dashboard:pdf` PASS (local)<br>`pnpm visual:legacy-dashboard:diff` PASS (local)<br>`pnpm visual:questionnaire-dashboard:diff` PASS (local)<br>`pnpm smoke:admin:ui` PASS (local)<br>`pnpm smoke:ux:mobile -- --base-url https://aitiglobal.link` PASS<br>Debug wrappers hidden-by-default tervalidasi di portal/legacy dashboard/builder | - |
| D21 | CLOSED | Proof merge commit: `63a54a30f427009099497db4f7da083b66a63c12`.<br>`pnpm check:debt-register` PASS<br>`pnpm check:architecture` PASS<br>`GitHub check-runs` PASS (`check-architecture`, `smoke-e2e`, `smoke-dashboard-pdf`, `smoke-admin-ui`, `visual-regression-legacy-dashboard`, `smoke-ux-mobile`) | - |

### Snapshot Audit Live (2026-02-20, pasca patch residual UX)

Audit browser live (`https://aitiglobal.link`) menunjukkan:

1. Parity contract D17 sudah hidup:
   - `segment-compare` tidak 404
   - `summary.dataQuality` ada
   - invalid pair filter segment -> `400` konsisten
2. Overflow mobile mayoritas sudah hilang:
   - `/forms` overflow=false
   - `/forms/admin/login` overflow=false
   - `/forms/kota/admin/` overflow=false
   - `/forms/kota/admin/questionnaires/feedback-utama/dashboard/` overflow=false
3. Residual yang sebelumnya ditemukan sudah tertutup:
   - `/forms/kota/feedback-utama/` overflow residual sudah hilang (`doc/body scrollWidth == clientWidth`)
   - `/forms/sman6-kotakupang/admin/dashboard/` tombol `ai-segment` dan `btn` sudah >=44px
   - `/forms/.../builder/` tombol langkah (`.builder-step`) sudah >=44px
4. Technical detail wrapper kini hidden-by-default konsisten pada `portal`, `legacy dashboard`, dan `builder`; panel debug hanya muncul saat error.

## Bukti Gate

Catat output ringkas command berikut (dengan timestamp bila perlu):

1. `pnpm check:architecture`
2. `pnpm check:duplication`
3. `pnpm check:debt-register`
4. `pnpm smoke:e2e`
5. `pnpm smoke:dashboard:pdf` (jika scope dashboard/PDF)
6. `pnpm visual:legacy-dashboard:diff` (jika scope dashboard/PDF)
7. `pnpm visual:questionnaire-dashboard:diff` (jika scope dashboard/PDF)

Referensi CI strict:

1. Commit proof referensi closure:
   - `https://github.com/dianpelita25/formsman6kotakupang/commit/603516979203de94f637c8bb89df053004b5c297`
   - `https://github.com/dianpelita25/formsman6kotakupang/commit/2c29e9c1e08e75031f4e6de9a5534c145fc952aa`
   - `https://github.com/dianpelita25/formsman6kotakupang/commit/b7797ab06f6cba27454c1e4868f9cf454d0d7772`
   - `https://github.com/dianpelita25/formsman6kotakupang/commit/5bec9c71ff9a28a6013dbf1a87ad97236f571805`
   - `https://github.com/dianpelita25/formsman6kotakupang/commit/a6a9a21491ca960f93d44abe85df037e388fa584`
    - `https://github.com/dianpelita25/formsman6kotakupang/commit/6e95fbaaa25dd7b6572f9127f4e91377ebde2971`
    - `https://github.com/dianpelita25/formsman6kotakupang/commit/63a54a30f427009099497db4f7da083b66a63c12`
2. Bukti check-run per commit tersimpan di tab Checks pada commit proof di atas, dan diringkas per debt pada kolom `Commands Proof`.

## Residual Debt / New Findings

Jika ada temuan baru saat implementasi:

1. Buat Debt ID baru (`DXX`) di `docs/DEBT_REGISTER_LOCKED.md`.
2. Jangan ubah status debt lama ke `CLOSED` sebelum gate/proof lengkap.
3. Catat rationale dan scope debt baru di bawah ini.

| Debt ID Baru | Ringkasan | Scope | Action Selanjutnya |
| --- | --- | --- | --- |
| D16 | Post-dashboard hardening cycle | CSRF enforce, PBKDF2 migration safe rollout, analytics scaling large dataset | Jalankan sesuai `docs/BLUEPRINT_D16_POST_DASHBOARD_HARDENING.md` (micro PR, 1 Debt ID focus, no dashboard scope creep) |
| D22 | Desktop builder UX clarity | Builder desktop layout clarity, dropdown type clarity, remember-last-type behavior, dan desktop UX smoke gate | Patch selesai + deploy production sukses (`Version 8761a9c0-4136-4c05-b603-d322ebc27a4e`); status saat ini `READY_FOR_CLOSE` menunggu proof commit merge |
| D23 | Dual theme dark/light app-wide | Global theming token + light overrides + theme toggle persistence | Ditahan terpisah (OPEN) setelah D22 selesai untuk hindari scope creep |

## Verifikasi D10

1. Branch protection API untuk `main` dan `backup/wip-20260218-1746` sudah mengembalikan `200`.
2. `required_status_checks.contexts` pada kedua branch sudah memuat 5 required checks policy:
   - `check-architecture`
   - `smoke-e2e`
   - `smoke-dashboard-pdf`
   - `smoke-admin-ui`
   - `visual-regression-legacy-dashboard`
3. Gate arsitektur tetap PASS setelah penguncian rule branch protection.
