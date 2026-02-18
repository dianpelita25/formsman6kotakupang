# Cloudflare Cutover Runbook (AITI Forms Modular Monolith)

## Tujuan

Memindahkan runtime form multi-sekolah dari lokal/staging ke Cloudflare secara aman tanpa mengganggu website profil utama `aitiglobal.link`.

## Prinsip

- Route resmi: `/forms/*`
- Legacy redirect tetap hidup: `/formsman6kotakupang*` -> `/forms/sman6-kotakupang*`
- Alias `/admin/*` **tidak digunakan di production**
- Staging wajib lulus sebelum production

## Prasyarat

- Zone `aitiglobal.link` sudah di Cloudflare
- Worker deploy permission tersedia
- Neon + Gemini key aktif
- Semua secret lama sudah di-rotate

## 1) Secret Rotation (Wajib, sebelum staging deploy)

Rotate:

- `DATABASE_URL` (ganti password/credential Neon)
- `GEMINI_API_KEY`
- `AI_ANALYZE_KEY`
- `SESSION_SECRET`

Set di Cloudflare:

```bash
pnpm exec wrangler secret put DATABASE_URL --env staging
pnpm exec wrangler secret put GEMINI_API_KEY --env staging
pnpm exec wrangler secret put AI_ANALYZE_KEY --env staging
pnpm exec wrangler secret put SESSION_SECRET --env staging
```

Ulangi untuk production:

```bash
pnpm exec wrangler secret put DATABASE_URL --env production
pnpm exec wrangler secret put GEMINI_API_KEY --env production
pnpm exec wrangler secret put AI_ANALYZE_KEY --env production
pnpm exec wrangler secret put SESSION_SECRET --env production
```

## 2) Deploy Staging

```bash
pnpm deploy:staging
```

Validasi minimum:

- `/health` -> 200
- `/health/db` -> 200
- `/forms/admin/login` bisa diakses
- login superadmin berhasil
- buat sekolah + school admin berhasil
- `/forms/{slug}/` bisa submit
- `/forms/{slug}/admin/dashboard/` chart + AI tampil
- tenant isolation: admin sekolah A tidak bisa akses sekolah B

## 3) Konfigurasi Routes Production (Cloudflare Dashboard)

Tambahkan route ke Worker:

- `aitiglobal.link/forms*`
- `aitiglobal.link/formsman6kotakupang*`

Jangan tambahkan:

- `aitiglobal.link/*` (root)
- `aitiglobal.link/admin*`

## 4) Deploy Production

```bash
pnpm deploy:production
```

## 5) Smoke Test Production (Wajib)

1. `GET /forms/sman6-kotakupang/` -> 200  
2. `GET /forms/admin/login` -> 200  
3. `GET /forms/sman6-kotakupang/admin/dashboard/` -> 200 (setelah login)  
4. `GET /formsman6kotakupang/index.html` -> 301 ke `/forms/sman6-kotakupang/...`  
5. `GET /admin/login` -> tidak aktif (bukan route resmi production)  
6. submit form -> tersimpan dengan `school_id` sesuai tenant  

## 6) Monitoring 72 Jam

Pantau:

- API error rate
- submit success rate
- login failure rate
- latency p95
- error DB readiness (`/health/db`)

Trigger rollback cepat (policy ketat):

- API 5xx beruntun > 5 menit
- Login failure rate naik tajam lintas role > 5 menit
- Submit gagal signifikan lintas tenant > 5 menit
- Redirect loop/auth loop muncul di `/forms/*`

## 7) Rollback Cepat

Jika incident kritis:

1. Catat `Current Version ID` yang gagal (dari output deploy atau dashboard Worker versions)
2. Promote version Worker sebelumnya (opsi utama rollback cepat)
3. Jika belum pulih, disable route `aitiglobal.link/forms*` dan `aitiglobal.link/formsman6kotakupang*`
4. Arahkan sementara trafik forms ke origin fallback lama
5. Catat incident + root cause + fix
6. Redeploy setelah verifikasi staging ulang

Catatan data:

- Rollback data biasanya tidak diperlukan karena migrasi bersifat additive/idempotent.
