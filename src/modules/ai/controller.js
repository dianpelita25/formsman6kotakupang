import { analyzeAi } from './service.js';

function clampDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(7, Math.min(30, parsed));
}

export async function analyzeAiController(req, res) {
  const expectedKey = process.env.AI_ANALYZE_KEY;
  const providedKey = req.get('X-AI-KEY');

  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const days = clampDays(req.body?.days);
    const result = await analyzeAi({ days });
    return res.json(result);
  } catch (error) {
    const message = error?.message || 'Gagal menganalisis data.';
    return res.status(500).json({ message });
  }
}
