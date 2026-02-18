# UAT Checklist Hardening (Cloudflare Modular Monolith)

Checklist ini fokus validasi 5 hardening utama:

1. migration parity check,
2. superadmin uniqueness,
3. DB scope routing,
4. signed session cookie,
5. race safety publish draft.

## Prasyarat

- `DATABASE_URL` sudah terisi di `.env`.
- Untuk test login/session: isi juga:
  - `SESSION_SECRET`
  - `SUPERADMIN_EMAIL`
  - `SUPERADMIN_PASSWORD`
- Worker lokal aktif:
  - `pnpm dev`

## A. Migration Safety

1. Jalankan:
   - `pnpm migrate:multi`
2. Verifikasi output mengandung:
   - `Diff rows: 0`
   - `ai_analysis rows tanpa school_id: 0`
3. Jalankan ulang:
   - `pnpm migrate:multi`
4. Pastikan hasil tetap sama (idempotent).

Expected:
- Tidak ada mismatch jumlah row.
- Script exit code `0`.

## B. Auth + Signed Session Integrity

1. Isi `.env`:
   - `SESSION_SECRET=...`
   - `SUPERADMIN_EMAIL=...`
   - `SUPERADMIN_PASSWORD=...`
2. Jalankan:
   - `pnpm seed:superadmin`
3. Login via UI:
   - `http://localhost:8787/forms/admin/login`
4. Di browser DevTools, cek cookie `forms_session`:
   - format harus `token.signature` (ada titik).
5. Tamper cookie (ubah 1 karakter signature), lalu hit:
   - `GET /forms/admin/api/me`

Expected:
- Cookie tampered ditolak (`401 Unauthorized`).
- Session lama unsigned (jika ada) tidak dipakai.

## C. Role Uniqueness (Superadmin)

1. Jalankan seed superadmin beberapa kali:
   - `pnpm seed:superadmin`
2. Cek endpoint:
   - login + `GET /forms/admin/api/me`
3. Cek role tetap normal (tidak duplikat behavior).

Expected:
- Grant superadmin berulang tidak membuat duplicate-effect.

## D. Routing Resilience (DB vs Static)

1. Saat DB normal:
   - `GET /health` -> 200
   - `GET /health/db` -> 200
2. Simulasikan DB down (pakai `DATABASE_URL` invalid di `.env`, restart dev):
   - `GET /health` -> tetap 200
   - `GET /health/db` -> 503
   - `GET /forms/admin/login` -> tetap bisa load HTML
   - `GET /forms-static/admin/login.js` -> tetap bisa load JS
   - `GET /forms/sman6-kotakupang/api/form-schema` -> error terkendali (503)

Expected:
- Static/login tidak ikut tumbang ketika DB down.
- API DB-dependent gagal terkontrol.

## E. Publish Concurrency Safety

1. Login school admin untuk satu sekolah.
2. Simpan draft valid.
3. Trigger publish hampir bersamaan (2 request paralel) ke:
   - `POST /forms/{schoolSlug}/admin/api/form/publish`
4. Cek hasil:
   - `GET /forms/{schoolSlug}/admin/api/form/draft`
   - `GET /forms/{schoolSlug}/api/form-schema`

Expected:
- Tidak muncul double published.
- Draft baru tetap tersedia.
- Public schema tetap resolve ke 1 published version yang valid.

## F. Legacy Compatibility

1. Hit:
   - `GET /formsman6kotakupang`
2. Pastikan redirect:
   - `301 -> /forms/sman6-kotakupang`

Expected:
- Redirect tetap konsisten.

## G. Dashboard Visual (School Admin)

1. Login sebagai school admin.
2. Buka:
   - `GET /forms/{schoolSlug}/admin/dashboard/`
3. Verifikasi:
   - KPI tampil
   - chart bar + doughnut + radar tampil
   - AI latest/analyze bisa dijalankan
   - tombol export CSV aktif

Expected:
- Dashboard visual tampil penuh dan tidak bocor data lintas school.

## H. Alias `/admin/*` by Environment

1. Set `APP_ENV=production` dan `ENABLE_LEGACY_ADMIN_ALIAS=false`:
   - `GET /admin/login` harus `404`.
2. Set `APP_ENV=local` dan `ENABLE_LEGACY_ADMIN_ALIAS=true`:
   - `GET /admin/login` harus redirect ke `/forms/admin/login`.

Expected:
- Alias lama aktif hanya di env yang memang diizinkan.
