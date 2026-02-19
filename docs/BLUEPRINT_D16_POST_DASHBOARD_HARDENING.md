# Blueprint D16 Post-Dashboard Hardening (Anti-Loop, Scope Sempit)

Status: ACTIVE  
As of: 2026-02-19  
Debt ID: `D16`

## Ringkasan
Setelah dashboard completion `D11-D15` ditutup, siklus berikutnya fokus ke hardening dan scaling backend tanpa membuka ulang scope dashboard.

Fokus wajib:
1. CSRF: dari monitoring ke enforcement terukur.
2. PBKDF2: migrasi iterasi aman tanpa lockout user lama.
3. Analytics scaling: kurangi beban full-scan memory untuk dataset besar.

## Decision Lock
1. Scope dashboard completion di-freeze.
2. Delivery micro PR, satu fokus teknis per PR.
3. No waiver baru.
4. No breaking change endpoint eksternal.

## In Scope
1. `src/lib/http/request-guards.js`
2. `src/worker.js`
3. `src/lib/security/hash.js`
4. `src/modules/auth/**`
5. `src/modules/questionnaires/**`
6. Dokumen operasional terkait hardening.

## Out of Scope
1. Refactor UI dashboard besar.
2. Redesign schema besar di luar kebutuhan hardening.
3. Penggantian arsitektur runtime.

## Rencana PR (Decision-Complete)

## PR D16-1: CSRF Enforcement
1. Tambah middleware enforce untuk mutation admin API:
   - Origin/host mismatch -> block `403`.
   - Pair dengan `requireJsonMutationPayload`.
2. Pastikan endpoint non-browser/health tidak terdampak.
3. Tambah test/probe regresi:
   - same-origin mutation -> allowed.
   - cross-origin mutation -> blocked.

Acceptance:
1. `pnpm check:architecture` PASS
2. `pnpm smoke:e2e` PASS
3. `pnpm smoke:e2e:full` PASS

## PR D16-2: PBKDF2 Safe Migration
1. Tambah metadata hash per-user (`iterations`/format self-describing) tanpa lockout.
2. Verifikasi login:
   - user lama (10k) tetap bisa login.
   - setelah login sukses, rehash bertahap ke target iterasi baru.
3. Tambah guard rollback-safe untuk kompatibilitas hash lama.

Acceptance:
1. `pnpm check:architecture` PASS
2. `pnpm smoke:e2e` PASS
3. Skenario login lama dan login baru lulus.

## PR D16-3: Analytics Scaling
1. Kurangi jalur load full responses untuk summary/distribution AI path.
2. Tambah hard cap defensif + message terkontrol saat data terlalu besar.
3. Prioritaskan agregasi SQL bertahap untuk metrik berat.

Acceptance:
1. `pnpm check:architecture` PASS
2. `pnpm smoke:e2e` PASS
3. `pnpm smoke:e2e:full` PASS
4. `pnpm smoke:dashboard:pdf` PASS
5. `pnpm visual:questionnaire-dashboard:diff` PASS

## Gate Wajib per PR
1. `pnpm check:architecture`
2. `pnpm smoke:e2e`
3. `pnpm check:debt-register`

Tambahan saat menyentuh dashboard/PDF data-path:
1. `pnpm smoke:dashboard:pdf`
2. `pnpm visual:questionnaire-dashboard:diff`
3. `pnpm smoke:admin:ui`

## Aturan Anti-Loop D16
1. Satu PR satu fokus (`D16-1`, `D16-2`, `D16-3`).
2. Dilarang menambah scope dashboard completion.
3. Temuan baru di luar scope -> daftar sebagai debt ID baru, jangan dilekatkan paksa ke D16.

## Stop Condition D16
1. Semua sub-PR D16 selesai dan gate hijau.
2. Tidak ada regresi pada dashboard smoke/visual.
3. `D16` di register bisa naik ke `READY_FOR_CLOSE`, lalu `CLOSED` dengan proof commit + commands.
