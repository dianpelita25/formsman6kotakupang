# Legacy Boundary Policy (Rollback Only)

Policy ini mengunci stack legacy sebagai fallback operasional, bukan jalur pengembangan fitur baru.

## Scope Legacy

Semua code di bawah path berikut dianggap legacy:

1. `src/legacy/**`
2. script `legacy:dev` dan `legacy:start` di `package.json`
3. endpoint/API yang hanya dipakai oleh stack Express rollback

## Aturan Wajib

1. Legacy stack bersifat `ROLLBACK_ONLY`.
2. Tidak boleh menambah fitur baru di legacy, kecuali:
   - fix bug kritikal rollback path
   - patch keamanan mendesak
3. Code non-legacy dilarang import dari `src/legacy/**`.
4. Kontrak endpoint utama Cloudflare/Hono tidak boleh bergantung pada module legacy.

## Operational Policy

1. Jalankan legacy hanya saat:
   - emergency rollback
   - drill rollback terjadwal
2. Setelah incident selesai, traffic kembali ke stack utama.
3. Semua perubahan legacy wajib dicatat di incident log.

## Acceptance untuk Isolasi Legacy

1. `legacy:dev` dan `legacy:start` tetap berjalan.
2. `pnpm check:legacy-boundary` PASS.
3. `src/worker.js` tidak punya dependency ke `src/legacy/**`.
