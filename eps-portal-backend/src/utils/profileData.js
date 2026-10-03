// Constants for the IB / ISP / Aptitude modules, extracted verbatim from app.py into src/data/profileData.json.
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../data/profileData.json', import.meta.url), 'utf8'));

export const TERMS = data.terms;                         // 'UOI-1' ... 'UOI-6'
export const RATING_SCALE = data.ratingScale;
export const RATING_COLORS = data.ratingColors;
export const LEARNER_PROFILE = data.learnerProfile;      // [{attribute, emoji, description}]
export const ISP_PROFILE = data.ispProfile;              // [{attribute, emoji, descriptions[]}]
export const ATL_SKILLS = data.atlSkills;                // skill -> grade -> descriptor[]
export const ATL_DESCRIPTORS = data.atlDescriptors;
export const APTITUDE_STRANDS = data.aptitudeStrands;

export const LP_ATTRIBUTES = LEARNER_PROFILE.map((a) => a.attribute);
export const ISP_ATTRIBUTES = ISP_PROFILE.map((a) => a.attribute);

// Legacy term names ('Term 2', 'UOI 2', 'UOI+2') -> canonical 'UOI-2'. Used by the Postgres migration.
export function normalizeTerm(raw) {
  const m = String(raw || '').trim().match(/^(?:UOI|Term)[\s\-+_]*(\d+)$/i);
  const canonical = m ? `UOI-${Number(m[1])}` : String(raw || '').trim();
  return TERMS.includes(canonical) ? canonical : null;
}
