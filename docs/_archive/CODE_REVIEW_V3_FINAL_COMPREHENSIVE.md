# Laporan Review Final — AITI Forms App
## Comprehensive Deep Dive: Semua Temuan dari 3 Sesi Review
### Revisi V3.1 — Dikoreksi Berdasarkan Validasi Dev (18 Feb 2026)

**Ditulis oleh:** Claude Sonnet (Anthropic)  
**Tanggal pertama:** 18 Februari 2026  
**Revisi V3.1:** 18 Februari 2026 — 9 koreksi berdasarkan cross-check source code aktual oleh dev  
**Repo:** `formsman6kotakupang` — AITI Global Nexus  
**File yang Dianalisis:** src/worker.js, src/server.js, src/app/routes.js, src/lib/db/bootstrap.js (>1100 baris), src/lib/db/sql.js, src/lib/db/client.js, src/lib/security/hash.js, src/lib/security/signature.js, src/lib/http/request-guards.js, src/lib/http/session-cookie.js, src/modules/auth/service.js, src/modules/auth/repository.js, src/modules/auth/middleware.js, src/modules/tenants/service.js, src/modules/tenants/repository.js, src/modules/schools/service.js, src/modules/schools/repository.js, src/modules/questionnaires/service.js (>1100 baris), src/modules/questionnaires/repository.js, src/modules/questionnaires/schema.js, src/modules/submissions/service.js, src/modules/submissions/repository.js, src/modules/submissions/validation.js, src/modules/submission/service.js (LEGACY), src/modules/forms/core.js, src/modules/forms/repository.js, src/modules/forms/service.js, src/modules/form/schema.js (LEGACY), src/modules/ai/service.js, src/modules/ai/repository.js, src/modules/ai-prompts/service.js, src/modules/ai-prompts/repository.js, src/modules/analytics/service.js, public/admin/*.html, public/forms/*.html

---

## Catatan Revisi V3.1

Dokumen ini telah dikoreksi berdasarkan verifikasi mendalam terhadap source code aktual. Koreksi dilakukan setelah cross-check line-by-line oleh dev dengan `pnpm smoke:e2e` lulus pada 2026-02-18.

| # | Klaim V3 Asal | Status | Koreksi |
|---|---|---|---|
| 1 | "Naikkan PBKDF2 ke 600k — ganti konstanta saja" | ❌ BERBAHAYA | Strategi migrasi bertahap wajib (lihat §2 KRITIS #1) |
| 2 | "questionnaires/repository — clean, hanya import sql.js" | ❌ SALAH | Juga import dari bootstrap.js (line 2) dan forms/core.js |
| 3 | "6 query paralel selalu terjadi di ai-prompts" | ⚠️ KURANG PRESISI | Kondisional: 2/4/6 query tergantung scope |
| 4 | CSRF severity: KRITIS | ⚠️ TERLALU TINGGI | Turun ke MEDIUM — ada SameSite=Lax + JSON content-type guard |
| 5 | "Legacy files aman dihapus" | ⚠️ TERLALU SIMPLISTIK | Perlu keputusan rollback policy dulu (ada legacy:dev/legacy:start) |
| 6 | "Superadmin NULL adalah kejanggalan/anomali tak sengaja" | ⚠️ FRAMING SALAH | Ini trade-off desain eksplisit dengan CHECK constraint |
| 7 | "bootstrap.js 600+ baris / questionnaires/service 700+ baris" | ⚠️ ANGKA LAMA | Keduanya sudah >1100 baris |
| 8 | (Tidak ada di V3) | ➕ TAMBAHAN BARU | AI analysis memicu double computation analytics berat |
| 9 | (Tidak ada di V3) | ➕ TAMBAHAN BARU | Acceptance criteria per perbaikan (lihat §8) |

---

## Daftar Isi

1. [Kondisi App Saat Ini — Gambaran Jujur](#1-kondisi-app-saat-ini)
2. [Masalah Kritis — Harus Diperbaiki Segera](#2-masalah-kritis)
3. [Masalah Serius — Perlu Perhatian Bulan Ini](#3-masalah-serius)
4. [Masalah Arsitektur — Technical Debt Jangka Menengah](#4-masalah-arsitektur)
5. [Status Modular Monolith — Verdict Final](#5-status-modular-monolith)
6. [Peta Dependency Antar Module](#6-peta-dependency)
7. [Action Plan Bertahap](#7-action-plan)
8. [Acceptance Criteria per Perbaikan](#8-acceptance-criteria)
9. [Target Arsitektur Ideal](#9-target-arsitektur)
10. [Nilai Akhir per Aspek](#10-nilai-akhir)

---

## 1. Kondisi App Saat Ini — Gambaran Jujur

App ini adalah sistem form feedback multi-tenant berbasis Cloudflare Workers + Neon PostgreSQL. Secara fungsional **sudah berjalan di production** dan sudah melayani beberapa sekolah. Fiturnya lengkap: form builder dinamis, analytics, AI analysis via Gemini, PDF export, multi-tenant, role-based access.

**Yang perlu dipahami:** App ini lahir dari satu sekolah (SMAN 6 Kota Kupang) lalu berkembang menjadi platform multi-tenant. Transisi itu masih 70% selesai. 30% sisanya adalah technical debt yang bisa meledak kalau tidak ditangani sebelum scale.

**Dua sistem dalam satu repo:**

| Sistem | Stack | Dipakai? |
|---|---|---|
| Legacy Express | `src/server.js` + `src/app/routes.js` | ❌ Tidak di production, dipertahankan untuk rollback |
| Production Hono Worker | `src/worker.js` | ✅ Aktif |
| Proxy lama | `worker.js` (root) | ❌ Zombie file |

---

## 2. Masalah Kritis — Harus Diperbaiki Segera

### 🔴 KRITIS #1: PBKDF2 dengan 10.000 Iterasi — Kelemahan Keamanan, PERLU STRATEGI MIGRASI

**File:** `src/lib/security/hash.js` (line 2, line 48)  
**File terkait:** `src/modules/auth/service.js` (line 77), `src/lib/db/bootstrap.js` (line 126-127)

```javascript
// hash.js line 2
const DEFAULT_PBKDF2_ITERATIONS = 10000;

// hash.js line 48 — verifyPassword juga pakai default yang sama
export async function verifyPassword(password, salt, expectedHash, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const actualHash = await hashPassword(password, salt, iterations);
  return actualHash === expectedHash;
}
```

```sql
-- bootstrap.js line 126-127 — schema users TIDAK menyimpan iterations per-user
password_hash TEXT NOT NULL,
password_salt TEXT NOT NULL,  -- hanya salt, BUKAN iterations!
```

NIST SP 800-132 (2023) merekomendasikan minimum **600.000 iterasi** untuk PBKDF2-SHA256.

#### ⛔ PERINGATAN: Jangan Ganti Konstanta Langsung!

**Jika `DEFAULT_PBKDF2_ITERATIONS = 600000` diganti tanpa strategi migrasi:**
1. `verifyPassword` akan hash ulang password dengan 600k iterasi
2. Hash lama di DB dibuat dengan 10k iterasi → tidak cocok
3. **Semua user existing TIDAK BISA LOGIN** — downtime total

#### Strategi Migrasi yang Benar (3 Fase)

**Fase 1 — Tambah kolom `password_iterations` ke DB (jalankan migration SQL DULU sebelum deploy kode baru):**
```sql
-- Migration: wajib dijalankan SEBELUM deploy kode baru
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_iterations INTEGER NOT NULL DEFAULT 10000;
```

**Fase 2 — Update kode auth/repository.js untuk baca/tulis kolom baru:**
```javascript
// auth/repository.js — updateUserPassword perlu support iterations
UPDATE users
SET
  password_hash = ${passwordHash},
  password_salt = ${passwordSalt},
  password_iterations = ${passwordIterations},  // ← tambahkan ini
  is_active = TRUE
WHERE id = ${userId}
```

**Fase 3 — Update auth/service.js untuk rehash bertahap saat login:**
```javascript
// auth/service.js — setelah verifyPassword berhasil
const TARGET_ITERATIONS = 600000;

// Verify dengan iterasi yang tersimpan di DB (bukan default global)
const passwordValid = await verifyPassword(
  password,
  user.password_salt,
  user.password_hash,
  user.password_iterations  // ← baca dari DB per-user
);

if (!passwordValid) {
  return { ok: false, status: 401, message: 'Email atau password salah.' };
}

// Rehash bertahap: kalau akun lama pakai iterasi lebih kecil
if (user.password_iterations < TARGET_ITERATIONS) {
  const newHash = await hashPassword(password, user.password_salt, TARGET_ITERATIONS);
  await updateUserPassword(env, {
    userId: user.id,
    passwordHash: newHash,
    passwordSalt: user.password_salt,
    passwordIterations: TARGET_ITERATIONS,  // ← wajib update iterations juga!
  });
}
```

**Urutan deployment yang wajib diikuti:**
```
1. Jalankan SQL migration (ADD COLUMN password_iterations DEFAULT 10000)
2. Verify migration berhasil di DB
3. Deploy kode baru (yang baca/update kolom iterations)
4. Monitor login metrics selama 24 jam
5. Jangan rollback konstanta sebelum semua user lama berhasil login minimal 1x
```

---

### 🔴 KRITIS #2: Tidak Ada Rate Limiting di Login Endpoint

**File:** `src/worker.js` (line 247)

Endpoint login tidak ada rate limiting. Siapapun bisa brute force password admin tanpa hambatan.

**Solusi A (Cloudflare WAF — paling mudah):**
- Path: `/forms/admin/api/login`
- Method: POST
- Limit: 5 requests per IP per 60 detik
- Action: Block (429)

**Solusi B (In-Worker dengan KV):**
```javascript
const loginKey = `ratelimit:login:${clientIP}`;
const attempts = Number(await env.KV.get(loginKey) || 0);
if (attempts >= 5) return c.json({ error: 'Too many attempts' }, 429);
await env.KV.put(loginKey, String(attempts + 1), { expirationTtl: 60 });
```

---

### 🔴 KRITIS #3: Analytics In-Memory Tanpa Limit — Bisa Crash Worker

**File:** `src/modules/questionnaires/service.js` (line 1156, line 1198)

```javascript
// service.js line 1156 — Summary load SEMUA response
const responses = await listQuestionnaireResponsesForAggregation(env, filters, null);

// service.js line 1198 — Distribution juga load SEMUA response
const responses = await listQuestionnaireResponsesForAggregation(env, filters, null);
```

Cloudflare Workers punya **memory limit 128MB** dan **CPU limit 30s** (paid). Dengan 50.000+ response, ini bisa timeout atau OOM.

**Solusi segera (hard limit):**
```javascript
const responses = await listQuestionnaireResponsesForAggregation(env, filters, 10000);
```

**Solusi ideal:** Pindahkan aggregation ke SQL (lihat Fase 6 di §7).

---

### 🔴 KRITIS #4 (BARU): AI Analysis Memicu Double Computation Analytics

**File:** `src/modules/ai/service.js` (line 259)  
**Dipicu oleh:** `service.js` line 1156 dan line 1198

```javascript
// ai/service.js line 259 — keduanya dipanggil SEKALIGUS
const [summary, distribution] = await Promise.all([
  getTenantQuestionnaireAnalyticsSummary(env, filters),    // ← load semua response + compute
  getTenantQuestionnaireAnalyticsDistribution(env, filters), // ← load LAGI semua response + compute
]);
```

Satu request AI = **dua kali** query besar ke DB + dua kali `computeDistribution` di memory JavaScript. Ini berarti:
- Latency naik 2x dibanding analytics biasa
- Memory usage 2x
- CPU time 2x
- Risiko timeout lebih tinggi

**Solusi:**
```javascript
// Buat single aggregation pass untuk AI
const [responses, stats] = await Promise.all([
  listQuestionnaireResponsesForAggregation(env, filters, 10000),
  getQuestionnaireSummaryStatsV2(env, filters),
]);
const distribution = computeDistribution(fields, responses);
const summary = buildSummaryFromStats(stats, distribution);
// Kirim keduanya ke AI tanpa load data dua kali
```

---

### 🟡 MEDIUM #5: CSRF — Ada Mitigasi, Tapi Belum Enforce Block

**File:** `src/lib/http/request-guards.js` (line 46)  
**Mitigasi yang sudah ada:** `session-cookie.js` (line 15), `request-guards.js` (line 23)

```javascript
// session-cookie.js line 15 — SameSite=Lax memblokir cross-site POST dari browser
sameSite: 'Lax',

// request-guards.js line 23 — wajib application/json untuk mutations
// (HTML form biasa tidak bisa set Content-Type ini → CSRF via form tidak mungkin)
if (!contentType.includes('application/json')) return c.json({...}, 415);

// request-guards.js line 46 — MASALAH: hanya log, tidak blokir
export async function monitorAdminOrigin(c, next) {
  console.warn(`[ORIGIN_MONITOR] origin=${origin} ...`);
  await next(); // ← tetap lanjut meski origin berbeda!
}
```

**Penilaian:** Bukan "tanpa proteksi sama sekali" — `SameSite=Lax` + `Content-Type: application/json` sudah memblokir mayoritas CSRF attack. Tapi belum "strong CSRF enforcement."

**Solusi (upgrade ke enforce):**
```javascript
export async function enforceAdminOrigin(c, next) {
  if (!isMutationMethod(c.req.method)) { await next(); return; }
  const origin = c.req.header('origin');
  if (origin) {
    const requestHost = new URL(c.req.url).host;
    const originHost = new URL(origin).host;
    if (originHost !== requestHost) {
      return c.json({ error: 'Forbidden: Cross-origin request' }, 403);
    }
  }
  await next();
}
```

---

### 🟡 MEDIUM #6: `session.is_active` — Naming Menyesatkan

**File:** `src/modules/auth/service.js` (line 149)  
**Bukti:** `src/modules/auth/repository.js` (line 73)

```javascript
// auth/repository.js line 73 — SELECT dari tabel users, bukan sessions
SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.email, u.is_active
FROM sessions s JOIN users u ON u.id = s.user_id
```

```javascript
// auth/service.js line 149 — 'session.is_active' sebenarnya 'users.is_active'
if (session.revoked_at || expired || !session.is_active) { ... }
```

Bukan bug fatal — pengecekan valid. Tapi naming `session.is_active` bisa menyesatkan developer baru yang mengira ada kolom `is_active` di tabel `sessions`.

**Solusi:** Rename alias di SQL query: `u.is_active AS user_is_active`, lalu update service.

---

## 3. Masalah Serius — Perlu Perhatian Bulan Ini

### ⚠️ SERIUS #7: `auth/service.js` — Service Layer Coupling ke HTTP Framework

**File:** `src/modules/auth/service.js` (line 52, 62, 106)

`loginWithEmailPassword(c)` menerima Hono Context langsung — tidak bisa di-test tanpa mock framework, tidak bisa dipakai di script CLI.

**Solusi:** Pisahkan concern HTTP. Service terima `(env, email, password)`, router yang set cookie.

---

### ⚠️ SERIUS #8: `forms/repository.js` Import dari `bootstrap.js`

**File:** `src/modules/forms/repository.js` (line 2)

Repository layer seharusnya hanya import dari `lib/db/sql.js`. Coupling ke bootstrap menyebabkan seluruh bootstrap.js (>1100 baris) ikut di-load.

**Solusi:** Pindahkan `ensureDraftVersion`/`ensurePublishedVersion` ke `src/lib/db/form-versions.js` terpisah.

---

### ⚠️ SERIUS #9: `questionnaires/repository.js` — Bukan "Pure SQL Only"

**File:** `src/modules/questionnaires/repository.js` (line 2, line 3)

```javascript
import { getSqlClient } from '../../lib/db/sql.js';
import { DEFAULT_QUESTIONNAIRE_NAME, DEFAULT_QUESTIONNAIRE_SLUG } from '../../lib/db/bootstrap.js'; // ← import bootstrap!
import { getDefaultDraft } from '../forms/core.js'; // ← import domain lain!
```

Repository ini juga import konstanta dari `bootstrap.js` dan fungsi dari `forms/core.js`. Ini berarti ada coupling antar domain di layer yang seharusnya paling murni.

**Solusi:** Pindahkan konstanta `DEFAULT_QUESTIONNAIRE_NAME` dan `DEFAULT_QUESTIONNAIRE_SLUG` ke file constants terpisah (misal: `src/lib/constants.js`), dan `getDefaultDraft` ke `src/lib/db/form-versions.js`.

---

### ⚠️ SERIUS #10: `schools/service.js` — Coupling Deep Chain

`schools/service.js` import dari `questionnaires/service.js` (>1100 baris). Perubahan signature di questionnaires bisa terdampak ke schools secara tidak terduga.

**Solusi:** Pindahkan `ensureTenantQuestionnaireInitialized` ke caller (worker route handler), bukan di schools service.

---

### ⚠️ SERIUS #11: `submissions/repository.js` — Schema Hardcoded 12 Pertanyaan

```javascript
// submissions/repository.js line 6, 12 — HARDCODED q1-q12!
INSERT INTO responses (school_id, form_version_id, nama_guru, ..., q1, q2, ..., q12, extra_answers)
```

Tabel lama ini masih dipakai untuk dual-write ke legacy school. Bertentangan dengan sistem `responses_v2` yang fleksibel.

**Solusi:** Setelah verifikasi data legacy selesai, hentikan dual-write dan hanya tulis ke `responses_v2`.

---

### ⚠️ SERIUS #12: `submissions/repository.js` — Business Logic di SQL

```javascript
// submissions/repository.js line 111, 114 — business rule di repository layer
ROUND(AVG((q7 + q8 + q9 + q11) / 4.0)::numeric, 2) AS avg_ai_adoption,
(COUNT(*) FILTER (WHERE q10 IN ('Sangat Berminat', 'Berminat')) * 100.0 / ...) AS interested_pct
```

"AI adoption = rata-rata q7+q8+q9+q11" adalah business rule. Kalau definisi berubah, harus cari di SQL.

**Solusi:** Repository return raw per-question averages, service hitung composite metric.

---

### ⚠️ SERIUS #13: `ai-prompts/service.js` — Query Kondisional 2/4/6 per Request

**File:** `src/modules/ai-prompts/service.js` (line 147, 153, 156, 165, 174)

```javascript
// Bukan selalu 6 — kondisional berdasarkan scope:
await Promise.all([
  getPromptByStatus(..., scope: 'global', 'draft'),   // ← selalu jalan (1)
  getPromptByStatus(..., scope: 'global', 'published'), // ← selalu jalan (2)
  target.tenantId ? getPromptByStatus(...) : Promise.resolve(null),   // kondisional (3)
  target.tenantId ? getPromptByStatus(...) : Promise.resolve(null),   // kondisional (4)
  target.questionnaireId ? getPromptByStatus(...) : Promise.resolve(null), // kondisional (5)
  target.questionnaireId ? getPromptByStatus(...) : Promise.resolve(null), // kondisional (6)
]);
// Scope global = 2 query, scope tenant = 4 query, scope questionnaire = 6 query
```

Meski kondisional, tetap bisa dikurangi menjadi 1 query dengan SQL IN clause.

---

### ⚠️ SERIUS #14: `bootstrap.js` — Data Migration Tanpa Batch

```javascript
// bootstrap.js line 784-832 — syncResponsesV2FromResponses tanpa LIMIT
INSERT INTO responses_v2 (...) SELECT ... FROM responses WHERE NOT EXISTS (...);
// Bisa INSERT jutaan row dalam satu transaksi → timeout Neon
```

**Solusi:** Tambahkan batching dengan LIMIT 1000 per iterasi.

---

### ⚠️ SERIUS #15: `tenants/service.js` — Langsung Tulis ke Tabel `schools`

**File:** `src/modules/tenants/service.js` (line 74, line 127)

```javascript
// Bypass schools/service — tulis langsung ke tabel schools
await sql`INSERT INTO schools (...) ON CONFLICT DO UPDATE ...`
```

Module tenants seharusnya tidak tahu schema tabel schools. Kalau schema berubah, harus update dua tempat.

---

## 4. Masalah Arsitektur — Technical Debt Jangka Menengah

### 🟡 ARSITEKTUR #16: Duplikasi Module Legacy vs Baru

| Module Lama (LEGACY) | Module Baru | Catatan |
|---|---|---|
| `src/modules/submission/` | `src/modules/submissions/` | Legacy dipertahankan untuk rollback path |
| `src/modules/form/` | `src/modules/forms/` | Legacy dipertahankan untuk rollback path |
| `src/lib/db/client.js` | `src/lib/db/sql.js` | client.js belum jelas apakah dipakai rollback |
| `worker.js` (root) | `src/worker.js` | Root worker zombie |
| `src/server.js` | `src/worker.js` | Dipertahankan untuk `legacy:dev` dan `legacy:start` |
| `src/app/routes.js` | `src/worker.js` (routing) | Dipertahankan untuk rollback |

> **⚠️ KOREKSI dari V3 awal:** File legacy TIDAK bisa langsung dihapus. `package.json` (line 16-17) eksplisit punya script `legacy:dev` dan `legacy:start` sebagai rollback path operasional. Penghapusan perlu keputusan tim (rollback policy), bukan cleanup teknis semata.

---

### 🟡 ARSITEKTUR #17: `questionnaires/service.js` adalah God Module (>1100 Baris)

> **⚠️ KOREKSI dari V3 awal:** Bukan "700+ baris" tapi **sudah >1100 baris**.

Satu file melakukan 8+ hal berbeda: CRUD, response submission, analytics, CSV export, AI data prep, segmentation, filter utils. Harus dipecah (lihat Fase 5 di §7).

---

### 🟡 ARSITEKTUR #18: `bootstrap.js` Terlalu Besar (>1100 Baris)

> **⚠️ KOREKSI dari V3 awal:** Bukan "600+ baris" tapi **sudah >1100 baris**.

Melakukan schema creation, migration, seeding, dan verification sekaligus.

---

### 🟡 ARSITEKTUR #19: `analytics/service.js` adalah Wrapper Kosong

Seluruh isinya hanya 3 fungsi yang mendelegasi ke submissions. Analytics nyata ada di questionnaires/service. Ini terbalik.

---

### 🟡 ARSITEKTUR #20: Duplikasi Fungsi Utility

| Fungsi | Lokasi yang Terkonfirmasi Duplikat |
|---|---|
| `escapeCsvValue` | `questionnaires/service.js:304`, `submissions/service.js:16`, `submission/service.js:104` |
| `slugify` | `schools/service.js:7`, `tenants/service.js:17` |

> **⚠️ KOREKSI dari V3 awal:** `normalizeFromFilter`/`normalizeToFilter`/`normalizeDays`/`normalizePage` **hanya ada di `questionnaires/service.js`** (line 339, 344, 365, 377) — tidak terduplikasi di `submissions/service.js` atau `ai/service.js`. Klaim duplikasi fungsi normalize di V3 awal tidak akurat.

---

### 🟡 ARSITEKTUR #21: Superadmin `school_id = NULL` — Trade-off Desain Eksplisit

**File:** `src/lib/db/bootstrap.js` (line 139-142), `src/modules/auth/repository.js` (line 117, 120)

```sql
-- bootstrap.js line 139-142 — eksplisit CHECK constraint
CHECK (
  (role = 'superadmin' AND school_id IS NULL)   -- ← disengaja!
  OR
  (role = 'school_admin' AND school_id IS NOT NULL)
),
```

> **⚠️ KOREKSI dari V3 awal:** Ini bukan "kejanggalan implementasi tak sengaja" — ini adalah **keputusan desain yang eksplisit** dengan CHECK constraint yang mendukungnya. Desain ini membuat authorization logic lebih kompleks (harus selalu cek `hasSuperadmin` dulu sebelum cek school_id), tapi ini adalah trade-off yang disengaja dan terdokumentasi di schema.

---

### 🟡 ARSITEKTUR #22: `public/` Folder — Dua UI untuk Hal yang Sama

```
public/
├── dashboard.html   ← Legacy (auth Basic Auth)
├── index.html       ← Legacy (single school)
├── admin/           ← Aktif (multi-tenant admin)
└── forms/           ← Aktif (multi-tenant form)
```

Legacy UI masih bisa diakses via URL langsung.

---

### 🟡 ARSITEKTUR #23: `ai/service.js` — 8+ Dependency

Import dari 8+ module berbeda termasuk bypass `questionnaires/repository` langsung (melewati service layer). Harus dijadikan orchestrator di router layer, bukan service layer.

---

## 5. Status Modular Monolith — Verdict Final

> **VERDICT: 4/10 — Strukturnya ada, implementasinya bocor di banyak tempat.**

**Yang SUDAH modular:**
- `auth/` — batas domain jelas
- `ai-prompts/` — single responsibility
- `submissions/validation.js` — pure function

**Yang BELUM modular:**
- `questionnaires/service.js` — God Module, 8+ tanggung jawab
- `analytics/service.js` — empty wrapper
- `ai/service.js` — 8+ dependency
- `forms/repository.js` — import dari bootstrap (coupling salah)
- `questionnaires/repository.js` — import dari bootstrap dan forms/core
- `tenants/service.js` — tulis langsung ke tabel schools

---

## 6. Peta Dependency Antar Module

### Dependency yang SALAH (harus diperbaiki):

```
forms/repository ──────────→ lib/db/bootstrap         ← SALAH (repo→infra)
questionnaires/repository ─→ lib/db/bootstrap (const) ← SALAH (repo→infra)
questionnaires/repository ─→ forms/core               ← SALAH (cross-domain)
tenants/service ───────────→ auth/repository           ← SALAH (cross-domain)
tenants/service ───────────→ schools table (SQL)       ← SALAH (bypass module)
schools/service ───────────→ auth/repository           ← SALAH (cross-domain)
schools/service ───────────→ questionnaires/service    ← coupling dalam
ai/service ────────────────→ questionnaires/repository ← bypass service layer
ai/service ────────────────→ lib/db/bootstrap          ← SALAH (service→infra)
auth/service ──────────────→ hono/cookie               ← SALAH (service→framework)
```

### Dependency yang BENAR:

```
questionnaires/repository → lib/db/sql        ← BENAR (untuk SQL)
submissions/validation    → zod               ← BENAR
ai-prompts/service        → ai/modes          ← BENAR (shared constant)
```

---

## 7. Action Plan Bertahap

### FASE 1 — Quick Wins Security (1-2 hari)

| # | Aksi | File | Effort |
|---|---|---|---|
| 1a | Jalankan SQL migration `password_iterations` | DB migration | 10 menit |
| 1b | Update `auth/repository.js` support kolom iterations | auth/repository.js | 30 menit |
| 1c | Implementasi rehash bertahap di login | auth/service.js | 45 menit |
| 2 | Tambah limit 10.000 di analytics aggregation | questionnaires/service.js line 1156, 1198 | 5 menit |
| 3 | Tambah Cloudflare WAF rate limiting untuk login | Cloudflare Dashboard | 10 menit |
| 4 | Upgrade `monitorAdminOrigin` → `enforceAdminOrigin` (block) | request-guards.js | 30 menit |
| 5 | Rename `session.is_active` → `session.user_is_active` | auth/repository.js, auth/service.js | 15 menit |

> ⚠️ **URUTAN KRITIS PBKDF2:** Langkah 1a (SQL migration) WAJIB selesai dan diverifikasi di DB SEBELUM deploy 1b dan 1c.

---

### FASE 2 — Fix AI Double Computation (2-3 hari)

```javascript
// Buat fungsi baru: single aggregation pass untuk AI
export async function getAggregationForAi(env, filters) {
  const [responses, stats] = await Promise.all([
    listQuestionnaireResponsesForAggregation(env, filters, 10000),
    getQuestionnaireSummaryStatsV2(env, filters),
  ]);
  const distribution = computeDistribution(fields, responses);
  return { responses, stats, distribution };
}
// ai/service.js: panggil getAggregationForAi, bukan dua fungsi terpisah
```

---

### FASE 3 — Bersihkan Constants dan Utilities (1-2 hari)

```
BUAT:
src/lib/constants.js
  ← DEFAULT_QUESTIONNAIRE_NAME, DEFAULT_QUESTIONNAIRE_SLUG (pindah dari bootstrap)
  ← LEGACY_SCHOOL_SLUG, dll

src/lib/utils/
├── csv.js    ← escapeCsvValue (pindah dari 3 file)
└── slug.js   ← slugify (pindah dari 2 file)
```

Setelah ini, `questionnaires/repository.js` tidak perlu import dari `bootstrap.js` lagi.

---

### FASE 4 — Pindahkan Legacy ke Archive (Keputusan Operasional)

> **CATATAN:** Langkah ini perlu keputusan tim tentang rollback policy, bukan cleanup teknis otomatis.

```
Setelah tim memutuskan tidak perlu rollback ke Express:
1. Update package.json: hapus legacy:dev dan legacy:start
2. Pindahkan ke legacy/ folder: src/server.js, src/app/routes.js
3. Arsipkan: src/modules/form/, src/modules/submission/
4. Hapus: src/lib/db/client.js (verifikasi tidak ada yang import)
```

Sebelum hapus:
```bash
grep -r "from.*db/client" src/
grep -r "from.*modules/form'" src/
grep -r "from.*modules/submission'" src/
```

---

### FASE 5 — Perbaiki Module Boundaries (1-2 minggu)

#### 5a. Pisahkan auth/service dari Hono
```javascript
export async function loginWithEmailPassword(env, email, password) {
  return { ok: true, signedToken, user, memberships };
}
// Di router: setCookie(c, result.signedToken, ...)
```

#### 5b. Buat `src/lib/db/form-versions.js`
Pindahkan `ensureDraftVersion`, `ensurePublishedVersion` ke sini. Update imports di `forms/repository.js` dan `bootstrap.js`.

#### 5c. Buat module `users/`
```
src/modules/users/
├── service.js    ← createUser, findUser (pindah dari auth/repository)
└── repository.js ← DB operations untuk tabel users
```

#### 5d. Fix tenants/service — jangan tulis langsung ke schools
```javascript
import { upsertSchoolRecord } from '../schools/service.js';
await upsertSchoolRecord(env, { id: created.id, slug, name, isActive: true });
```

---

### FASE 6 — Refactor God Modules (2-3 minggu)

```
questionnaires/service.js (>1100 baris) → pecah menjadi:
├── questionnaires/service.js         ← CRUD & version (~200 baris)
├── questionnaires/response-service.js ← submission logic
├── analytics/service.js              ← orchestrator (isi konten nyata)
├── analytics/distribution.js         ← computeDistribution, segmentation
└── analytics/trend.js                ← trend aggregation

bootstrap.js (>1100 baris) → pecah menjadi:
├── lib/db/bootstrap.js               ← hanya verifySchemaReady
├── lib/db/form-versions.js           ← ensureDraftVersion, ensurePublishedVersion
└── scripts/migrate-*.sql             ← versioned migrations
```

---

### FASE 7 — Pindahkan Analytics ke Database (3-4 minggu)

```sql
-- Contoh: distribution dihitung di DB, bukan di JS
SELECT
  kv.key AS field_name,
  kv.value AS answer_value,
  COUNT(*) AS total
FROM responses_v2,
  jsonb_each_text(answers) AS kv(key, value)
WHERE questionnaire_id = $1
GROUP BY kv.key, kv.value
ORDER BY kv.key, total DESC;
```

---

## 8. Acceptance Criteria per Perbaikan

### AC-1: PBKDF2 Migration
- [ ] User lama (hash 10k iterasi) masih bisa login setelah migration
- [ ] User lama yang login akan otomatis di-rehash ke 600k (verify kolom `password_iterations` di DB berubah)
- [ ] User baru langsung pakai 600k iterasi
- [ ] Smoke e2e (`pnpm smoke:e2e`) tetap lulus setelah deployment
- [ ] Tidak ada error di log Cloudflare Worker selama 24 jam pertama

### AC-2: Rate Limiting Login
- [ ] Request ke-6 dalam 60 detik dari IP yang sama mendapat 429
- [ ] Login normal (< 5 attempt) tetap berjalan

### AC-3: Analytics Limit
- [ ] Request analytics untuk tenant besar (>10k response) selesai < 5 detik
- [ ] Memory usage Worker tidak melebihi 64MB saat analytics request
- [ ] Hasil analytics identik dengan sebelumnya (sample check manual)

### AC-4: AI Single Pass
- [ ] P95 latency endpoint AI turun minimal 30% dibanding baseline
- [ ] CPU time Worker untuk AI request turun
- [ ] Hasil analisis AI tetap akurat (manual spot check)

### AC-5: CSRF Enforce
- [ ] Request mutasi admin dengan `Origin` berbeda mendapat 403
- [ ] Request mutasi admin dari origin yang sama tetap berhasil
- [ ] Smoke e2e tetap lulus

---

## 9. Target Arsitektur Ideal

```
src/
├── worker.js                    ← Router + middleware ONLY
│
├── lib/
│   ├── constants.js             ← BARU: shared constants
│   ├── db/
│   │   ├── sql.js               ← Satu-satunya DB client
│   │   ├── bootstrap.js         ← Hanya verifySchemaReady
│   │   └── form-versions.js     ← BARU: ensureDraftVersion, ensurePublishedVersion
│   ├── http/
│   │   ├── request-guards.js    ← enforceAdminOrigin (bukan hanya monitor)
│   │   └── session-cookie.js
│   ├── security/
│   │   ├── hash.js              ← PBKDF2 dengan per-user iterations
│   │   └── signature.js
│   └── utils/
│       ├── csv.js               ← BARU: escapeCsvValue
│       └── slug.js              ← BARU: slugify
│
└── modules/
    ├── auth/                    ← Authentication ONLY (no HTTP coupling)
    ├── users/                   ← BARU: user management (pindah dari auth/repository)
    ├── tenants/                 ← Tenant CRUD (tidak tulis ke schools langsung)
    ├── schools/                 ← School CRUD (tidak import dari auth/repository)
    ├── questionnaires/          ← Questionnaire CRUD & version ONLY
    ├── responses/               ← Response submission (RENAME dari submissions)
    ├── analytics/               ← Analytics computation (diisi konten nyata)
    │   ├── service.js           ← Orchestrator
    │   ├── distribution.js      ← computeDistribution
    │   └── trend.js
    ├── ai/                      ← AI orchestration (single aggregation pass)
    │   ├── service.js           ← Coordinator (max 4 dependency)
    │   ├── gemini-client.js     ← BARU: HTTP client ke Gemini
    │   └── prompt-builder.js    ← BARU: prompt construction
    ├── ai-prompts/              ← AI prompt template management
    └── forms/                   ← Form version management (legacy compat)
```

### 5 Prinsip yang Harus Dijaga:

1. **Repository hanya import dari `lib/db/sql.js`** dan `lib/constants.js` — tidak import dari module lain atau bootstrap
2. **Service tidak coupling ke HTTP framework** — tidak ada `setCookie`, `c.req.json()` di service layer
3. **Setiap module hanya menulis ke tabelnya sendiri** — tenants tidak tulis ke schools
4. **Shared code ada di `lib/utils/` atau `lib/constants.js`** — tidak diduplikasi
5. **Satu aggregation pass untuk AI** — tidak load data dua kali dalam satu request

---

## 10. Nilai Akhir per Aspek

| Aspek | Nilai | Catatan |
|---|---|---|
| **Fungsionalitas** | 8/10 | Fitur lengkap, sudah production, smoke:e2e lulus |
| **Security** | 4/10 | PBKDF2 butuh migrasi, no rate limit, CSRF medium risk |
| **Architecture** | 5/10 | Struktur ada, coupling bocor di banyak tempat |
| **Modular Monolith** | 4/10 | God Module, circular-like deps, repo import bootstrap |
| **Code Quality** | 5/10 | Duplikasi (escapeCsvValue, slugify), business logic di SQL |
| **Reliability** | 5/10 | In-memory analytics + AI double computation berbahaya |
| **Maintainability** | 4/10 | >1100 baris di 2 file utama, legacy code membingungkan |
| **Testability** | 3/10 | auth/service coupling ke Hono, tidak ada unit test |
| **Developer Experience** | 4/10 | 14 modules, dua set legacy, tidak ada test coverage |

**Nilai Keseluruhan: 4.7/10**

---

## Kesimpulan Final

App ini **berhasil dalam hal fungsionalitas** — sudah production, smoke:e2e lulus, fiturnya impressive. Developer yang membangun ini kompeten.

**3 hal yang paling mendesak (urut prioritas):**

1. **PBKDF2 migration** — jalankan SQL migration dulu, lalu deploy kode rehash bertahap. Jangan ganti konstanta langsung. Risiko: downtime login total.
2. **Analytics hard cap + AI single pass** — 5 menit fix untuk limit, 1-2 hari untuk single pass. Tanpa ini, tenant besar bisa crash Worker.
3. **Enforce CSRF origin check** — upgrade `monitorAdminOrigin` menjadi block, bukan hanya log.

---

*Laporan ini menggabungkan temuan dari 3 sesi review mendalam + validasi cross-check oleh dev terhadap source code aktual (pnpm smoke:e2e lulus 2026-02-18).*

*Versi V3.1 mengkoreksi 9 poin dari V3 awal: 3 koreksi faktual (repository imports, query count, file sizes), 3 koreksi framing (CSRF severity, superadmin design, legacy files), 1 koreksi rekomendasi berbahaya (PBKDF2 strategy), dan 2 penambahan baru (AI double computation + acceptance criteria).*

---

**© 2026 — Analisis oleh Claude Sonnet (Anthropic) untuk AITI Global Nexus**  
**Dokumen ini adalah milik tim AITI. Harap tidak disebarkan ke publik.**
