# Monitoring 72 Jam — Run Sheet Produksi

Dokumen ini adalah lembar operasional siap pakai untuk 72 jam pertama setelah deploy production.

## Informasi Deploy

- Tanggal/Jam deploy: `2026-02-17 16:03 UTC`
- Version ID baru (aktif): `dab6fb0d-b750-44f5-acb4-11ccf0ed9150`
- Savepoint rollback: `7605e677-223f-4327-bf08-7abe7a2e5dd1`
- PIC on duty: `________________`

## Command Rollback Cepat

```powershell
pnpm exec wrangler rollback 7605e677-223f-4327-bf08-7abe7a2e5dd1 --env production -m "rollback cepat"
```

## Trigger Rollback (Policy Ketat)

Lakukan rollback jika salah satu terjadi:

- API `5xx` beruntun lebih dari 5 menit
- login gagal massal lintas role lebih dari 5 menit
- submit gagal signifikan lintas tenant lebih dari 5 menit
- redirect/auth loop di `/forms/*`

## Checklist 15 Menit (72 Jam)

Isi 1 baris setiap 15 menit.

| Waktu | `/health` | `/health/db` | `/forms` | `/forms/admin/login` | `/forms/api/tenants/public` | Legacy Redirect | Catatan |
|---|---|---|---|---|---|---|---|
| HH:mm | 200/err | 200/err | 200/err | 200/err | 200/err | 301/err |  |
| HH:mm |  |  |  |  |  |  |  |
| HH:mm |  |  |  |  |  |  |  |
| HH:mm |  |  |  |  |  |  |  |
| HH:mm |  |  |  |  |  |  |  |

Catatan legacy redirect:

- `https://aitiglobal.link/formsman6kotakupang/index.html` harus `301` ke `/forms/sman6-kotakupang/index.html`.

## Checklist 1 Jam (Deep Check)

| Jam | Login Superadmin | `/forms/admin/api/me` | `/forms/admin/api/tenants` | Form publik tenant | Dashboard kuesioner | Keputusan |
|---|---|---|---|---|---|---|
| HH:00 | ok/gagal | 200/err | 200/err | ok/gagal | ok/gagal | lanjut/eskalasi |
| HH:00 |  |  |  |  |  |  |
| HH:00 |  |  |  |  |  |  |

## Metrik yang Wajib Dipantau

- API 5xx rate
- login failure rate
- submit success rate
- p95 latency endpoint dashboard generic
- AI timeout/failure rate

## Catatan Incident

Jika ada incident, isi juga:

- `docs/INCIDENT_LOG_TEMPLATE.md`
- waktu mulai/selesai
- route terdampak
- tindakan containment
- keputusan rollback (ya/tidak)
