# Public Dashboard Contract D30

Status: ACTIVE  
Tanggal Lock: 2026-02-20 (updated D50: 2026-02-26)  
Debt ID: D30

## Tujuan

Mengunci kontrak dashboard publik agar read-only, cepat, dan aman untuk konsumsi umum tanpa membuka data respons mentah.

## Route Publik

1. Page:
   - `GET /forms/:tenantSlug/:questionnaireSlug/dashboard/`
2. API:
   - `GET /forms/:tenantSlug/:questionnaireSlug/api/dashboard/summary`
   - `GET /forms/:tenantSlug/:questionnaireSlug/api/dashboard/distribution`
   - `GET /forms/:tenantSlug/:questionnaireSlug/api/dashboard/trend`

## Privacy Lock (Strict Aggregate)

1. Data publik hanya aggregate/read-only.
2. Dilarang kirim field raw/PII:
   - `respondent`
   - `answers`
   - `payload`
   - text samples/contoh jawaban mentah
3. Minimal sampel publik:
   - `minSampleSize = 10`
   - Jika sampel `< 10`, response wajib `status: "insufficient_sample"`.
4. Segment bucket kecil disembunyikan:
   - `minBucketSize = 10`
   - Bucket segment dengan `n < 10` tidak boleh dipublish.

## Kontrak Response

Semua endpoint publik dashboard wajib mengembalikan envelope berikut:

```json
{
  "data": {
    "status": "ok | insufficient_sample",
    "privacy": {
      "minSampleSize": 10,
      "minBucketSize": 10,
      "sampleSize": 0,
      "eligible": false
    }
  }
}
```

Tambahan field per endpoint hanya boleh berupa aggregate ringkas (summary/distribution/trend) dan metadata questionnaire non-sensitive.

## Cache Contract

Semua API publik dashboard wajib mengirim header:

`Cache-Control: public, max-age=60, stale-while-revalidate=120`

## Non-Goals

1. Tidak menambah endpoint write/mutation.
2. Tidak mengubah endpoint admin dashboard existing.
3. Tidak membuka drilldown respons individual di jalur publik.
