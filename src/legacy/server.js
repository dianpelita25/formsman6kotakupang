// ROLLBACK_ONLY: legacy Express server path, jangan tambah fitur baru.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './app/routes.js';

const app = express();
const port = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

app.use(routes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
