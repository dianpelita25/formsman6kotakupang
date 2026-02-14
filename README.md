# Custom Form Feedback SMAN 1 Kupang (Modular + Neon + pnpm)

Form ini adalah versi custom dari Jotform sumber, dengan:
- **isi pertanyaan & opsi tetap sama**,
- UI lebih **profesional & elegan**,
- arsitektur **modular**,
- backend **Express**,
- database **Neon PostgreSQL**,
- package manager **pnpm**.

## 1) Setup

```bash
pnpm install
```

Copy env:

```bash
copy .env.example .env
```

Isi `.env`:

```env
PORT=3000
DATABASE_URL=postgres://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
AI_ANALYZE_KEY=your-ai-shared-secret
DEV_LOCAL_AI_BYPASS=false
```

## 1.1 Testing AI di localhost (dev only)

Jika ingin klik tombol Analisa langsung dari `localhost` tanpa Worker inject header:

```env
DEV_LOCAL_AI_BYPASS=true
```

Setelah selesai testing lokal, kembalikan lagi ke:

```env
DEV_LOCAL_AI_BYPASS=false
```

Production harus tetap `false`.

## 2) Jalankan aplikasi

```bash
pnpm dev
```

Atau mode normal:

```bash
pnpm start
```

Jika port `3000` dipakai proses lain:

```bash
set PORT=3001 && pnpm start
```

## 3) Endpoint

- `GET /api/form-schema` → schema form (meta + field) untuk render front-end.
- `POST /api/submit` → simpan data feedback ke Neon.
- `GET /health` → health check.

## 4) Struktur modular

```text
src/
  app/
    routes.js
  lib/
    db/client.js
  modules/
    form/
      schema.js
      controller.js
    submission/
      validation.js
      repository.js
      service.js
      controller.js
  server.js

public/
  index.html
  styles.css
  script.js

db/
  schema.sql
```

## 5) Tabel database

SQL ada di `db/schema.sql`.

Server juga otomatis menjalankan `CREATE TABLE IF NOT EXISTS form_responses` saat submit pertama.

## 6) Catatan untuk deploy ke website kalian

- Frontend sudah clean dan siap di-embed/di-host di domain kalian.
- Supaya submit tersimpan ke Neon, pastikan backend Node ini ikut dideploy (atau dijadikan service API terpisah).
- Untuk integrasi ke `https://aitiglobal.link/formsman1kupang`, arahkan route/hosting ke app ini.
