# AITI Forms Multi-Tenant (Cloudflare Worker + Hono)

Status baseline (ACTIVE):
- As of: 2026-02-23
- Branch baseline: `main`
- Closure status: D11-D41 CLOSED by proof (lihat debt register + closure report)

## Start Here (Wajib Baca Dulu)

Urutan baca untuk AI agent/dev agar tidak loop:
1. `docs/DOCS_INDEX.md`
2. `docs/DEBT_REGISTER_LOCKED.md`
3. `docs/DEBT_CLOSURE_REPORT.md`
4. `docs/MODULAR_MONOLITH_GUARDRAILS.md`
5. `docs/ANTI_ENDLESS_REFACTOR_PROTOCOL.md`

Checklist UAT canonical:
- `docs/UAT_CHECKLIST_HARDENING.md`

Catatan:
- File root `UAT_CHECKLIST_HARDENING.md` hanya pointer agar tidak terjadi drift konten.

## Ringkasan Fitur Runtime

- Portal publik terpadu: `/forms`
- Form publik:
  - legacy school slug: `/forms/:schoolSlug`
  - multi-tenant questionnaire: `/forms/:tenantSlug/:questionnaireSlug/`
- Public dashboard read-only:
  - page: `/forms/:tenantSlug/:questionnaireSlug/dashboard/`
  - API:
    - `/forms/:tenantSlug/:questionnaireSlug/api/dashboard/summary`
    - `/forms/:tenantSlug/:questionnaireSlug/api/dashboard/distribution`
    - `/forms/:tenantSlug/:questionnaireSlug/api/dashboard/trend`
- Admin:
  - superadmin: `/forms/admin/`
  - tenant admin: `/forms/:tenantSlug/admin/`
  - builder: `/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/builder/`
  - dashboard admin: `/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/dashboard/`
- SEO defensive baseline:
  - `GET /robots.txt`, `GET /forms/robots.txt`
  - `GET /sitemap.xml`, `GET /forms/sitemap.xml`
  - admin pages + public dashboard page: noindex header/meta
- Static delivery policy:
  - `/forms-static/*?v=...` -> immutable cache
  - `/forms-static/*` tanpa `v` -> short cache

## Setup Lokal

```bash
pnpm install
copy .env.example .env
```

Isi minimal `.env`:

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
CLOUDFLARE_API_TOKEN=for-deploy-only
```

## DB Bootstrap dan Seed

```bash
pnpm migrate:multi
pnpm seed:superadmin
```

## Menjalankan Aplikasi

```bash
pnpm dev
```

Entry lokal utama:
- `http://localhost:8787/forms`
- `http://localhost:8787/forms/admin/login`
- `http://localhost:8787/forms/admin/`

## Deploy

```bash
pnpm deploy:staging
pnpm deploy:production
```

Jika shell non-interaktif bermasalah, deploy manual:

```bash
pnpm exec wrangler deploy src/worker.js --env staging
pnpm exec wrangler deploy src/worker.js --env production
```

## Gate Penting (Current)

Arsitektur/gov:
- `pnpm check:modularity`
- `pnpm check:debt-register`
- `pnpm check:architecture`
- `pnpm check:static-versioning`

Smoke/UX/SEO:
- `pnpm smoke:e2e`
- `pnpm smoke:admin:ui`
- `pnpm smoke:ux:mobile`
- `pnpm smoke:ux:theme`
- `pnpm smoke:ux:contrast-nav`
- `pnpm smoke:ux:perf-public`
- `pnpm smoke:ux:css-payload`
- `pnpm smoke:public-dashboard`
- `pnpm smoke:seo:baseline`
- `pnpm smoke:lighthouse:forms`
- `pnpm smoke:ux:language-id`
- `pnpm smoke:ux:contrast-aa`

Visual:
- `pnpm visual:legacy-dashboard:diff`
- `pnpm visual:questionnaire-dashboard:diff`
- `pnpm visual:public-dashboard:diff`

## Cloudflare Routes (Production)

Route Worker aktif:
- `aitiglobal.link/robots.txt`
- `aitiglobal.link/sitemap.xml`
- `aitiglobal.link/forms*`
- `aitiglobal.link/formsman6kotakupang*`

Detail operasional:
- `docs/CLOUDFLARE_CUTOVER_RUNBOOK.md`

## Legacy dan Kompatibilitas

- Legacy alias `/admin/*` hanya aktif jika `ENABLE_LEGACY_ADMIN_ALIAS=true`.
- Route lama `/formsman6kotakupang*` tetap diarahkan ke jalur baru.
- Runtime utama aplikasi adalah Cloudflare Worker.

## Guardrail Arsitektur

Minimal sebelum menyelesaikan perubahan code:

```bash
pnpm check:modularity
```

Mode strict:

```bash
pnpm check:modularity:strict
```

Referensi rule lengkap:
- `docs/MODULAR_MONOLITH_GUARDRAILS.md`
