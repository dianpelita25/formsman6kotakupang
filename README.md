# AITI Forms Multi-Sekolah (Cloudflare Worker + Hono)

Modular monolith untuk form feedback multi-sekolah di path:

- `https://aitiglobal.link/forms/{schoolSlug}`

Dengan fitur:

- Multi-tenant school (`schools`)
- Tenant generic (`tenants`) dengan `tenant_type`
- Forms portal terpadu (`/forms`)
- Form builder per sekolah (`draft -> publish`)
- Multi-questionnaire per tenant (`/forms/{tenantSlug}/{questionnaireSlug}`)
- Responses + analytics core (`q1..q12`)
- AI analysis per sekolah
- Prompt AI editable via superadmin + tenant admin (`global + tenant + questionnaire override`, `draft -> publish`)
- Auth login user+role (`superadmin`, `school_admin`)
- Session cookie ditandatangani HMAC (`SESSION_SECRET`)
- Dashboard visual school admin (`/forms/:schoolSlug/admin/dashboard/`)

## Stack

- Cloudflare Worker + Hono (`src/worker.js`)
- Neon PostgreSQL
- Static assets dari `public/` via Workers assets binding

## 1) Setup

```bash
pnpm install
copy .env.example .env
```

Isi `.env` minimal:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
AI_ANALYZE_KEY=replace-this-analyze-key
APP_ENV=local
DB_BOOTSTRAP_MODE=full
ENABLE_LEGACY_ADMIN_ALIAS=true
SESSION_SECRET=replace-this-secret
SUPERADMIN_EMAIL=admin@aiti.local
SUPERADMIN_PASSWORD=supersecret123
```

Keterangan env:

- `APP_ENV`: `local | staging | production`
- `DB_BOOTSTRAP_MODE`: `full | check` (disarankan `full` untuk lokal/script migrasi, `check` untuk staging/production agar tidak kena limit subrequest Cloudflare)
- `ENABLE_LEGACY_ADMIN_ALIAS`: aktif/nonaktif alias `/admin/*` (default production = `false`)

## 2) Migrasi dan seed akun awal

```bash
pnpm migrate:multi
pnpm seed:superadmin
```

`pnpm migrate:multi` akan:

- membuat schema multi-tenant,
- membuat sekolah legacy `sman6-kotakupang`,
- memigrasikan data dari tabel legacy `form_responses` ke `responses`.

## 3) Jalankan lokal

```bash
pnpm dev
```

Smoke test cepat (tanpa write data):

```bash
pnpm smoke:e2e
```

Smoke test full (termasuk save/publish prompt):

```bash
pnpm smoke:e2e:full
```

Default local Worker:

- `http://localhost:8787/forms`
- `http://localhost:8787/forms/admin/login`
- `http://localhost:8787/forms/admin/`
- `http://localhost:8787/forms/admin/select-school`
- `http://localhost:8787/forms/sman6-kotakupang/`
- `http://localhost:8787/forms/sman6-kotakupang/feedback-utama/`
- `http://localhost:8787/forms/sman6-kotakupang/admin/dashboard/`

## 4) Deploy (staging -> production)

```bash
pnpm deploy:staging
pnpm deploy:production
```

Sebelum staging deploy, rotate lalu set secrets Cloudflare:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `AI_ANALYZE_KEY`
- `GEMINI_MODEL`
- `SESSION_SECRET`

Catatan:

- Semua session lama (format cookie lama) akan invalid setelah deploy hardening ini, user perlu login ulang sekali.
- `deploy` tetap tersedia untuk deploy default environment.

## 5) Endpoint utama

### Public

- `GET /forms` (portal navigasi)
- `GET /forms/api/schools/public`
- `GET /forms/api/tenants/public`
- `GET /forms/:tenantSlug/api/questionnaires/public`
- `GET /forms/:schoolSlug`
- `GET /forms/:schoolSlug/api/form-schema`
- `POST /forms/:schoolSlug/api/submit`
- `GET /forms/:tenantSlug/:questionnaireSlug`
- `GET /forms/:tenantSlug/:questionnaireSlug/api/schema`
- `GET /forms/:tenantSlug/:questionnaireSlug/api/form-schema` (alias compat frontend)
- `POST /forms/:tenantSlug/:questionnaireSlug/api/submit`

### Auth

- `POST /forms/admin/api/login`
- `POST /forms/admin/api/logout`
- `GET /forms/admin/api/me`

### Health

- `GET /health` (liveness tanpa koneksi DB)
- `GET /health/db` (readiness DB + schema check)

### Superadmin

- `GET /forms/admin/api/schools`
- `POST /forms/admin/api/schools`
- `PATCH /forms/admin/api/schools/:schoolId`
- `POST /forms/admin/api/schools/:schoolId/admins`
- `GET /forms/admin/api/tenants`
- `POST /forms/admin/api/tenants`
- `PATCH /forms/admin/api/tenants/:tenantId`
- `POST /forms/admin/api/tenants/:tenantId/admins`
- `GET /forms/admin/api/ai-prompts`
- `PUT /forms/admin/api/ai-prompts/draft`
- `POST /forms/admin/api/ai-prompts/publish`
- `GET /forms/admin/api/ai-prompts/history`

### School admin

- `GET /forms/:schoolSlug/admin`
- `GET /forms/:schoolSlug/admin/dashboard/`
- `GET /forms/:tenantSlug/admin/api/questionnaires`
- `POST /forms/:tenantSlug/admin/api/questionnaires`
- `PATCH /forms/:tenantSlug/admin/api/questionnaires/:questionnaireId`
- `GET /forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/draft`
- `PUT /forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/draft`
- `POST /forms/:tenantSlug/admin/api/questionnaires/:questionnaireSlug/publish`
- `GET /forms/:tenantSlug/admin/api/ai-prompts`
- `PUT /forms/:tenantSlug/admin/api/ai-prompts/draft`
- `POST /forms/:tenantSlug/admin/api/ai-prompts/publish`
- `GET /forms/:tenantSlug/admin/api/ai-prompts/history`
- `GET /forms/:schoolSlug/admin/api/form/draft`
- `PUT /forms/:schoolSlug/admin/api/form/draft`
- `POST /forms/:schoolSlug/admin/api/form/publish`
- `GET /forms/:schoolSlug/admin/api/responses`
- `GET /forms/:schoolSlug/admin/api/responses/export.csv`
- `GET /forms/:schoolSlug/admin/api/analytics/summary`
- `GET /forms/:schoolSlug/admin/api/analytics/distribution`
- `GET /forms/:schoolSlug/admin/api/analytics/trend`
- `POST /forms/:schoolSlug/admin/api/ai/analyze`
- `GET /forms/:schoolSlug/admin/api/ai/latest`

## 6) Route legacy

Route lama:

- `/formsman6kotakupang*`

akan di-redirect `301` ke:

- `/forms/sman6-kotakupang*`

Alias `/admin/*`:

- Aktif hanya jika `ENABLE_LEGACY_ADMIN_ALIAS=true`.
- Untuk production disarankan `false`.
- Route resmi production tetap `/forms/admin/*`.

## 7) Cutover Cloudflare (path-based route policy)

Saat cutover production di Cloudflare Routes:

- arahkan ke Worker: `aitiglobal.link/forms*`
- arahkan ke Worker: `aitiglobal.link/formsman6kotakupang*`
- jangan arahkan root website profil ke Worker
- jangan arahkan `/admin/*` ke Worker

Detail runbook: `docs/CLOUDFLARE_CUTOVER_RUNBOOK.md`

## 8) Struktur utama

```text
src/
  worker.js
  lib/
    db/
      sql.js
      bootstrap.js
    security/
      hash.js
    http/
      session-cookie.js
  modules/
    auth/
    schools/
    forms/
    submissions/
    analytics/
    ai/

public/
  forms/
  admin/
```

## 9) Catatan kompatibilitas / rollback

- Backend Express lama tetap ada untuk rollback (`legacy:dev`, `legacy:start`).
- Legacy snapshot UI root (`public/index.html`, `public/script.js`, `public/styles.css`, `public/dashboard.*`) dipertahankan agar migrasi bertahap aman.
- Runtime utama sekarang Cloudflare Worker.
- Route sekolah lama tetap hidup sebagai compat mode, sementara jalur v2 berjalan paralel.
