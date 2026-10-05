// Pure aggregation for the IBT analytics screen (no database access, so it can be unit-tested).
// results: [{ percent, sectionScores, subject, mock (1-5 | null), testName, student: { _id, name, grade, section } }]
import { GRADES, SUBJECTS } from '../config.js';
import { round1, safeAvg } from './math.js';

export const MOCKS = [1, 2, 3, 4, 5];
const avgOf = (rows) => safeAvg(rows.map((r) => r.percent));
const avgOrNull = (rows) => (rows.length ? avgOf(rows) : null);
const distinct = (rows) => new Set(rows.map((r) => String(r.student._id))).size;

export function computeIbtAnalytics({ students, results }) {
  // Section ("strand") averages, overall and per subject
  const sectionPcts = {};
  const strandPcts = Object.fromEntries(SUBJECTS.map((s) => [s, {}]));
  for (const r of results) {
    for (const [sec, v] of Object.entries(r.sectionScores || {})) {
      if (!v || !(v.total > 0)) continue;
      const pct = round1((v.correct / v.total) * 100);
      (sectionPcts[sec] ??= []).push(pct);
      if (strandPcts[r.subject]) (strandPcts[r.subject][sec] ??= []).push(pct);
    }
  }
  const toList = (obj) => Object.entries(obj).map(([name, v]) => ({ section: name, avg: safeAvg(v) })).sort((a, b) => b.avg - a.avg);

  // Mock-wise: one row per IBT Mock 1-5, plus a bucket for tests that have no number yet
  const mockRow = (rows, mock, label) => ({
    mock, label, avg: avgOrNull(rows), count: rows.length, students: distinct(rows), below60: rows.filter((r) => r.percent < 60).length,
    subjectAvgs: Object.fromEntries(SUBJECTS.map((sub) => [sub, avgOrNull(rows.filter((r) => r.subject === sub))])),
  });
  const byMock = MOCKS.map((n) => mockRow(results.filter((r) => r.mock === n), n, `IBT Mock ${n}`));
  const unnumbered = results.filter((r) => r.mock === null);
  if (unnumbered.length) byMock.push(mockRow(unnumbered, null, 'Not numbered'));
  const withData = byMock.filter((m) => m.mock !== null && m.avg !== null);
  const lowestMock = withData.length >= 2 ? withData.reduce((a, b) => (b.avg < a.avg ? b : a)).mock : null;

  const studentRows = students.map((s) => {
    const mine = results.filter((r) => String(r.student._id) === String(s._id));
    const mockAvgs = Object.fromEntries(MOCKS.map((n) => [n, avgOrNull(mine.filter((r) => r.mock === n))]));
    const taken = MOCKS.filter((n) => mockAvgs[n] !== null);
    const weakest = taken.length >= 2 ? taken.reduce((a, b) => (mockAvgs[b] < mockAvgs[a] ? b : a)) : null;
    return {
      id: String(s._id), name: s.name, grade: s.grade, section: s.section || '', testsTaken: mine.length, overallAvg: avgOf(mine),
      subjectAvgs: Object.fromEntries(SUBJECTS.map((sub) => [sub, avgOf(mine.filter((r) => r.subject === sub))])),
      mockAvgs, weakestMock: weakest === null ? null : { mock: weakest, avg: mockAvgs[weakest] },
      results: mine.map((r) => ({ mock: r.mock, subject: r.subject, test: r.testName, percent: r.percent }))
        .sort((a, b) => (a.mock ?? 99) - (b.mock ?? 99) || a.subject.localeCompare(b.subject)),
    };
  }).sort((a, b) => b.overallAvg - a.overallAvg);

  return {
    totals: {
      overallAvg: avgOf(results), above80: results.filter((r) => r.percent >= 80).length, below60: results.filter((r) => r.percent < 60).length,
      results: results.length, students: students.length,
    },
    byGrade: GRADES.map((g) => ({ grade: g, avg: avgOf(results.filter((r) => r.student.grade === g)), count: results.filter((r) => r.student.grade === g).length, students: students.filter((s) => s.grade === g).length })),
    bySubject: SUBJECTS.map((sub) => ({ subject: sub, avg: avgOf(results.filter((r) => r.subject === sub)), count: results.filter((r) => r.subject === sub).length })),
    gradeSubject: GRADES.map((g) => ({ grade: g, ...Object.fromEntries(SUBJECTS.map((sub) => [sub, avgOf(results.filter((r) => r.student.grade === g && r.subject === sub))])) })),
    sectionAvgs: toList(sectionPcts),
    subjectStrands: Object.fromEntries(SUBJECTS.map((sub) => [sub, toList(strandPcts[sub])])),
    byMock, lowestMock, studentRows,
  };
}
