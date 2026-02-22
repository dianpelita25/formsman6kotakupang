# Laporan Review Kedua — AITI Forms App
## Modular Monolith Audit & Action Plan

**Ditulis oleh:** Claude Sonnet (Anthropic)  
**Tanggal:** 18 Februari 2026  
**Repo:** `formsman6kotakupang` — AITI Global Nexus  
**Tipe Review:** Deep Modular Architecture Audit + What To Do Next

---

## Daftar Isi

1. [Apa Itu Modular Monolith dan Apakah App Ini Sudah Mencapainya?](#1-apa-itu-modular-monolith)
2. [Peta Module Saat Ini — Kondisi Nyata](#2-peta-module-saat-ini)
3. [Analisis Per Module — Sudah Modular atau Belum?](#3-analisis-per-module)
4. [Masalah Coupling Antar Module](#4-masalah-coupling-antar-module)
5. [Module yang Perlu Dipecah Lebih Lanjut](#5-module-yang-perlu-dipecah)
6. [Module yang Perlu Digabung / Dihapus](#6-module-yang-perlu-digabung-atau-dihapus)
7. [Temuan Baru dari Review Kedua](#7-temuan-baru)
8. [Action Plan Konkret](#8-action-plan-konkret)
9. [Target Arsitektur Ideal](#9-target-arsitektur-ideal)

---

## 1. Apa Itu Modular Monolith?

**Modular Monolith** adalah arsitektur di mana seluruh aplikasi berjalan dalam satu proses (monolith), tapi kode diorganisir dalam modul-modul yang:

- **Punya batas yang jelas** (setiap modul punya domain sendiri)
- **Tidak saling tahu implementasi internal** (komunikasi hanya lewat interface publik)
- **Bisa di-extract menjadi microservice** kapanpun tanpa refactor besar
- **Punya tanggung jawab tunggal** (Single Responsibility per modul)

### Verdict: Apakah App Ini Sudah Modular Monolith?

> **JAWABAN: SETENGAH-SETENGAH. Strukturnya ada, tapi implementasinya bocor di banyak tempat.**

App ini punya **struktur folder** yang terlihat modular, tapi secara implementasi masih ada banyak **coupling tersembunyi** yang melanggar prinsip modular monolith. Penjelasan detail di bawah.

---

## 2. Peta Module Saat Ini — Kondisi Nyata

### Module yang Ada (14 module):

```
src/modules/
├── ai/                    ← AI Analysis (Gemini)
├── ai-prompts/            ← AI Prompt Template Management
├── analytics/             ← Analytics (wrapper tipis)
├── auth/                  ← Authentication & Authorization
├── form/                  ← LEGACY - Form Schema (hardcoded)
├── forms/                 ← Form Version Management (baru)
├── questionnaires/        ← Questionnaire CRUD + Analytics + Submission
├── schools/               ← School Management
├── submission/            ← LEGACY - Form Submission (Express)
├── submissions/           ← Response Management (baru)
├── tenants/               ← Tenant Management
└── (tidak ada: notifications, audit-log, rate-limit, cache)
```

### Dependency Graph Antar Module:

```
worker.js (Hono Router)
    │
    ├── auth ──────────────────────────────────────────────────────┐
    │                                                               │
    ├── tenants ──────────────────────────────────────────────────►│
    │       └── auth/repository (createUser, grantTenantAdminRole) │
    │       └── lib/db/bootstrap (ensurePublishedVersion)  ◄── BOCOR
    │                                                               │
    ├── schools ─────────────────────────────────────────────────►│
    │       └── auth/repository (createUser)                       │
    │                                                               │
    ├── questionnaires ──────────────────────────────────────────►│
    │       └── forms/core (getDefaultDraft)                       │
    │       └── submissions/validation (validateSubmissionPayload) │
    │       └── lib/db/bootstrap (DEFAULT_QUESTIONNAIRE_*)  ◄── BOCOR
    │                                                               │
    ├── submissions ─────────────────────────────────────────────►│
    │       └── forms/service (getPublishedFormSchema)             │
    │       └── questionnaires/service (submitDefaultTenant...)    │
    │                                                               │
    ├── analytics ───────────────────────────────────────────────►│
    │       └── submissions/service (getSummary, getDistribution)  │
    │                                                               │
    ├── ai ──────────────────────────────────────────────────────►│
    │       └── analytics/service                                  │
    │       └── submissions/service (getAiSourceResponses)         │
    │       └── forms/service (getPublishedFormSchema)             │
    │       └── schools/service (resolveSchoolBySlug)              │
    │       └── questionnaires/service (getTenantQuestionnaire...) │
    │       └── questionnaires/repository (findDefault...)         │
    │       └── ai-prompts/service (resolveRenderedPrompt)         │
    │       └── lib/db/bootstrap (ensurePlatformSchema)    ◄── BOCOR
    │                                                               │
    └── ai-prompts ──────────────────────────────────────────────►│
            └── ai/modes (AI_ANALYSIS_MODES)                       │
```

**Masalah yang langsung terlihat:** Module `ai` adalah yang paling "rakus" — dia import dari 7 module berbeda. Ini tanda bahwa `ai` sudah terlalu besar dan punya terlalu banyak tanggung jawab.

---

## 3. Analisis Per Module — Sudah Modular atau Belum?

### ✅ Module yang Sudah Cukup Modular

#### `auth/` — BAIK
- Punya batas yang jelas: authentication, session, authorization
- Interface publik yang bersih: `loginWithEmailPassword`, `logout`, `resolveAuthContext`
- Middleware yang terpisah dari service
- **Catatan minor:** `auth/service.js` import dari Hono (`hono/cookie`) — ini coupling ke framework. Seharusnya cookie handling dipisah ke layer HTTP.

#### `ai-prompts/` — BAIK
- Tanggung jawab tunggal: template management
- Hanya import dari `ai/modes` (wajar, karena modes adalah shared constant)
- Interface bersih: `getAiPromptBundle`, `saveAiPromptDraft`, `publishAiPrompt`

#### `schools/` — CUKUP BAIK
- Tanggung jawab jelas: school CRUD
- **Masalah:** Import `auth/repository` langsung untuk `createUser` — ini coupling yang tidak perlu. Seharusnya `schools` tidak tahu tentang `auth`.

#### `tenants/` — CUKUP BAIK
- Tanggung jawab jelas: tenant CRUD
- **Masalah serius:** Import `lib/db/bootstrap` (`ensurePublishedVersion`, `ensureDraftVersion`) langsung dari service. Bootstrap adalah infrastruktur, bukan domain logic. Ini coupling yang salah.
- **Masalah:** Import `auth/repository` langsung untuk `createUser` — sama seperti `schools`.

---

### ⚠️ Module yang Bermasalah

#### `questionnaires/` — TERLALU GEMUK (GOD MODULE)

Ini adalah module paling bermasalah. File `service.js`-nya berisi **lebih dari 700 baris** dan melakukan:

1. CRUD questionnaire (create, update, list, patch)
2. Version management (draft, publish, archive)
3. Response submission
4. Analytics computation (distribution, summary, trend)
5. CSV export
6. AI source data preparation
7. Segmentation analysis (criteria, score band, respondent dimensions)
8. Date/filter normalization utilities

**Ini bukan satu module — ini adalah 4-5 module yang dipaksa jadi satu.**

Fungsi-fungsi seperti `buildSegmentSummary`, `buildCriterionSegmentDimension`, `buildScoreBandSegmentDimension`, `buildQuestionSegmentDimensions`, `buildRespondentSegmentDimensions` adalah **analytics engine** yang seharusnya ada di module `analytics/` atau module `segmentation/` tersendiri.

Fungsi `computeDistribution` (100+ baris) adalah analytics computation yang kompleks — ini bukan tanggung jawab questionnaire module.

#### `ai/` — TERLALU BANYAK DEPENDENCY

`ai/service.js` import dari 8 module berbeda:
- `ai/repository`
- `forms/service`
- `analytics/service`
- `submissions/service`
- `lib/db/bootstrap`
- `schools/service`
- `ai-prompts/service`
- `questionnaires/service`
- `questionnaires/repository`

Module yang punya 8+ dependency adalah tanda bahwa dia adalah **orchestrator**, bukan domain module. Orchestrator seharusnya ada di layer router/controller, bukan di service layer.

#### `analytics/` — WRAPPER KOSONG

```javascript
// src/modules/analytics/service.js — HANYA 3 FUNGSI WRAPPER
export async function getAnalyticsSummary(env, schoolId) {
  return getSummary(env, schoolId); // langsung delegate ke submissions
}
export async function getAnalyticsDistribution(env, schoolId) {
  return getDistribution(env, schoolId);
}
export async function getAnalyticsTrend(env, schoolId, days) {
  return getTrendAnalytics(env, schoolId, days);
}
```

Module `analytics/` hanya berisi 3 fungsi yang masing-masing hanya memanggil fungsi dari `submissions/service`. Ini bukan module — ini adalah **indirection yang tidak berguna**. Tidak ada logic di sini, tidak ada transformasi, tidak ada value yang ditambahkan.

Sementara itu, analytics yang sesungguhnya (distribution computation, segmentation) ada di `questionnaires/service.js`. Ini terbalik.

#### `submissions/` — TANGGUNG JAWAB GANDA

`submissions/service.js` melakukan:
1. Submit response (domain logic)
2. Get responses dengan pagination (domain logic)
3. Export CSV (presentation/output concern)
4. Get summary stats (analytics concern)
5. Get distribution (analytics concern)
6. Get trend (analytics concern)
7. Get AI source data (AI concern)

Fungsi `getSummary`, `getDistribution`, `getTrendAnalytics` seharusnya ada di `analytics/` module, bukan di `submissions/`.

---

### ❌ Module yang Harus Dihapus

#### `form/` (singular) — LEGACY, HARUS DIHAPUS
- Hanya berisi `schema.js` (hardcoded form fields) dan `controller.js` (Express controller)
- Sudah tidak dipakai di production (Hono worker)
- Masih ada karena Express legacy server masih ada

#### `submission/` (singular) — LEGACY, HARUS DIHAPUS
- Duplikat dari `submissions/` (plural)
- Menulis ke tabel `form_responses` yang berbeda dari tabel production
- Masih ada karena Express legacy server masih ada

---

## 4. Masalah Coupling Antar Module

### Coupling yang Melanggar Prinsip Modular Monolith:

| Dari | Ke | Masalah |
|---|---|---|
| `tenants/service` | `lib/db/bootstrap` | Service domain import infrastruktur bootstrap |
| `tenants/service` | `auth/repository` | Tenant management langsung akses auth DB layer |
| `schools/service` | `auth/repository` | School management langsung akses auth DB layer |
| `ai/service` | `questionnaires/repository` | AI service bypass questionnaire service layer |
| `questionnaires/repository` | `lib/db/bootstrap` | Repository import konstanta dari bootstrap |
| `submissions/service` | `questionnaires/service` | Circular-like: submissions memanggil questionnaires untuk dual-write |
| `auth/service` | `hono/cookie` | Service layer coupling ke HTTP framework |

### Coupling yang Acceptable (tidak perlu diubah):

| Dari | Ke | Alasan |
|---|---|---|
| `ai/service` | `ai-prompts/service` | Satu domain (AI) |
| `analytics/service` | `submissions/service` | Analytics adalah consumer dari submissions |
| `questionnaires/service` | `submissions/validation` | Shared validation logic |
| `forms/service` | `forms/repository` | Dalam satu module |

---

## 5. Module yang Perlu Dipecah Lebih Lanjut

### 🔴 PRIORITAS TINGGI: Pecah `questionnaires/service.js`

File ini 700+ baris dan melakukan terlalu banyak hal. Pecah menjadi:

```
src/modules/questionnaires/
├── service.js              ← Hanya CRUD questionnaire & version management
├── submission-service.js   ← Response submission logic
└── analytics-service.js    ← Distribution, summary, trend, segmentation
```

Atau lebih baik, pindahkan analytics ke module `analytics/`:

```
src/modules/analytics/
├── service.js              ← Orchestrator analytics (saat ini kosong)
├── distribution.js         ← computeDistribution, buildSegmentSummary, dll
├── summary.js              ← getSummary, getSummaryStats
└── trend.js                ← getTrend, getTrendAnalytics
```

### 🟠 PRIORITAS SEDANG: Pecah `ai/service.js`

Saat ini `ai/service.js` berisi:
- `analyzeSchoolAi` — untuk legacy school
- `analyzeTenantQuestionnaireAi` — untuk multi-tenant
- `getLatestSchoolAi` — untuk legacy school
- `getLatestTenantQuestionnaireAi` — untuk multi-tenant
- `callGemini` — HTTP client ke Gemini API
- `buildPromptLegacy` — prompt builder legacy
- `analyzeAi` / `getLatestAi` — wrapper untuk Express legacy

Pecah menjadi:

```
src/modules/ai/
├── service.js              ← Orchestrator (hanya koordinasi)
├── gemini-client.js        ← callGemini, HTTP ke Gemini API
├── prompt-builder.js       ← buildPromptLegacy, prompt construction
└── repository.js           ← DB operations (sudah ada, sudah baik)
```

### 🟡 PRIORITAS RENDAH: Buat Module `user/` Tersendiri

Saat ini logika user management tersebar di:
- `auth/repository.js` — `createUser`, `findUserByEmail`
- `tenants/service.js` — memanggil `createUser` dari auth
- `schools/service.js` — memanggil `createUser` dari auth

Seharusnya ada module `users/` yang mengelola user lifecycle:

```
src/modules/users/
├── service.js    ← createUser, findUser, updateUser
└── repository.js ← DB operations untuk users table
```

Lalu `auth/` hanya fokus pada authentication (session, token, password verify), bukan user management.

---

## 6. Module yang Perlu Digabung atau Dihapus

### Hapus Segera:

| Module | Alasan |
|---|---|
| `src/modules/form/` (singular) | Legacy Express, sudah tidak dipakai |
| `src/modules/submission/` (singular) | Legacy Express, sudah tidak dipakai |
| `src/lib/db/client.js` | Duplikat dari `sql.js` dengan signature berbeda |
| `worker.js` (root) | Zombie file, proxy lama yang sudah tidak dipakai |
| `src/server.js` | Legacy Express server, rollback-only |
| `src/app/routes.js` | Legacy Express routes |

### Refactor `analytics/service.js`:

Saat ini `analytics/service.js` hanya wrapper kosong. Ada dua pilihan:
1. **Hapus** dan panggil `submissions/service` langsung dari worker
2. **Isi dengan konten nyata** — pindahkan semua analytics logic dari `questionnaires/service.js` ke sini

Pilihan 2 lebih baik untuk arsitektur jangka panjang.

---

## 7. Temuan Baru dari Review Kedua

### 🔴 Temuan Baru #1: `questionnaires/service.js` Melakukan Analytics In-Memory yang Berbahaya

```javascript
// Di getTenantQuestionnaireAnalyticsSummary:
const responses = await listQuestionnaireResponsesForAggregation(env, filters, null);
// null = TIDAK ADA LIMIT!
const distribution = computeDistribution(fields, responses);
```

Fungsi `listQuestionnaireResponsesForAggregation` dipanggil dengan `limit = null` — artinya **semua response diambil ke memory** untuk dihitung di JavaScript. Kalau ada 50.000 response, semua akan di-load ke Worker memory sekaligus.

Cloudflare Workers punya **memory limit 128MB**. Dengan 50.000 response yang masing-masing berisi JSON answers, ini bisa dengan mudah melebihi limit dan menyebabkan Worker crash.

**Solusi:** Pindahkan computation ke database (SQL aggregation), bukan di JavaScript.

### 🔴 Temuan Baru #2: `publishDraftVersion` Menggunakan Advisory Lock yang Bisa Deadlock

```javascript
// questionnaires/repository.js
WITH scope_lock AS (
  SELECT pg_advisory_xact_lock(hashtext(${String(questionnaireId)}::text)::bigint) AS locked
),
```

`pg_advisory_xact_lock` adalah transaction-level lock. Kalau dua request publish bersamaan untuk questionnaire yang sama, salah satu akan menunggu. Tapi kalau ada timeout atau koneksi terputus, lock bisa tidak dilepas dengan benar di Neon serverless environment.

Ini adalah pattern yang benar untuk mencegah race condition, tapi perlu dipastikan Neon serverless mendukung advisory locks dengan benar.

### 🟠 Temuan Baru #3: `tenants/service.js` Langsung Menulis ke Tabel `schools`

```javascript
// tenants/service.js - createNewTenant
const sql = getSqlClient(env);
await sql`
  INSERT INTO schools (id, slug, name, is_active)
  VALUES (${created.id}, ${created.slug}, ${created.name}, ${created.is_active})
  ON CONFLICT (id) DO UPDATE ...
`;
```

Module `tenants` langsung menulis ke tabel `schools` tanpa melalui `schools/service`. Ini melanggar prinsip modular — setiap module seharusnya hanya menulis ke tabelnya sendiri. Kalau ada validasi atau business logic di `schools/service`, ini akan di-bypass.

### 🟠 Temuan Baru #4: Tidak Ada Error Boundary di `computeDistribution`

Fungsi `computeDistribution` di `questionnaires/service.js` tidak punya error handling sama sekali. Kalau ada satu response dengan data yang corrupt (misalnya `answers` bukan object), seluruh analytics akan crash dan return 500 ke user.

### 🟡 Temuan Baru #5: `normalizeFromFilter` / `normalizeToFilter` Duplikat di Banyak Tempat

Fungsi-fungsi normalisasi filter (from, to, days, page, pageSize, search) didefinisikan di `questionnaires/service.js` tapi logika serupa juga ada di `submissions/service.js` dan `ai/service.js`. Ini adalah utility yang seharusnya ada di satu tempat (`src/lib/utils/filters.js` atau sejenisnya).

### 🟡 Temuan Baru #6: `escapeCsvValue` Didefinisikan di 3 Tempat

```javascript
// Definisi yang sama persis ada di:
// 1. src/modules/submission/service.js
// 2. src/modules/submissions/service.js
// 3. src/modules/questionnaires/service.js
```

Ini adalah copy-paste yang seharusnya jadi shared utility.

---

## 8. Action Plan Konkret

### FASE 1 — Bersihkan Legacy (1-2 minggu)

**Tujuan:** Hapus semua kode yang tidak dipakai di production.

```
HAPUS:
├── src/server.js
├── src/app/routes.js
├── src/modules/form/          (seluruh folder)
├── src/modules/submission/    (seluruh folder)
├── src/lib/db/client.js
└── worker.js (root)

PINDAHKAN ke legacy/:
└── (sudah ada legacy/ folder, gunakan itu)
```

**Estimasi effort:** 2-3 jam  
**Risiko:** Rendah (kode ini tidak dipakai di production)

---

### FASE 2 — Fix Security & Bug Kritis (1 minggu)

**Tujuan:** Perbaiki masalah yang bisa menyebabkan data breach atau downtime.

```
1. Fix session.is_active bug:
   - Tambah kolom ke tabel sessions ATAU hapus pengecekan
   - File: db/schema.sql, src/modules/auth/service.js

2. Naikkan PBKDF2 iterations:
   - Ubah 10000 → 600000
   - File: src/lib/security/hash.js

3. Tambah rate limiting:
   - Konfigurasi Cloudflare WAF rules
   - Atau implementasi in-worker rate limit sederhana

4. Fix in-memory analytics limit:
   - Tambah limit maksimum (misal 10000) untuk aggregation
   - File: src/modules/questionnaires/service.js
```

**Estimasi effort:** 3-5 hari  
**Risiko:** Sedang (perlu test setelah perubahan)

---

### FASE 3 — Buat Shared Utilities (3-5 hari)

**Tujuan:** Hilangkan duplikasi kode.

```
BUAT:
src/lib/utils/
├── csv.js          ← escapeCsvValue, formatAnswerForCsv
├── filters.js      ← normalizeFromFilter, normalizeToFilter, normalizeDays, dll
└── pagination.js   ← normalizePage, normalizePageSize
```

**Estimasi effort:** 1-2 hari  
**Risiko:** Rendah

---

### FASE 4 — Refactor Module Boundaries (2-3 minggu)

**Tujuan:** Perbaiki coupling yang salah dan pisahkan tanggung jawab.

#### 4a. Buat module `users/`
```
src/modules/users/
├── service.js    ← createUser, findUser (pindah dari auth/repository)
└── repository.js ← DB operations
```
Update `tenants/service.js` dan `schools/service.js` untuk import dari `users/` bukan `auth/repository`.

#### 4b. Pisahkan analytics dari questionnaires
```
src/modules/analytics/
├── service.js          ← Orchestrator (refactor dari wrapper kosong)
├── distribution.js     ← computeDistribution, buildSegmentSummary (pindah dari questionnaires)
├── summary.js          ← getSummary, getSummaryStats
└── trend.js            ← getTrend
```

#### 4c. Pisahkan Gemini client dari AI service
```
src/modules/ai/
├── service.js          ← Orchestrator saja
├── gemini-client.js    ← callGemini (pindah dari service.js)
└── prompt-builder.js   ← buildPromptLegacy (pindah dari service.js)
```

#### 4d. Hapus coupling tenants → bootstrap
```
// tenants/service.js — HAPUS ini:
import { ensureDraftVersion, ensurePublishedVersion } from '../../lib/db/bootstrap.js';

// Ganti dengan:
import { ensureFormVersions } from '../forms/service.js';
```

**Estimasi effort:** 1-2 minggu  
**Risiko:** Tinggi (perlu test menyeluruh)

---

### FASE 5 — Pindahkan Analytics ke Database (2-3 minggu)

**Tujuan:** Hilangkan in-memory analytics yang berbahaya.

Saat ini `computeDistribution` mengambil semua response ke memory lalu menghitung di JavaScript. Ini harus dipindahkan ke SQL:

```sql
-- Contoh: hitung distribution di DB, bukan di JS
SELECT
  field_name,
  answer_value,
  COUNT(*) as total
FROM responses_v2,
  jsonb_each_text(answers) AS kv(field_name, answer_value)
WHERE questionnaire_id = $1
GROUP BY field_name, answer_value;
```

**Estimasi effort:** 2-3 minggu  
**Risiko:** Tinggi (perlu validasi hasil sama dengan implementasi JS)

---

## 9. Target Arsitektur Ideal

Setelah semua fase selesai, struktur module yang ideal:

```
src/
├── worker.js                    ← Hono router (routing saja, tidak ada logic)
│
├── lib/
│   ├── db/
│   │   ├── sql.js               ← Satu-satunya DB client
│   │   └── bootstrap.js         ← Hanya schema check, bukan migration
│   ├── http/
│   │   ├── request-guards.js    ← CSRF protection (bukan hanya logging)
│   │   └── session-cookie.js
│   ├── security/
│   │   ├── hash.js              ← PBKDF2 600k iterations
│   │   └── signature.js
│   └── utils/
│       ├── csv.js               ← Shared CSV utilities
│       ├── filters.js           ← Shared filter normalization
│       └── pagination.js        ← Shared pagination utilities
│
└── modules/
    ├── auth/                    ← Authentication & session ONLY
    ├── users/                   ← User management (BARU)
    ├── tenants/                 ← Tenant CRUD
    ├── schools/                 ← School CRUD (legacy compat)
    ├── questionnaires/          ← Questionnaire CRUD & version management ONLY
    ├── responses/               ← Response submission & retrieval (RENAME dari submissions)
    ├── analytics/               ← Analytics computation (DIISI dengan konten nyata)
    ├── ai/                      ← AI orchestration
    │   ├── gemini-client.js     ← Gemini HTTP client (BARU)
    │   └── prompt-builder.js    ← Prompt construction (BARU)
    ├── ai-prompts/              ← AI prompt template management
    └── forms/                   ← Form version management (legacy compat)
```

### Prinsip yang Harus Dijaga:

1. **Setiap module hanya import dari module di bawahnya atau setara** — tidak boleh ada circular dependency
2. **Repository hanya import dari `lib/db/sql.js`** — tidak boleh import dari module lain
3. **Service hanya import dari repository-nya sendiri dan module lain** — tidak boleh import dari `lib/db/bootstrap`
4. **Worker/router hanya import dari service** — tidak boleh import dari repository langsung
5. **Shared utilities ada di `lib/utils/`** — tidak boleh diduplikasi di setiap module

---

## Ringkasan Akhir

| Aspek | Status Sekarang | Target |
|---|---|---|
| **Struktur folder** | Ada tapi tidak konsisten | Bersih, tidak ada duplikat |
| **Module boundaries** | Bocor di banyak tempat | Setiap module punya batas jelas |
| **Coupling** | 8+ dependency di AI module | Maksimal 3-4 dependency per module |
| **Duplikasi kode** | 3+ tempat untuk fungsi yang sama | Satu tempat di `lib/utils/` |
| **Analytics** | In-memory, berbahaya | Di database via SQL |
| **Legacy code** | Masih ada di production codebase | Dihapus atau di folder `legacy/` |
| **Security** | PBKDF2 lemah, no rate limit | PBKDF2 600k, rate limiting aktif |

**Prioritas utama yang harus dilakukan SEKARANG:**
1. Fix `session.is_active` bug
2. Hapus legacy modules (form/, submission/)
3. Tambah limit pada `listQuestionnaireResponsesForAggregation`
4. Naikkan PBKDF2 iterations

---

*Laporan ini adalah kelanjutan dari CODE_REVIEW_ANALYSIS.md (review pertama). Dibuat berdasarkan analisis mendalam seluruh source code termasuk questionnaires/service.js (700+ baris), questionnaires/repository.js, tenants/service.js, dan semua module lainnya.*

---

**© 2026 — Analisis oleh Claude Sonnet (Anthropic) untuk AITI Global Nexus**
