# AGENTS.md

Instruksi ini berlaku untuk semua perubahan code di repo ini.

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

## Referensi
- Start here docs index (wajib dibaca dulu): `docs/DOCS_INDEX.md`
- Rule detail: `docs/MODULAR_MONOLITH_GUARDRAILS.md`
- Protocol anti-loop closure: `docs/ANTI_ENDLESS_REFACTOR_PROTOCOL.md`
- Checker: `scripts/check-modular-boundaries.js`
