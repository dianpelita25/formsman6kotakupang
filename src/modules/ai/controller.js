import { analyzeAi, getLatestAi, normalizeAiAnalysisMode } from './service.js';

const LOCAL_IDENTIFIERS = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']);

function normalizeAddress(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replaceAll('[', '').replaceAll(']', '');
}

function isLocalRequest(req) {
  const hostname = normalizeAddress(req.hostname);
  if (LOCAL_IDENTIFIERS.has(hostname)) {
    return true;
  }

  const hostHeader = normalizeAddress(req.get('host'));
  if (hostHeader) {
    const hostOnly = hostHeader.split(':')[0];
    if (LOCAL_IDENTIFIERS.has(hostOnly)) {
      return true;
    }
  }

  const remoteCandidates = [req.ip, req.socket?.remoteAddress, req.connection?.remoteAddress];
  return remoteCandidates.some((value) => LOCAL_IDENTIFIERS.has(normalizeAddress(value)));
}

function isAuthorized(req) {
  const expectedKey = process.env.AI_ANALYZE_KEY;
  const providedKey = req.get('X-AI-KEY');

  if (expectedKey && providedKey === expectedKey) {
    return true;
  }

  return process.env.DEV_LOCAL_AI_BYPASS === 'true' && isLocalRequest(req);
}

function parseMode(rawMode) {
  const mode = normalizeAiAnalysisMode(rawMode);
  if (!mode) return null;
  return mode;
}

export async function analyzeAiController(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const mode = parseMode(req.body?.mode);
  if (!mode) {
    return res.status(400).json({ message: 'Mode analisa AI tidak valid.' });
  }

  try {
    const result = await analyzeAi({ mode });
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

  const mode = parseMode(req.query?.mode);
  if (!mode) {
    return res.status(400).json({ message: 'Mode analisa AI tidak valid.' });
  }

  try {
    const latest = await getLatestAi({ mode });
    if (!latest) {
      return res.json({ analysis: '', meta: null, createdAt: null, mode });
    }
    return res.json(latest);
  } catch (error) {
    const message = error?.message || 'Gagal mengambil analisa.';
    return res.status(500).json({ message });
  }
}
