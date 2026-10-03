// Same weighting as compute_aptitude() in app.py, but computed in memory from already-loaded mark sheets
// so a whole class costs one database query instead of dozens per student.
import { APTITUDE_STRANDS } from './profileData.js';
import { safeAvg } from './math.js';

const pct = (m, max) => (max > 0 ? Math.round((m / max) * 1000) / 10 : null);

// sheets: lean MarkSheet docs (any kind) for the academic year; studentIds: array of id strings
// -> { [studentId]: { [strand]: { score, faScore, dtScore, saScore, hasData } } }
export function computeAptitude({ sheets, studentIds }) {
  const ids = new Set(studentIds);
  // collected[studentId][strand] = { FA: [], DT: [], SA: [] }
  const collected = {};
  const strandsBySubject = {};
  for (const [strand, cfg] of Object.entries(APTITUDE_STRANDS)) for (const s of cfg.subjects) (strandsBySubject[s] ??= []).push(strand);

  for (const sh of sheets) {
    const strands = strandsBySubject[sh.subject];
    if (!strands) continue;
    for (const m of sh.marks) {
      const sid = String(m.student);
      if (!ids.has(sid)) continue;
      const p = pct(m.marks, sh.maxMarks);
      if (p === null) continue;
      for (const strand of strands) ((collected[sid] ??= {})[strand] ??= { FA: [], DT: [], SA: [] })[sh.kind].push(p);
    }
  }

  const out = {};
  for (const sid of studentIds) {
    out[sid] = {};
    for (const [strand, cfg] of Object.entries(APTITUDE_STRANDS)) {
      const c = collected[sid]?.[strand] || { FA: [], DT: [], SA: [] };
      const faScore = c.FA.length ? safeAvg(c.FA) : null;
      const dtScore = c.DT.length ? safeAvg(c.DT) : null;
      const saScore = c.SA.length ? safeAvg(c.SA) : null;
      const parts = [[faScore, cfg.weightFa], [dtScore, cfg.weightDt], [saScore, cfg.weightSa]];
      const totalWeight = parts.reduce((t, [s, w]) => (s !== null ? t + w : t), 0);
      const score = totalWeight > 0 ? Math.round((parts.reduce((t, [s, w]) => (s !== null ? t + s * w : t), 0) / totalWeight) * 10) / 10 : null;
      out[sid][strand] = { score, faScore, dtScore, saScore, hasData: totalWeight > 0 };
    }
  }
  return out;
}
