# Legacy Snapshot (Rollback Only)

Folder ini menandai komponen lama yang **bukan runtime utama**.

Runtime utama saat ini:

- `src/worker.js` (Cloudflare Worker + Hono)

Legacy rollback entry:

- `src/server.js` (Express lama)
- `src/app/routes.js`
- `src/modules/form/*`
- `src/modules/submission/*`
- `public/index.html`
- `public/script.js`
- `public/styles.css`
- `public/dashboard.html`
- `public/dashboard.js`
- `public/dashboard.css`

Gunakan legacy hanya jika rollback darurat dibutuhkan.
