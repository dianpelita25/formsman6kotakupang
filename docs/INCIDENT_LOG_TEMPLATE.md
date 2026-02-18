# Template Incident Log (Production)

## Tujuan

Mencatat gangguan secara standar agar:

- semua orang paham apa yang terjadi,
- keputusan rollback/fix bisa dipertanggungjawabkan,
- ada bahan evaluasi untuk rilis berikutnya.

## Header Incident

- **Incident ID:** `INC-YYYYMMDD-XXX`
- **Tanggal:** `YYYY-MM-DD`
- **Jam mulai:** `HH:mm TZ`
- **Jam selesai:** `HH:mm TZ` (isi saat closed)
- **Status:** `Open / Mitigated / Closed`
- **Severity:** `SEV-1 / SEV-2 / SEV-3`
- **PIC utama:** `Nama`

## Ringkasan Singkat

- **Gejala utama:**  
  Contoh: login gagal, API 5xx naik, redirect loop.
- **Ruang dampak:**  
  Contoh: tenant tertentu / semua tenant, publik/admin.
- **Estimasi user terdampak:** `angka/perkiraan`.

## Timeline (Wajib)

| Waktu | Event | Bukti/Output | Oleh |
|---|---|---|---|
| HH:mm | Alert masuk | screenshot/log singkat | Nama |
| HH:mm | Triage awal | endpoint status, error ringkas | Nama |
| HH:mm | Mitigasi dilakukan | rollback/promote/hotfix | Nama |
| HH:mm | Verifikasi normal | smoke check hasil | Nama |

## Dampak Teknis

- **Endpoint terdampak:**  
  contoh `/forms/admin/api/login`, `/forms/:tenant/:questionnaire/api/submit`
- **Error code dominan:** `5xx / 4xx / loop`
- **Metrik terkait:**  
  - API 5xx rate: `...`
  - Login failure rate: `...`
  - Submit success rate: `...`
  - P95 latency: `...`

## Keputusan Operasional

- **Apakah rollback dijalankan?** `Ya/Tidak`
- **Alasan keputusan:**  
  mengacu trigger ketat (5 menit) atau justifikasi lain.
- **Jika rollback:**
  - Version sebelum rollback: `...`
  - Version setelah rollback/promote: `...`
  - Jam rollback: `HH:mm TZ`

## Root Cause Analysis (RCA)

- **Akar masalah sementara (initial RCA):**
- **Akar masalah final (final RCA):**
- **Komponen terlibat:**  
  `routing / auth / db / prompt / analytics / infra`

## Corrective Actions

| Action | Owner | ETA | Status |
|---|---|---|---|
| Fix jangka pendek | Nama | Tanggal/Jam | Open/Done |
| Fix permanen | Nama | Tanggal/Jam | Open/Done |
| Tambah test/monitoring | Nama | Tanggal/Jam | Open/Done |

## Closure Checklist

- [ ] Endpoint utama kembali normal
- [ ] Smoke read-only pass
- [ ] Monitoring stabil minimal 60 menit
- [ ] Stakeholder diberi update
- [ ] Postmortem dijadwalkan
