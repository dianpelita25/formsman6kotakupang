# AGENTS.md

Instruksi ini berlaku untuk semua perubahan code di repo ini.

## Snapshot Status Terkini (Wajib Asumsi Default)
- As of: 2026-02-23
- Baseline branch: `main`
- Debt closure current: D11-D41 CLOSED by proof.
- Jalur runtime utama: Cloudflare Worker + Hono + modular route registration.
- Jangan pakai asumsi pre-D41 kecuali ada bukti dari docs aktif.

## Urutan Baca Agar Tidak Loop
1. `docs/DOCS_INDEX.md`
2. `docs/DEBT_REGISTER_LOCKED.md`
3. `docs/DEBT_CLOSURE_REPORT.md`
4. `docs/MODULAR_MONOLITH_GUARDRAILS.md`
5. `docs/ANTI_ENDLESS_REFACTOR_PROTOCOL.md`

Catatan checklist UAT:
- Canonical checklist: `docs/UAT_CHECKLIST_HARDENING.md`
- File root `UAT_CHECKLIST_HARDENING.md` adalah pointer/sinkronisasi agar editor mudah akses.

## Tujuan Arsitektur
- Arah final: modular monolith yang strict.
- Jangan menambah technical debt boundary antar module.

## Wajib Sebelum Selesai Mengubah Code
1. Jalankan:
```bash
pnpm check:modularity
```
2. Jika checker gagal karena violation baru, perbaiki dulu.
3. Jangan update waiver tanpa persetujuan review arsitektur.

## Larangan Utama
1. Service import framework HTTP (`hono/*`).
2. Service import `lib/db/bootstrap.js`.
3. Service import repository module lain.
4. Service akses DB client langsung.
5. Service menjalankan SQL write langsung.
6. Repository import selain `lib/db/sql.js` atau file lokal.

## Catatan Waiver
- File waiver: `scripts/modularity-waivers.json`.
- Waiver hanya untuk debt lama.
- Menambah waiver baru harus dijelaskan dan disetujui reviewer arsitektur.

## Guardrail Dokumen
1. Dilarang memindahkan atau menghapus file di `docs/` tanpa approval eksplisit owner repo.
2. Penandaan status dokumen `aktif` vs `historical/archived` harus dilakukan dulu di `docs/DOCS_INDEX.md`.
3. Perubahan struktur folder docs wajib dipisah dalam PR docs-only.
4. Jika ada lebih dari satu copy dokumen operasional (mis. root vs `docs/`), tentukan satu canonical source dan tulis jelas di file non-canonical.
5. Jangan klaim status `live` tanpa bukti deploy + smoke external yang tercatat di `docs/DEBT_CLOSURE_REPORT.md`.

## Referensi
- Start here docs index (wajib dibaca dulu): `docs/DOCS_INDEX.md`
- Rule detail: `docs/MODULAR_MONOLITH_GUARDRAILS.md`
- Protocol anti-loop closure: `docs/ANTI_ENDLESS_REFACTOR_PROTOCOL.md`
- Checker: `scripts/check-modular-boundaries.js`

## Minimal Verifikasi Penutup
- Untuk code change:
  - `pnpm check:modularity`
- Untuk governance/closure docs:
  - `pnpm check:debt-register`
- Untuk perubahan routing/SEO:
  - `pnpm smoke:seo:baseline`
