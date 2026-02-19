# Anti-Endless Refactor Protocol

Dokumen ini adalah kontrak eksekusi agar refactor tidak menjadi loop tanpa akhir.
Blueprint aktif mengikuti debt yang masih `OPEN` di `docs/DEBT_REGISTER_LOCKED.md`.
Blueprint D07-D10 sudah selesai dan diarsipkan di `docs/_archive/BLUEPRINT_D07_D10_CLOSURE.md`.

## Tujuan
1. Menutup temuan secara objektif, bukan by-claim.
2. Mencegah pola "tutup 1 lubang, buka 3 lubang baru".
3. Menetapkan titik akhir yang terukur sebelum pindah ke pekerjaan lain.

## Prinsip Kunci
1. Satu sumber kebenaran debt: `docs/DEBT_REGISTER_LOCKED.md`.
2. Closure sah hanya jika `gate + proof`.
3. Satu PR hanya satu Debt ID.
4. Tidak ada scope creep diam-diam.
5. Tidak ada waiver baru tanpa review arsitektur formal.

## Branch Policy (Wajib)
1. Base integrasi resmi: `backup/wip-20260218-1746`.
2. Semua PR debt merge ke base integrasi resmi dulu.
3. `main` harus disinkronkan berkala dari base integrasi resmi agar tidak drift.
4. Proof commit untuk closure harus SHA yang sudah ada di base integrasi resmi, bukan SHA lokal.

## State Machine Debt (Locked)
1. Transisi yang sah: `OPEN -> IN_PROGRESS -> READY_FOR_CLOSE -> CLOSED`.
2. `OPEN`: temuan baru sudah tercatat dengan scope dan owner.
3. `IN_PROGRESS`: ada PR aktif yang jelas untuk debt tersebut.
4. `READY_FOR_CLOSE`: code selesai dan gate lulus, menunggu proof merge + CI.
5. `CLOSED`: hanya boleh setelah proof merge + CI hijau lengkap.

## Rule Anti-Loop (Non-Negotiable)
1. Dilarang menutup debt tanpa update register.
2. Dilarang menutup debt jika checker belum mengunci regresi.
3. Dilarang menambah scope PR di luar debt ID yang sedang dikerjakan.
4. Jika muncul temuan baru saat PR berjalan, buat debt ID baru (`DXX`) dan jangan klaim debt lama selesai.
5. Dilarang menambah entry di `scripts/modularity-waivers.json` tanpa persetujuan arsitektur.
6. Dilarang mengubah status `CLOSED` kembali ke status lain tanpa insiden arsitektur resmi.

## Contract PR (Wajib Ada di Deskripsi PR)
1. `Debt ID`
2. `In Scope`
3. `Out of Scope`
4. `Gate Wajib`
5. `Proof Commands`
6. `Risk`
7. `Rollback Plan`

Template singkat:

```md
Debt ID: DXX
In Scope: <file/path>
Out of Scope: <yang sengaja tidak disentuh>
Gate Wajib: <daftar command>
Proof Commands: <ringkas PASS>
Risk: <low/medium/high + alasan>
Rollback Plan: <cara revert aman>
```

## Gate Wajib
Setiap PR debt wajib lulus:
1. `pnpm check:architecture`
2. `pnpm check:debt-register`
3. `pnpm smoke:e2e`

Jika menyentuh dashboard/PDF/frontend admin, tambah:
1. `pnpm smoke:dashboard:pdf`
2. `pnpm visual:legacy-dashboard:diff`
3. `pnpm visual:questionnaire-dashboard:diff`
4. `pnpm smoke:admin:ui`

Jika menyentuh duplication/canonical checker, tambah:
1. `pnpm check:duplication`

Jika menyentuh budget checker/rules, tambah:
1. `pnpm check:file-budgets`

## Definition of Done per Debt ID
Debt ID dianggap selesai hanya jika:
1. Perubahan code sudah merge ke base integrasi resmi.
2. Gate wajib PASS di lokal dan CI.
3. `docs/DEBT_REGISTER_LOCKED.md` terisi:
   - `Status = CLOSED`
   - `Proof Commit`
   - `Proof Commands`
   - `Tanggal Tutup`
4. `docs/DEBT_CLOSURE_REPORT.md` diperbarui sesuai proof.
5. Tidak ada waiver baru.

## Stop Condition (Akhir Siklus)
Siklus refactor dinyatakan selesai jika semua ini benar:
1. Semua Debt ID aktif pada register berstatus `CLOSED`.
2. `pnpm check:architecture` hijau.
3. `pnpm smoke:e2e` hijau.
4. Untuk scope dashboard, smoke/visual/PDF hijau.
5. Tidak ada temuan baru tanpa Debt ID.
6. `main` tidak tertinggal dari base integrasi resmi.

## Controlled Debt Policy
Jika debt belum bisa ditutup sekarang:
1. Harus tetap tercatat sebagai debt aktif.
2. Wajib punya owner, reason, gate lock, dan target sprint.
3. Wajib punya rule ratchet (minimal no-growth).
4. Tidak boleh "hilang" dari register tanpa closure resmi.

## Cadence Operasional
1. Audit debt mingguan (maksimal 30 menit).
2. Satu siklus kerja fokus maksimal 1-2 Debt ID.
3. Setelah 2 debt ditutup, jalankan full verification suite sekali.
4. Setelah suite hijau, freeze dan pindah ke prioritas produk berikutnya.

## Checklist Eksekusi Harian (Praktis)
1. Pilih satu Debt ID dari register.
2. Definisikan scope PR yang sempit.
3. Kerjakan perubahan.
4. Jalankan gate wajib.
5. Buka PR dengan contract lengkap.
6. Merge ke base integrasi.
7. Isi proof dan ubah status debt sesuai state machine.

## Catatan Integritas
Dokumen ini dibuat untuk menghentikan proses tanpa akhir. Jika ada pengecualian, pengecualian harus tertulis dan disetujui reviewer arsitektur.
