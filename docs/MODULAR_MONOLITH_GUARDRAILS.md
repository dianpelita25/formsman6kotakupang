# Modular Monolith Guardrails

Dokumen ini adalah kontrak arsitektur agar boundary module tetap bersih saat code berubah.

## Tujuan
1. Mencegah kebocoran dependency antar module.
2. Menahan technical debt baru sebelum masuk ke branch utama.
3. Menjaga arah refactor menuju modular monolith yang strict.

## Rule yang dicek otomatis
Checker: `scripts/check-modular-boundaries.js`

1. `REPOSITORY_IMPORT_BOUNDARY`
- Berlaku untuk `src/modules/**/repository.js`.
- Repository hanya boleh import:
  - `../../lib/db/sql.js`
  - file lokal (`./*`)

2. `SERVICE_FRAMEWORK_COUPLING`
- Berlaku untuk `src/modules/**/service.js`.
- Service tidak boleh import `hono/*`.

3. `SERVICE_BOOTSTRAP_COUPLING`
- Service tidak boleh import `lib/db/bootstrap.js`.

4. `SERVICE_DIRECT_DB_CLIENT`
- Service tidak boleh import `lib/db/sql.js` atau `lib/db/client.js`.

5. `SERVICE_CROSS_MODULE_REPOSITORY_IMPORT`
- Service tidak boleh import repository module lain langsung.
- Contoh terlarang: `../auth/repository.js` dari module selain `auth`.

6. `SERVICE_RAW_SQL_WRITE`
- Service tidak boleh melakukan SQL write langsung (`INSERT/UPDATE/DELETE`) via template `sql\`\``.

## Guardrail tambahan

1. `scripts/check-module-cycles.js`
- Tidak boleh ada cycle lintas module pada `src/modules/**`.

2. `scripts/check-file-budgets.js`
- Budget line count per layer diberlakukan dengan baseline untuk debt lama.
- File yang sudah melebihi budget tidak boleh bertambah dari baseline.

3. `scripts/check-frontend-boundaries.js`
- Frontend page module tidak boleh import relatif lintas page module.
- Tidak boleh import `public/shared/admin/*/runtime.js` (bridge runtime hanya untuk kompatibilitas sementara).

4. `scripts/check-legacy-boundary.js`
- Code non-legacy dilarang import dari `src/legacy/**`.

5. `scripts/check-duplication-canonicals.js`
- Declaration point canonical (contoh: `slugify`, `escapeCsvValue`, `LEGACY_SCHOOL_SLUG`, `parseJson`) dikunci lewat policy allowlist.
- Declaration baru di luar allowlist dianggap regresi debt.

6. `scripts/check-debt-register.js`
- `docs/DEBT_REGISTER_LOCKED.md` wajib valid (kolom wajib, status sah, proof wajib untuk status `CLOSED`).
- Closure debt tidak boleh by-claim, harus by-gate + proof.

## Cara pakai
1. Cek normal (untuk dev harian):
```bash
pnpm check:modularity
```

2. Cek strict (tanpa waiver):
```bash
pnpm check:modularity:strict
```

3. Update baseline waiver (hanya saat review arsitektur disetujui):
```bash
pnpm check:modularity:update-waivers
```

4. Cek arsitektur lengkap:
```bash
pnpm check:architecture
```

5. Cek duplication lock:
```bash
pnpm check:duplication
```

6. Cek debt register lock:
```bash
pnpm check:debt-register
```

## Waiver policy
1. Waiver hanya untuk debt lama yang belum sempat direfactor.
2. Jangan tambah waiver untuk shortcut implementasi baru.
3. Kalau violation sudah diperbaiki, hapus waiver stale.
4. File baseline waiver: `scripts/modularity-waivers.json`.

## Checklist PR (wajib)
1. Jalankan `pnpm check:modularity`.
2. Jalankan smoke test yang relevan (`pnpm smoke:e2e` minimal).
3. Pastikan tidak ada violation baru.
