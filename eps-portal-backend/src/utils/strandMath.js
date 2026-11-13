// Strand-level maths for FA and SA (pure functions, no database access).
// A "strand sheet" is a MarkSheet with a non-null `strand`: one sheet per strand per assessment number.
import { round1, safeAvg } from './math.js';

const pct = (m, max) => (max > 0 ? round1((m / max) * 100) : null);
const status = (avg) => (avg === null ? 'Not started' : avg >= 80 ? 'Strong' : avg >= 60 ? 'Developing' : 'Needs focus');

// Class-wide strand results for the analytics screen.
//   sheets: lean MarkSheet docs; strandsBySubject: { Maths: ['Numbers', ...] }; students: [{id}]
// -> { subjects: { Maths: [{ strand, perNumber: [avg|null per assessment number], overall }] },
//      students: { [studentId]: { Maths: { Numbers: avg|null, ... } } } }
export function computeStrandAnalytics({ students, sheets, strandsBySubject, numbers }) {
  const ids = new Set(students.map((s) => s.id));
  const cls = {};      // cls[subject][strand] = one bucket of percentages per assessment number
  const mine = {};     // mine[studentId][subject][strand] = percentages
  for (const sh of sheets) {
    if (!sh.strand || !strandsBySubject[sh.subject]?.includes(sh.strand)) continue;
    const n = numbers.indexOf(sh.number);
    if (n < 0) continue;
    for (const m of sh.marks) {
      const sid = String(m.student);
      const p = ids.has(sid) ? pct(m.marks, sh.maxMarks) : null;
      if (p === null) continue;
      (((cls[sh.subject] ??= {})[sh.strand] ??= numbers.map(() => []))[n]).push(p);
      ((((mine[sid] ??= {})[sh.subject] ??= {})[sh.strand]) ??= []).push(p);
    }
  }
  const subjects = {};
  for (const [subject, strands] of Object.entries(strandsBySubject)) {
    subjects[subject] = strands.map((strand) => {
      const buckets = cls[subject]?.[strand] || numbers.map(() => []);
      const all = buckets.flat();
      return { strand, perNumber: buckets.map((b) => (b.length ? safeAvg(b) : null)), overall: all.length ? safeAvg(all) : null };
    });
  }
  const studentsOut = {};
  for (const s of students) {
    studentsOut[s.id] = {};
    for (const [subject, strands] of Object.entries(strandsBySubject)) {
      studentsOut[s.id][subject] = Object.fromEntries(strands.map((st) => {
        const v = mine[s.id]?.[subject]?.[st] || [];
        return [st, v.length ? safeAvg(v) : null];
      }));
    }
  }
  return { subjects, students: studentsOut };
}

// One student's strand-by-strand progress for the student report.
// -> { Maths: [{ strand, points: [{number, pct, classAvgPct}], average, completed, latest, status }] }
export function computeStudentStrands({ sheets, studentId, studentSection, strandsBySubject, numbers }) {
  const sid = String(studentId);
  const out = {};
  for (const [subject, strands] of Object.entries(strandsBySubject)) {
    out[subject] = strands.map((strand) => {
      const points = numbers.map((number) => {
        const candidates = sheets.filter((sh) => sh.strand === strand && sh.subject === subject && sh.number === number && (!sh.section || sh.section === studentSection));
        const sh = candidates.find((c) => c.section) || candidates[0];   // a section-specific sheet wins
        if (!sh) return { number, pct: null, classAvgPct: null };
        const cl = sh.marks.map((m) => pct(m.marks, sh.maxMarks)).filter((x) => x !== null);
        const own = sh.marks.find((m) => String(m.student) === sid);
        return { number, pct: own ? pct(own.marks, sh.maxMarks) : null, classAvgPct: cl.length ? safeAvg(cl) : null };
      });
      const v = points.map((p) => p.pct).filter((x) => x !== null);
      const average = v.length ? safeAvg(v) : null;
      return { strand, points, average, completed: v.length, latest: v.length ? v[v.length - 1] : null, status: status(average) };
    });
  }
  return out;
}
