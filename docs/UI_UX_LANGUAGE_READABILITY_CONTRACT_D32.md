# UI/UX Language + Readability Contract D32

Status: ACTIVE  
As of: 2026-02-22  
Owner: Frontend Platform + UX QA  
Scope Debt: D32-D37

Dokumen ini mengunci standar copy Bahasa Indonesia dan keterbacaan light mode untuk semua surface modern + legacy pada cycle D32-D37.

## Tujuan

1. Semua label UI user/admin konsisten Bahasa Indonesia (dengan serapan baku).
2. Tidak ada campuran label Inggris pada menu, tombol, helper text, badge status, dan caption tabel.
3. Keterbacaan light mode memenuhi target minimum WCAG AA pada selector kritikal.
4. Enforcement dilakukan otomatis lewat smoke gate CI.

## Non-Scope

1. Tidak mengubah isi kuesioner.
2. Tidak mengubah isi analisis AI.
3. Tidak menambah infrastruktur i18n runtime/bilingual pada cycle ini.
4. Tidak mengubah enum/value backend (`school`, `government`, dan sejenisnya).

## Kamus Copy Locked

| Lama | Baru |
| --- | --- |
| Admin Login | Masuk Admin |
| Logout | Keluar |
| Superadmin | Admin Utama |
| Questionnaire Manager | Manajer Kuesioner |
| Prompt AI Manager | Pengelola Prompt AI |
| Scope | Cakupan |
| tenant override | Override Organisasi |
| questionnaire override | Override Kuesioner |
| Draft Template | Template Draf |
| Publish | Publikasikan |
| Published | Terpublikasi |
| Reset ke Published | Reset ke Versi Terpublikasi |
| Refresh | Muat Ulang |
| Effective Prompt (Aktif Digunakan) | Prompt Efektif (Sedang Digunakan) |
| Total Questionnaire | Total Kuesioner |
| Export CSV | Ekspor CSV |
| [default] | [utama] |

### Mapping Display Tipe Organisasi (Label UI)

1. `school` -> `Sekolah`
2. `government` -> `Pemerintah`
3. `business` -> `Usaha`
4. `class` -> `Kelas`
5. `community` -> `Komunitas`
6. `event` -> `Event`
7. `other` -> `Lainnya`

Catatan: mapping ini hanya untuk label tampilan. Value enum API tetap English.

## Selector Kontras Kritis (Light Mode)

Selector berikut wajib lulus target minimum:

1. `.superadmin-page .status-badge.is-active` (>= 4.5:1)
2. `.superadmin-page .status-badge.is-inactive` (>= 4.5:1)
3. `.questionnaire-dashboard-page .dashboard-kpi-card p` (>= 4.5:1)
4. `.questionnaire-dashboard-page .advanced-viz-insight-card p` (>= 4.5:1)
5. `.questionnaire-dashboard-page .criteria-summary-item p` (>= 4.5:1)
6. `.portal-page .school-meta` (>= 4.5:1)
7. `.public-dashboard-page .metric-card p` (>= 4.5:1)
8. `.public-dashboard-page .distribution-table td` (>= 4.5:1)
9. `.global-nav__link` pada light mode (>= 4.5:1)
10. `.global-nav__theme-toggle` pada light mode (>= 4.5:1)

## Route Audit Wajib

Desktop:

1. `/forms`
2. `/forms/admin/login`
3. `/forms/admin/`
4. `/forms/:tenantSlug/admin/`
5. `/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/builder/`
6. `/forms/:tenantSlug/admin/questionnaires/:questionnaireSlug/dashboard/`
7. `/forms/:tenantSlug/:questionnaireSlug/dashboard/`
8. `/forms/sman6-kotakupang/admin/dashboard/` (legacy)

Mobile:

1. `/forms`
2. `/forms/admin/login`
3. `/forms/admin/`
4. `/forms/:tenantSlug/admin/`
5. `/forms/:tenantSlug/:questionnaireSlug/`
6. `/forms/:tenantSlug/:questionnaireSlug/dashboard/`

## Larangan

1. Dilarang menampilkan label Inggris non-serapan pada UI final route audit.
2. Dilarang mengubah behavior backend/API untuk kebutuhan copy.
3. Dilarang menambah waiver modularity baru untuk pekerjaan ini.

## Gate Automation Locked

1. `pnpm smoke:ux:language-id`
2. `pnpm smoke:ux:contrast-aa`

## Rule Closure Debt

1. D32-D36 hanya bisa `CLOSED` jika gate lock debt masing-masing PASS.
2. D37 hanya bisa `CLOSED` jika gate final local + CI seluruh cycle PASS.
3. Bukti wajib: proof command, proof commit, tanggal tutup, dan screenshot before/after yang dirujuk dari closure report.
