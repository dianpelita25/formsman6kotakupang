# Validasi Ulang CODE_REVIEW_V3 (Siap Kirim ke Dev)

Tanggal: 2026-02-18  
Validator: Codex (berdasarkan source code aktual di repo ini)

## Cara verifikasi
1. Verifikasi statis langsung ke source code (`src/**`, `public/**`, `wrangler.toml`, `package.json`).
2. Verifikasi runtime cepat dengan `pnpm smoke:e2e` (status: lulus).

---

## Temuan Prioritas (Benar dan Perlu Ditindak)

### 1) Login belum punya rate limiting (valid, high risk)
- Endpoint login ada di `src/worker.js:247`.
- Tidak ada limiter pada route tersebut (tidak ada guard rate-limit sebelum handler login).
- Pencarian pola limiter juga tidak menunjukkan mekanisme khusus login.
- Dampak: brute force password lebih mudah.
- Rekomendasi: tambah WAF rate rule + fallback aplikasi (KV/DO) untuk lockout/slowdown.

### 2) Analytics questionnaire masih bisa load semua response ke memory (valid, high risk)
- Summary memuat data tanpa limit: `src/modules/questionnaires/service.js:1156`.
- Distribution memuat data tanpa limit: `src/modules/questionnaires/service.js:1198`.
- Fungsi repository memang mengizinkan no-limit jika `limit` null: `src/modules/questionnaires/repository.js:645`, `src/modules/questionnaires/repository.js:647`, `src/modules/questionnaires/repository.js:685`.
- Dampak: memory/latency spike untuk tenant besar.
- Rekomendasi: hard cap + agregasi SQL bertahap.

### 3) AI analysis memanggil analytics berat berulang dalam request yang sama (valid, high risk)
- `analyzeTenantQuestionnaireAi` menjalankan:
  - `getTenantQuestionnaireAnalyticsSummary` dan
  - `getTenantQuestionnaireAnalyticsDistribution`
  secara paralel di `src/modules/ai/service.js:259`.
- Kedua fungsi di atas sama-sama melakukan scan response besar (lihat poin #2).
- Dampak: query/CPU dobel per 1 request AI.
- Rekomendasi: gabungkan jalur data analytics untuk AI (single aggregation pass).

### 4) CSRF guard saat ini hanya monitor origin, belum enforce block (valid, medium risk)
- `monitorAdminOrigin` hanya log mismatch lalu lanjut: `src/lib/http/request-guards.js:46`.
- Middleware ini dipasang di admin API: `src/worker.js:174`, `src/worker.js:176`, `src/worker.js:181`, `src/worker.js:183`.
- Catatan mitigasi yang SUDAH ada:
  - Cookie `SameSite=Lax`: `src/lib/http/session-cookie.js:15`
  - Guard JSON mutation payload: `src/lib/http/request-guards.js:23`
- Kesimpulan: klaim "belum ada CSRF enforcement" benar, tapi bukan kondisi tanpa mitigasi sama sekali.

### 5) PBKDF2 masih 10.000 iterasi (valid), tapi rencana upgrade di dokumen perlu koreksi implementasi
- Iterasi default: `src/lib/security/hash.js:2`.
- Verifikasi password pakai default ini juga: `src/lib/security/hash.js:48`.
- Login memverifikasi hash tanpa metadata iterasi per user: `src/modules/auth/service.js:77`.
- Schema user saat ini tidak menyimpan iteration per-user:
  - `password_hash`, `password_salt` saja di `src/lib/db/bootstrap.js:126`, `src/lib/db/bootstrap.js:127`.
- Dampak: kalau konstanta diganti langsung tanpa strategi compat, login lama berisiko gagal.
- Rekomendasi: simpan metadata algoritma/iterasi per user (atau format hash self-describing), lalu rehash bertahap saat login sukses.

---

## Temuan Arsitektur yang Benar (Confirmed)

### 6) `auth/service` coupling ke Hono context (valid)
- Service menerima `c`, parse body langsung, set cookie langsung:
  - `src/modules/auth/service.js:52`
  - `src/modules/auth/service.js:62`
  - `src/modules/auth/service.js:106`

### 7) `session.is_active` valid secara runtime tapi naming membingungkan (valid)
- Query session select `u.is_active`: `src/modules/auth/repository.js:73`.
- Service cek `session.is_active`: `src/modules/auth/service.js:149`.
- Ini bukan bug fatal saat ini, tapi naming ambigu.

### 8) `forms/repository` import dari bootstrap (valid)
- `src/modules/forms/repository.js:2`.

### 9) `tenants/service` menulis langsung ke tabel `schools` (valid)
- Insert/update langsung: `src/modules/tenants/service.js:74`, `src/modules/tenants/service.js:127`.

### 10) `analytics/service` sekarang wrapper tipis (valid)
- Seluruh isi praktis delegasi: `src/modules/analytics/service.js:1`.

### 11) Legacy hardcoded schema `responses` q1..q12 masih aktif untuk jalur school lama (valid)
- Hardcoded insert: `src/modules/submissions/repository.js:6`, `src/modules/submissions/repository.js:12`.
- Dual-write ke v2 masih aktif: `src/modules/submissions/service.js:123`.

### 12) Business metric dikunci di SQL (`avg_ai_adoption`, `interested_pct`) (valid)
- `src/modules/submissions/repository.js:111`, `src/modules/submissions/repository.js:114`.

---

## Klaim V3 yang Perlu Koreksi (Penting untuk dikembalikan ke dev reviewer)

### A) "`questionnaires/repository` clean, hanya import `sql.js`" -> tidak akurat
- Faktanya juga import bootstrap constants:
  - `src/modules/questionnaires/repository.js:2`

### B) "6 query paralel per request ai-prompts" -> parsial
- Struktur `Promise.all` memang ada: `src/modules/ai-prompts/service.js:147`.
- Tapi query tenant/questionnaire bersifat kondisional dan bisa `Promise.resolve(null)`:
  - `src/modules/ai-prompts/service.js:153`
  - `src/modules/ai-prompts/service.js:156`
  - `src/modules/ai-prompts/service.js:165`
  - `src/modules/ai-prompts/service.js:174`
- Jadi bukan selalu 6 query DB nyata.

### C) "Duplikasi normalizeFrom/To/Days/Page ada di submissions + ai" -> tidak akurat
- Fungsi normalize tersebut berada di `questionnaires/service`:
  - `src/modules/questionnaires/service.js:339`
  - `src/modules/questionnaires/service.js:344`
  - `src/modules/questionnaires/service.js:365`
  - `src/modules/questionnaires/service.js:377`
- `submissions/service` tidak mendefinisikan fungsi normalize tersebut.
- Duplikasi yang benar-benar ada:
  - `escapeCsvValue`: `src/modules/questionnaires/service.js:304`, `src/modules/submissions/service.js:16`, `src/modules/submission/service.js:104`
  - `slugify`: `src/modules/schools/service.js:7`, `src/modules/tenants/service.js:17`

### D) "Semua legacy file aman dihapus karena tidak dipakai production" -> terlalu simplistik
- `src/server.js` dan `src/app/routes.js` memang jalur legacy.
- Tetapi repo masih sengaja expose rollback scripts:
  - `package.json:16`
  - `package.json:17`
- Artinya hapus legacy perlu keputusan operasional (rollback policy), bukan sekadar cleanup langsung.

### E) "Superadmin di `school_memberships` dengan `school_id=NULL` adalah design aneh" -> framing perlu diluruskan
- Design ini eksplisit didukung constraint:
  - `src/lib/db/bootstrap.js:139`
  - `src/lib/db/bootstrap.js:140`
  - `src/lib/db/bootstrap.js:142`
- Insert role superadmin juga konsisten:
  - `src/modules/auth/repository.js:117`
  - `src/modules/auth/repository.js:120`
- Jadi ini keputusan model data, bukan kejanggalan implementasi tak sengaja.

### F) "bootstrap.js 600+ baris" / "questionnaires/service.js 700+ baris" -> angka sudah tidak update
- Ukuran aktual saat ini lebih besar:
  - `src/lib/db/bootstrap.js` >1100 baris
  - `src/modules/questionnaires/service.js` >1100 baris
- Pesan utamanya tetap benar: kedua file oversized.

---

## Catatan Operasional Production (verifikasi tambahan)

### 1) Runtime worker utama memang `src/worker.js`
- `wrangler.toml:2`

### 2) Bootstrap mode production memang `check`
- `wrangler.toml:47`
- Sejalan dengan `resolveBootstrapMode` di `src/lib/db/bootstrap.js:41`.

### 3) Meskipun begitu, fungsi migrasi data besar tetap ada di bootstrap full mode
- `syncResponsesV2FromResponses` no-batch: `src/lib/db/bootstrap.js:784`, `src/lib/db/bootstrap.js:832`.
- Jadi risk tetap relevan untuk env yang menjalankan mode full.

---

## Ringkasan Status Klaim V3 (Singkat)

- Valid/tepat: mayoritas temuan security dan boundary arsitektur utama.
- Parsial/perlu revisi: CSRF severity, ai-prompts "selalu 6 query", utility duplication detail.
- Tidak akurat: klaim `questionnaires/repository` hanya import `sql.js`.

---

## Bukti Runtime

- `pnpm smoke:e2e` dijalankan dan lulus seluruh checkpoint pada 2026-02-18.
