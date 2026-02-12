import { analyzeAi } from './service.js';

export async function analyzeAiController(req, res) {
  const expectedKey = process.env.AI_ANALYZE_KEY;
  const providedKey = req.get('X-AI-KEY');

  if (!expectedKey || providedKey !== expectedKey) {
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
