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
// weights: Grades 3-5 (SA, DT, IBT).  weights12: Grades 1-2 (SA, DT).  Early Years is always SA only (100%).
export const DEFAULT_SETTINGS = { weights: { SA: 35, DT: 35, IBT: 30 }, weights12: { SA: 50, DT: 50 }, meeting: 60, exceeding: 80 };
export const IBT_SUBJECTS = ['English', 'Maths', 'Science'];                                    // the only subjects with IBT, and only in Grades 3-5

export const typesFor = (grade, subject) => (EY_GRADES.includes(grade) ? ['SA'] : ['Grade 1', 'Grade 2'].includes(grade) ? ['SA', 'DT'] : IBT_SUBJECTS.includes(subject) ? ['SA', 'DT', 'IBT'] : ['SA', 'DT']);
const weightsFor = (grade, settings) => (EY_GRADES.includes(grade) ? { SA: 100 } : ['Grade 1', 'Grade 2'].includes(grade) ? (settings.weights12 || DEFAULT_SETTINGS.weights12) : settings.weights);
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
  const byNum = new Map();                                                   // id -> Map('KIND|Subject' -> Map(number -> percent))
  for (const [key, pct] of slot) {
    const [id, kind, number, subject] = key.split('|');
    if (!byNum.has(id)) byNum.set(id, new Map());
    const nk = `${kind}|${subject}`;
    if (!byNum.get(id).has(nk)) byNum.get(id).set(nk, new Map());
    byNum.get(id).get(nk).set(number, pct);
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
  return { roster, marks, ibt, byNum };
}

// One subject, one section: average % per assessment type, and the combined (weighted) figure.
export function scoreSubject(lookups, grade, section, subject, settings) {
  const ids = lookups.roster.get(`${grade}|${section}`) || [];
  const types = typesFor(grade, subject);
  const W = weightsFor(grade, settings);
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
    const w = have.map((t) => Math.max(0, Number(W[t]) || 0));
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
    for (const subject of subjects) {
      const sc = scoreSubject(lookups, a.grade, a.section, subject, settings);
      const cls = classify(studentPercents(lookups, a.grade, a.section, subject, { kind: 'APPRAISAL', settings }), settings);
      // The descriptor follows the share of students at ME or above, not the average mark.
      t.rows.push({ grade: a.grade, section: a.section, subject, role: homeRoom ? 'Home room teacher (HRT)' : 'Subject teacher', ...sc, cls, band: cls ? bandOf(cls.moa, settings) : null });
    }
  }

  for (const t of Object.values(out)) {
    t.rows.sort((x, y) => x.grade.localeCompare(y.grade, 'en', { numeric: true }) || x.section.localeCompare(y.section) || x.subject.localeCompare(y.subject));
    const groups = new Map();
    for (const r of t.rows) {
      const k = `${r.grade}|${r.section}`;
      if (!groups.has(k)) groups.set(k, { grade: r.grade, section: r.section, students: r.students, vals: [], moas: [], me: 0, ee: 0, bme: 0, assessed: 0 });
      const g = groups.get(k);
      if (r.combined !== null) g.vals.push(r.combined);
      if (r.cls) { g.moas.push(r.cls.moa); g.me += r.cls.me; g.ee += r.cls.ee; g.bme += r.cls.bme; g.assessed += r.cls.assessed; }
    }
    t.sections = [...groups.values()].map(({ vals, moas, ...g }) => { const combined = vals.length ? round1(safeAvg(vals)) : null; const moa = moas.length ? round1(safeAvg(moas)) : null; return { ...g, subjects: vals.length, combined, moa, band: bandOf(moa, settings) }; });

    // Each subject across all the classes this teacher teaches it in (counts added up, % out of students assessed).
    const subs = new Map();
    for (const r of t.rows) {
      if (!r.cls) continue;
      if (!subs.has(r.subject)) subs.set(r.subject, { subject: r.subject, classes: [], vals: [], me: 0, ee: 0, bme: 0, assessed: 0 });
      const x = subs.get(r.subject);
      x.classes.push(`${r.grade} ${r.section}`); if (r.combined !== null) x.vals.push(r.combined);
      x.me += r.cls.me; x.ee += r.cls.ee; x.bme += r.cls.bme; x.assessed += r.cls.assessed;
    }
    t.subjects = [...subs.values()].map(({ vals, ...x }) => {
      const moa = round1(((x.me + x.ee) / x.assessed) * 100);
      return { ...x, achievement: vals.length ? round1(safeAvg(vals)) : null, mePct: round1((x.me / x.assessed) * 100), eePct: round1((x.ee / x.assessed) * 100), moa, band: bandOf(moa, settings) };
    });

    // Final: totals, the average of the per-class-subject percentages, and the descriptor taken from that average.
    const withCls = t.rows.filter((r) => r.cls);
    const all = t.rows.filter((r) => r.combined !== null).map((r) => r.combined);
    t.overall = all.length ? round1(safeAvg(all)) : null;                                    // Student Achievement
    t.totals = { assessed: 0, me: 0, ee: 0, bme: 0 };
    for (const r of withCls) for (const k of Object.keys(t.totals)) t.totals[k] += r.cls[k];
    t.avgMePct = withCls.length ? round1(safeAvg(withCls.map((r) => r.cls.mePct))) : null;
    t.avgEePct = withCls.length ? round1(safeAvg(withCls.map((r) => r.cls.eePct))) : null;
    t.avgMoa = withCls.length ? round1(safeAvg(withCls.map((r) => r.cls.moa))) : null;      // ME % + EE %
    t.band = bandOf(t.avgMoa, settings);                                                    // Teacher Performance Descriptor
    t.counted = withCls.length;
  }
  return out;
}


// ── Performance classification (ME / EE counts per class and subject) ────────
export const CLASS_SUBJECTS = ['English', 'Hindi', 'Maths', 'Science', 'Urdu', 'ICT'];           // Science is shown as UOI
const avg = (a) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// One percentage per student who has results in this subject.
//   kind 'DT' | 'SA'  -> the student's average over the chosen numbered assessment (number 'all' = every one, averaged)
//   kind 'APPRAISAL'  -> the student's own weighted score using the appraisal rules (SA / DT / IBT and their weights)
export function studentPercents(lookups, grade, section, subject, { kind, number = 'all', settings }) {
  const ids = lookups.roster.get(`${grade}|${section}`) || [];
  const out = [];
  const typeAvg = (id, type) => {
    if (type === 'IBT') return avg(lookups.ibt.get(id)?.get(IBT_NAME[subject] || subject));
    const key = `${type}|${subject}`;
    if (type === kind && number !== 'all') { const v = lookups.byNum.get(id)?.get(key)?.get(String(number)); return v === undefined ? null : v; }
    return avg(lookups.marks.get(id)?.get(key));
  };
  for (const id of ids) {
    if (kind === 'DT' || kind === 'SA') {
      if (kind === 'DT' && EY_GRADES.includes(grade)) continue;
      const v = typeAvg(id, kind);
      if (v !== null) out.push(v);
    } else {
      const types = typesFor(grade, subject), W = weightsFor(grade, settings);
      const have = types.map((t) => [t, typeAvg(id, t)]).filter(([, v]) => v !== null);
      if (!have.length) continue;
      const w = have.map(([t]) => Math.max(0, Number(W[t]) || 0));
      const tot = w.reduce((a, b) => a + b, 0);
      out.push(tot > 0 ? have.reduce((sum, [, v], i) => sum + v * w[i], 0) / tot : avg(have.map(([, v]) => v)));
    }
  }
  return out;
}

// Counts and shares for one class-subject: ME, EE and below, plus the share at ME or above (moa).
function classify(vals, settings) {
  const n = vals.length;
  if (!n) return null;
  const ee = vals.filter((v) => v >= settings.exceeding).length;
  const me = vals.filter((v) => v >= settings.meeting && v < settings.exceeding).length;
  const bme = n - ee - me;
  return { assessed: n, me, ee, bme, mePct: round1((me / n) * 100), eePct: round1((ee / n) * 100), bmePct: round1((bme / n) * 100), moa: round1(((me + ee) / n) * 100) };
}
const cell = (vals, settings) => {
  const n = vals.length;
  if (!n) return null;
  const ee = vals.filter((v) => v >= settings.exceeding).length;
  const me = vals.filter((v) => v >= settings.meeting && v < settings.exceeding).length;
  return { assessed: n, me, mePct: round1((me / n) * 100), ee, eePct: round1((ee / n) * 100) };
};
const gradeNo = (g) => (EY_GRADES.includes(g) ? EY_GRADES.indexOf(g) - 10 : parseInt(String(g).replace(/\D/g, ''), 10) || 99);

// allowed: null (whole school) or Set of 'grade|section|subject' (one teacher's own subjects and classes)
export function classificationReport({ lookups, settings, kind, number, allowed = null }) {
  const classes = [...lookups.roster.keys()].map((k) => { const [grade, section] = k.split('|'); return { grade, section, students: lookups.roster.get(k).length }; })
    .filter((c) => !(kind === 'DT' && EY_GRADES.includes(c.grade)))
    .sort((a, b) => gradeNo(a.grade) - gradeNo(b.grade) || a.section.localeCompare(b.section));
  const rows = [];
  const acc = Object.fromEntries(CLASS_SUBJECTS.map((s) => [s, { assessed: 0, me: 0, ee: 0, mes: [], ees: [] }]));
  for (const c of classes) {
    const cells = {};
    let any = false;
    for (const sub of CLASS_SUBJECTS) {
      if (allowed && !allowed.has(`${c.grade}|${c.section}|${sub}`)) { cells[sub] = null; continue; }
      const x = cell(studentPercents(lookups, c.grade, c.section, sub, { kind, number, settings }), settings);
      cells[sub] = x;
      if (x) { any = true; const a = acc[sub]; a.assessed += x.assessed; a.me += x.me; a.ee += x.ee; a.mes.push(x.mePct); a.ees.push(x.eePct); }
    }
    if (any) rows.push({ ...c, cells });
  }
  const total = {}, average = {};
  for (const sub of CLASS_SUBJECTS) {
    const a = acc[sub];
    total[sub] = a.assessed ? { assessed: a.assessed, me: a.me, mePct: round1((a.me / a.assessed) * 100), ee: a.ee, eePct: round1((a.ee / a.assessed) * 100) } : null;
    average[sub] = a.mes.length ? { mePct: round1(safeAvg(a.mes)), eePct: round1(safeAvg(a.ees)) } : null;
  }
  return { subjects: CLASS_SUBJECTS, rows, total, average, totalStudents: rows.reduce((n, r) => n + r.students, 0) };
}
