// Pure functions (no database access) so the maths is easy to test.
// Same calculations as build_dt_analytics / dt_student_series / dt_student_insights in app.py.
import { round1, safeAvg } from './math.js';

// Strand sheets (one per strand) -> one subject-level sheet per assessment, so every existing calculation keeps working.
// Each student's mark becomes (sum of their strand marks) out of (sum of the maxima of the strands they were marked on).
// Sheets without a strand (Science, DT, older data) pass through unchanged.
export function collapseStrands(sheets) {
  const out = []; const groups = new Map();
  for (const sh of sheets) {
    if (!sh.strand) { out.push(sh); continue; }
    const key = [sh.kind, sh.number, sh.subject, sh.grade, sh.section || '', sh.academicYear].join('|');
    let g = groups.get(key);
    if (!g) {
      g = { kind: sh.kind, number: sh.number, subject: sh.subject, grade: sh.grade, section: sh.section || null, academicYear: sh.academicYear, testDate: sh.testDate || null, strand: null, maxMarks: 0, byStudent: new Map() };
      groups.set(key, g); out.push(g);
    }
    g.maxMarks += sh.maxMarks;
    for (const m of sh.marks) {
      const sid = String(m.student);
      const cur = g.byStudent.get(sid) || { student: m.student, marks: 0, max: 0 };
      cur.marks += m.marks; cur.max += sh.maxMarks;
      g.byStudent.set(sid, cur);
    }
  }
  for (const g of groups.values()) { g.marks = [...g.byStudent.values()]; delete g.byStudent; }
  return out;
}


const pctOf = (m, max) => (max > 0 ? round1((m / max) * 100) : null);
const vals = (xs) => xs.filter((x) => x !== null && x !== undefined);

// students: [{id,name,username,section}]   sheets: lean MarkSheet docs for the grade
export function computeGradeAnalytics({ students, sheets, subjects, numbers }) {
  const ids = new Set(students.map((s) => s.id));
  const lookup = new Map(); // "student|subject|number" -> percent
  for (const sh of sheets) {
    for (const m of sh.marks) {
      const sid = String(m.student);
      const p = ids.has(sid) ? pctOf(m.marks, m.max ?? sh.maxMarks) : null;
      if (p !== null) lookup.set(`${sid}|${sh.subject}|${sh.number}`, p);
    }
  }
  const buckets = Object.fromEntries(subjects.map((s) => [s, numbers.map(() => [])]));
  const subjectAll = Object.fromEntries(subjects.map((s) => [s, []]));
  const classAll = [];

  const rows = students.map((st) => {
    const subj = {};
    const all = [];
    for (const subject of subjects) {
      const pcts = numbers.map((n, i) => {
        const p = lookup.get(`${st.id}|${subject}|${n}`) ?? null;
        if (p !== null) { buckets[subject][i].push(p); subjectAll[subject].push(p); classAll.push(p); all.push(p); }
        return p;
      });
      const v = vals(pcts);
      subj[subject] = { pcts, avg: v.length ? safeAvg(v) : null };
    }
    return { ...st, subjects: subj, overall: all.length ? safeAvg(all) : null };
  });

  return {
    students: rows,
    classAvg: Object.fromEntries(subjects.map((s) => [s, buckets[s].map((b) => (b.length ? safeAvg(b) : null))])),
    subjectOverall: Object.fromEntries(subjects.map((s) => [s, subjectAll[s].length ? safeAvg(subjectAll[s]) : null])),
    classOverall: classAll.length ? safeAvg(classAll) : null,
    subjects, numbers,
  };
}

// sheets of every grade; studentCounts: { 'Grade 3': 41, ... }
export function computeCrossGrade({ grades, studentCounts, sheets, subjects }) {
  return grades.map((grade) => {
    const subjectAvgs = {};
    const all = [];
    for (const subject of subjects) {
      const p = [];
      for (const sh of sheets) if (sh.grade === grade && sh.subject === subject) for (const m of sh.marks) { const x = pctOf(m.marks, m.max ?? sh.maxMarks); if (x !== null) p.push(x); }
      subjectAvgs[subject] = p.length ? safeAvg(p) : null;
      all.push(...p);
    }
    return { grade, studentCount: studentCounts[grade] || 0, subjectAvgs, overallAvg: all.length ? safeAvg(all) : null };
  });
}

// sheets: this student's grade; a sheet applies if section is null or equals the student's section.
export function computeStudentSeries({ sheets, studentId, studentSection, subjects, numbers }) {
  const sid = String(studentId);
  const series = {};
  for (const subject of subjects) {
    series[subject] = numbers.map((number) => {
      const candidates = sheets.filter((sh) => sh.subject === subject && sh.number === number && (!sh.section || sh.section === studentSection));
      const sh = candidates.find((c) => c.section) || candidates[0]; // section-specific sheet wins
      if (!sh) return { number, marks: null, max: null, pct: null, classAvgPct: null, date: null };
      const classPct = vals(sh.marks.map((m) => pctOf(m.marks, m.max ?? sh.maxMarks)));
      const mine = sh.marks.find((m) => String(m.student) === sid);
      return {
        number, marks: mine ? mine.marks : null, max: mine ? (mine.max ?? sh.maxMarks) : sh.maxMarks,
        pct: mine ? pctOf(mine.marks, mine.max ?? sh.maxMarks) : null,
        classAvgPct: classPct.length ? safeAvg(classPct) : null,
        date: sh.testDate || null,
      };
    });
  }
  const insights = subjects.map((subject) => {
    const v = vals(series[subject].map((p) => p.pct));
    const average = v.length ? safeAvg(v) : null;
    const status = average === null ? 'Not started' : average >= 80 ? 'Strong' : average >= 60 ? 'Developing' : 'Needs focus';
    return { subject, average, trend: v.length > 1 ? round1(v[v.length - 1] - v[0]) : null, completed: v.length, latest: v.length ? v[v.length - 1] : null, status };
  }).sort((a, b) => (a.average === null) - (b.average === null) || (a.average ?? 0) - (b.average ?? 0));
  return { series, insights };
}
