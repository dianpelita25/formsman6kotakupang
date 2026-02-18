# Production Cutover Report — 2026-02-16

## Ringkasan

Cutover production untuk arsitektur v2 (tenant-generic + multi-questionnaire) berhasil dijalankan dengan mode smoke **read-only**.

## Preflight Gate

- `wrangler whoami`: account id cocok (`ee8db52d38860b0460e31473a8bbf453`).
- Secret `staging`: tersedia (`DATABASE_URL`, `GEMINI_API_KEY`, `AI_ANALYZE_KEY`, `SESSION_SECRET`).
- Secret `production`: tersedia (`DATABASE_URL`, `GEMINI_API_KEY`, `AI_ANALYZE_KEY`, `SESSION_SECRET`).
- Gate lokal:
  - `pnpm migrate:multi` ✅
  - `pnpm seed:superadmin` ✅
  - `pnpm smoke:e2e` ✅
  - `pnpm smoke:e2e:full` ✅

## Staging Verification

- Deploy staging sukses:
  - URL: `https://aiti-forms-multischool-staging.aiti.workers.dev`
  - Version: `fc20e2bd-62eb-45d6-924f-c791b54970c9`
- Read-only smoke:
  - `/health` -> `200`
  - `/health/db` -> `200`
  - `/forms` -> `200`
  - `/forms/admin/login` -> `200`
  - `/forms/api/tenants/public` -> `200`
  - `/forms/sman6-kotakupang/` -> `200`
  - `/forms/sman6-kotakupang/feedback-utama/` -> `200`
  - `/formsman6kotakupang/index.html` -> `301` ke `/forms/sman6-kotakupang/index.html`
  - `/forms/admin/api/me` tanpa login -> `401` (expected)

## Production Deploy

- Deploy production sukses:
  - Worker: `aiti-forms-multischool`
  - Routes:
    - `aitiglobal.link/forms*`
    - `aitiglobal.link/formsman6kotakupang*`
  - Version: `55064047-f4d9-4ba6-962d-2675badfae4c`

## Production Smoke (Read-Only)

- Endpoint checks:
  - `https://aitiglobal.link/forms` -> `200`
  - `https://aitiglobal.link/forms/admin/login` -> `200`
  - `https://aitiglobal.link/forms/sman6-kotakupang/` -> `200`
  - `https://aitiglobal.link/forms/sman6-kotakupang/feedback-utama/` -> `200`
  - `https://aitiglobal.link/forms/api/tenants/public` -> `200`
  - `https://aitiglobal.link/health` -> `200`
  - `https://aitiglobal.link/health/db` -> `200`
  - `https://aitiglobal.link/formsman6kotakupang/index.html` -> `301` ke `/forms/sman6-kotakupang/index.html`
- Auth checks:
  - `POST /forms/admin/api/login` -> `200`
  - `GET /forms/admin/api/me` -> `200`
  - `GET /forms/admin/api/schools` -> `200`
  - `GET /forms/admin/api/tenants` -> `200`
  - `GET /forms/admin/api/ai-prompts?mode=internal&scope=global` -> `200`

## Route Alias Production

- `/forms/admin/*` = route resmi app forms ✅
- `/admin/login` bukan route forms (mengarah ke website profil root, title: `PT AITI GLOBAL NEXUS`) ✅

## Rollback Ready

Jika trigger ketat terpenuhi (5xx/login/submit/loop > 5 menit):

1. Promote version worker sebelumnya dari dashboard Cloudflare.
2. Jika belum pulih, nonaktifkan route:
   - `aitiglobal.link/forms*`
   - `aitiglobal.link/formsman6kotakupang*`
3. Aktifkan fallback origin lama sementara.
4. Catat incident + RCA + fix + redeploy setelah verifikasi staging ulang.
