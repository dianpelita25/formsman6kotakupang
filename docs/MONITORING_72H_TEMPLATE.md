# Template Monitoring 72 Jam (Post-Deploy Production)

## Tujuan

Template ini dipakai untuk pengawasan 72 jam pertama setelah deploy production supaya:

- masalah cepat ketahuan (maksimal 15 menit),
- keputusan rollback tidak pakai feeling,
- semua kejadian tercatat rapi.

## Cara Pakai (Singkat)

1. Monitoring dilakukan setiap **15 menit**.
2. Isi tabel check rutin di bawah.
3. Jika ada indikator merah, buat catatan di `docs/INCIDENT_LOG_TEMPLATE.md`.
4. Jika trigger rollback terpenuhi, jalankan prosedur rollback.

## Status Deploy

- **Tanggal/Jam mulai monitoring:** `YYYY-MM-DD HH:mm TZ`
- **Version ID production:** `...`
- **PIC on duty:** `Nama`

## Rule Warna

- **Hijau:** normal (2xx/3xx expected)
- **Kuning:** ada warning tapi layanan utama masih jalan
- **Merah:** layanan utama terdampak (ikuti trigger rollback)

## Trigger Rollback (Policy Ketat)

Rollback cepat jika salah satu terjadi:

- API `5xx` beruntun > **5 menit**
- login failure rate naik tajam lintas role > **5 menit**
- submit gagal signifikan lintas tenant > **5 menit**
- redirect loop/auth loop muncul di `/forms/*`

## Checklist 15 Menit (Rutin)

Isi satu baris setiap 15 menit.

| Waktu | `/health` | `/health/db` | `/forms` | `/forms/admin/login` | `/forms/api/tenants/public` | Legacy Redirect | Catatan |
|---|---|---|---|---|---|---|---|
| HH:mm | 200/err | 200/err | 200/err | 200/err | 200/err | 301/err | ringkas |
| HH:mm |  |  |  |  |  |  |  |
| HH:mm |  |  |  |  |  |  |  |
| HH:mm |  |  |  |  |  |  |  |

Legacy Redirect check:

- `https://aitiglobal.link/formsman6kotakupang/index.html` harus `301` ke `/forms/sman6-kotakupang/index.html`.

## Checklist 1 Jam (Deep Check)

Lakukan setiap 1 jam:

| Jam | Login Superadmin | `GET /forms/admin/api/me` | `GET /forms/admin/api/tenants` | Public Form Tenant | Dashboard Admin | Keputusan |
|---|---|---|---|---|---|---|
| HH:00 | ok/gagal | 200/err | 200/err | ok/gagal | ok/gagal | lanjut/eskalasi |
| HH:00 |  |  |  |  |  |  |
| HH:00 |  |  |  |  |  |  |

## Ringkasan per Shift (8 Jam)

| Shift | Rentang Waktu | Total Check | Alert Kuning | Alert Merah | Action |
|---|---|---:|---:|---:|---|
| Shift 1 | 00:00-08:00 |  |  |  |  |
| Shift 2 | 08:00-16:00 |  |  |  |  |
| Shift 3 | 16:00-24:00 |  |  |  |  |

## Catatan Operasional

- Route forms resmi: `/forms/*`
- Admin resmi: `/forms/admin/*`
- `/admin/*` bukan jalur app forms production
- Jika incident: buat log detail di `docs/INCIDENT_LOG_TEMPLATE.md`
