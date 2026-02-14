import { analyzeAi, getLatestAi } from './service.js';

function isAuthorized(req) {
  const expectedKey = process.env.AI_ANALYZE_KEY;
  const providedKey = req.get('X-AI-KEY');

  return Boolean(expectedKey && providedKey === expectedKey);
}

export async function analyzeAiController(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const result = await analyzeAi();
    return res.json(result);
  } catch (error) {
    const message = error?.message || 'Gagal menganalisis data.';
    return res.status(500).json({ message });
  }
}

export async function getLatestAiController(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const latest = await getLatestAi();
    if (!latest) {
      return res.json({ analysis: '', meta: null, createdAt: null });
    }
    return res.json(latest);
  } catch (error) {
    const message = error?.message || 'Gagal mengambil analisa.';
    return res.status(500).json({ message });
  }
}
