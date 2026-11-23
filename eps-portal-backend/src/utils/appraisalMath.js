// Teacher appraisal, worked out from student results. Pure functions (no database access) so the maths is easy to test.
//
// What counts, by grade:   Early Years (Nursery, KG-1, KG-2): SA        Grades 1-2: SA + DT        Grades 3-5: SA + DT + IBT
// FA is not used. For one subject in one section, each assessment type gives an average % over the section's students;
// the types are then combined using the weights the administrator sets (types with no results yet are left out and the
// remaining weights are scaled up, and the row is marked as partial).
import { collapseStrands } from './marksMath.js';
import { round1, safeAvg } from './math.js';

export const EY_GRADES = ['Nursery', 'KG-1', 'KG-2'];
export const SUBJECTS = ['English', 'Hindi', 'Urdu', 'Maths', 'Science', 'ICT', 'Arts', 'PE', 'Islamic Studies'];
export const HOME_ROOM = 'ALL';                                                                  // an assignment meaning "all subjects of this class"
export const DEFAULT_SETTINGS = { weights: { SA: 50, DT: 30, IBT: 20 }, meeting: 60, exceeding: 80 };

export const typesFor = (grade) => (EY_GRADES.includes(grade) ? ['SA'] : ['Grade 1', 'Grade 2'].includes(grade) ? ['SA', 'DT'] : ['SA', 'DT', 'IBT']);
const IBT_NAME = { Maths: 'Mathematics' };               // the IBT mock tests call it Mathematics

export function bandOf(pct, settings) {
  if (pct === null || pct === undefined) return null;
  return pct >= settings.exceeding ? 'EE' : pct >= settings.meeting ? 'ME' : 'BME';
}
export const BAND_LABELS = { EE: 'Exceeding Expectation', ME: 'Meeting Expectation', BME: 'Below Meeting Expectations' };

// students: [{ id, grade, section }]    sheets: lean MarkSheet docs (kind SA / DT)
// tests: [{ id, subject }]              results: [{ student, test, percent }]
export function buildLookups({ students, sheets, tests, results }) {
  const gradeOf = new Map(students.map((s) => [s.id, s.grade]));
  const roster = new Map();
  for (const s of students) {
    const k = `${s.grade}|${s.section}`;
    if (!roster.has(k)) roster.set(k, []);
    roster.get(k).push(s.id);
  }

  // marks[studentId] = Map('SA|Maths' -> [percent, ...]), one percent per numbered assessment.
  // A sheet for one section wins over a whole-grade sheet for the same assessment.
  const slot = new Map();                                                    // 'student|kind|number|subject' -> percent
  const ordered = [...collapseStrands(sheets)].sort((a, b) => (a.section ? 1 : 0) - (b.section ? 1 : 0));
  for (const sh of ordered) {
    for (const m of sh.marks) {
      const id = String(m.student);
      const max = m.max ?? sh.maxMarks;
      if (gradeOf.get(id) !== sh.grade || !(max > 0)) continue;
      slot.set(`${id}|${sh.kind}|${sh.number}|${sh.subject}`, (m.marks / max) * 100);
    }
  }
  const marks = new Map();
  for (const [key, pct] of slot) {
    const [id, kind, , subject] = key.split('|');
    if (!marks.has(id)) marks.set(id, new Map());
    const mk = `${kind}|${subject}`;
    if (!marks.get(id).has(mk)) marks.get(id).set(mk, []);
    marks.get(id).get(mk).push(pct);
  }

  // ibt[studentId] = Map('Mathematics' -> [percent, ...])
  const testSubject = new Map(tests.map((t) => [String(t.id), t.subject]));
  const ibt = new Map();
  for (const r of results) {
    const subject = testSubject.get(String(r.test));
    if (!subject || typeof r.percent !== 'number') continue;
    const id = String(r.student);
    if (!ibt.has(id)) ibt.set(id, new Map());
    if (!ibt.get(id).has(subject)) ibt.get(id).set(subject, []);
    ibt.get(id).get(subject).push(r.percent);
  }
  return { roster, marks, ibt };
}

// One subject, one section: average % per assessment type, and the combined (weighted) figure.
export function scoreSubject(lookups, grade, section, subject, settings) {
  const ids = lookups.roster.get(`${grade}|${section}`) || [];
  const types = typesFor(grade);
  const by = {};
  for (const type of types) {
    const vals = [];
    for (const id of ids) {
      const list = type === 'IBT' ? lookups.ibt.get(id)?.get(IBT_NAME[subject] || subject) : lookups.marks.get(id)?.get(`${type}|${subject}`);
      if (list) vals.push(...list);
    }
    by[type] = vals.length ? { avg: round1(safeAvg(vals)), n: vals.length } : null;
  }
  const have = types.filter((t) => by[t]);
  let combined = null;
  if (have.length) {
    const w = have.map((t) => Math.max(0, Number(settings.weights[t]) || 0));
    const total = w.reduce((a, b) => a + b, 0);
    combined = round1(total > 0 ? have.reduce((s, t, i) => s + by[t].avg * w[i], 0) / total : safeAvg(have.map((t) => by[t].avg)));
  }
  return { students: ids.length, types, by, combined, missing: types.filter((t) => !by[t]), band: bandOf(combined, settings) };
}

// assignments: [{ teacher, grade, section, subject }] for everyone (needed to know which subjects a home room teacher does NOT teach)
// Returns { [teacherId]: { rows, sections, overall, band } }
export function computeAppraisals({ assignments, lookups, settings }) {
  const explicit = new Map();                                              // 'grade|section' -> Set of subjects given to someone
  for (const a of assignments) {
    if (a.subject === HOME_ROOM) continue;
    const k = `${a.grade}|${a.section}`;
    if (!explicit.has(k)) explicit.set(k, new Set());
    explicit.get(k).add(a.subject);
  }

  const out = {};
  for (const a of assignments) {
    const t = (out[a.teacher] ??= { rows: [] });
    const homeRoom = a.subject === HOME_ROOM;
    let subjects = [a.subject];
    if (homeRoom) {
      // Every subject that has results in this class, except the ones an assigned subject teacher takes.
      const taken = explicit.get(`${a.grade}|${a.section}`) || new Set();
      subjects = SUBJECTS.filter((s) => !taken.has(s) && scoreSubject(lookups, a.grade, a.section, s, settings).combined !== null);
      if (!subjects.length) t.rows.push({ grade: a.grade, section: a.section, subject: 'All subjects', role: 'Home room teacher (HRT)', ...scoreSubject(lookups, a.grade, a.section, '-', settings) });
    }
    for (const subject of subjects) t.rows.push({ grade: a.grade, section: a.section, subject, role: homeRoom ? 'Home room teacher (HRT)' : 'Subject teacher', ...scoreSubject(lookups, a.grade, a.section, subject, settings) });
  }

  for (const t of Object.values(out)) {
    t.rows.sort((x, y) => x.grade.localeCompare(y.grade, 'en', { numeric: true }) || x.section.localeCompare(y.section) || x.subject.localeCompare(y.subject));
    const groups = new Map();
    for (const r of t.rows) {
      const k = `${r.grade}|${r.section}`;
      if (!groups.has(k)) groups.set(k, { grade: r.grade, section: r.section, students: r.students, vals: [] });
      if (r.combined !== null) groups.get(k).vals.push(r.combined);
    }
    t.sections = [...groups.values()].map(({ vals, ...g }) => { const combined = vals.length ? round1(safeAvg(vals)) : null; return { ...g, subjects: vals.length, combined, band: bandOf(combined, settings) }; });
    const all = t.rows.filter((r) => r.combined !== null).map((r) => r.combined);
    t.overall = all.length ? round1(safeAvg(all)) : null;
    t.band = bandOf(t.overall, settings);
    t.counted = all.length;
  }
  return out;
}
