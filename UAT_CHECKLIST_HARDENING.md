# UAT Checklist Hardening (Root Helper Pointer)

Status: POINTER (non-canonical helper)
As of: 2026-02-23

Dokumen checklist UAT hardening yang canonical ada di:
- `docs/UAT_CHECKLIST_HARDENING.md`

Tujuan file root ini:
- memudahkan akses cepat dari editor yang membuka file root dulu.
- mencegah drift isi antara root dan `docs/`.

Aturan:
1. Semua update konten checklist harus dilakukan di `docs/UAT_CHECKLIST_HARDENING.md`.
2. File root ini tidak dipakai sebagai sumber status final release.
3. Status release tetap diverifikasi melalui:
   - `docs/DEBT_REGISTER_LOCKED.md`
   - `docs/DEBT_CLOSURE_REPORT.md`
   - `docs/UAT_FINAL_RELEASE_REPORT_*.md` (active vs archived sesuai `docs/DOCS_INDEX.md`)
