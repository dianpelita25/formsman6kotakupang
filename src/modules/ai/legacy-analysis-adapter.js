import { LEGACY_SCHOOL_SLUG } from '../../lib/db/bootstrap/constants.js';
import { resolveSchoolBySlug } from '../schools/service.js';
import { AI_ANALYSIS_MODES } from '../shared/ai-modes.js';
import { analyzeSchoolAi, getLatestSchoolAi } from './school-analysis-service.js';

async function resolveLegacySchool(env) {
  const legacySlug = String(env?.LEGACY_SCHOOL_SLUG || LEGACY_SCHOOL_SLUG).trim() || LEGACY_SCHOOL_SLUG;
  const school = await resolveSchoolBySlug(env, legacySlug, { onlyActive: false });
  if (!school) {
    throw new Error('Sekolah legacy tidak ditemukan.');
  }
  return school;
}

export async function analyzeAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const school = await resolveLegacySchool(process.env);
  return analyzeSchoolAi(process.env, { school, mode });
}

export async function getLatestAi({ mode = AI_ANALYSIS_MODES.INTERNAL } = {}) {
  const school = await resolveLegacySchool(process.env);
  return getLatestSchoolAi(process.env, { school, mode });
}
