# Architecture Module Ownership

Dokumen ini menjadi baseline ownership untuk modular monolith strict. Setiap perubahan code harus mengikuti pemilik domain/tabel/API/UI berikut.

## Domain Ownership (Backend)

| Module | Tanggung Jawab Utama | Tabel yang Dimiliki |
|---|---|---|
| `auth` | user auth, session, membership authz | `users`, `sessions`, `school_memberships`, `tenant_memberships` |
| `schools` | lifecycle sekolah | `schools` |
| `tenants` | lifecycle tenant | `tenants` |
| `forms` | legacy form schema/version (school scope) | `form_versions` |
| `submissions` | legacy response analytics/response (school scope) | `responses` |
| `questionnaires` | questionnaire schema/version/response (tenant scope) | `questionnaires`, `questionnaire_versions`, `responses_v2` |
| `ai` | analisis AI orchestration + persistence result | `ai_analysis`, `ai_analysis_v2` |
| `ai-prompts` | prompt template/draft/publish/history | `ai_prompt_versions`, `ai_prompt_versions_v2` |
| `analytics` | facade analytics legacy (delegasi ke submissions) | - |
| `tenant-school-sync` | sinkronisasi tenant-school cross-aggregate | - (orchestration only) |

## HTTP Route Ownership

| Route Registrar | Scope |
|---|---|
| `src/http/routes/public-routes.js` | landing/login/public listing |
| `src/http/routes/public-form-routes.js` | public submit schema/submit (legacy + questionnaire) |
| `src/http/routes/admin-api-routes.js` | superadmin API |
| `src/http/routes/school-admin-api-routes.js` | school admin API (legacy dashboard/form) |
| `src/http/routes/tenant-admin-api/*` | tenant admin API (questionnaire/analytics/ai/ai-prompts) |
| `src/http/routes/admin-page-routes.js` | admin page asset routing |

## Frontend Page Ownership

| Entry | Module Folder |
|---|---|
| `public/admin/superadmin.js` | `public/admin/superadmin/` |
| `public/admin/questionnaire-builder.js` | `public/admin/questionnaire-builder/` |
| `public/admin/school.js` | `public/admin/school/` |
| `public/admin/questionnaire-dashboard.js` | `public/admin/questionnaire-dashboard/` |
| `public/forms/app.js` | `public/forms/app/` |

## Guardrail Rules (Ownership)

1. Composition root (`src/worker.js`) tidak boleh import repository langsung.
2. Cross-module write antar aggregate tidak boleh dilakukan di repository domain.
3. Frontend module page tidak boleh import feature module page lain secara relatif.
4. Legacy code di `src/legacy/**` hanya untuk rollback path.

## Review Checklist

1. Apakah perubahan menyentuh tabel milik module lain?
2. Apakah perubahan menambah import lintas module yang tidak perlu?
3. Apakah route handler tetap memanggil service/facade, bukan repository?
4. Apakah perubahan menjaga compatibility endpoint existing?
