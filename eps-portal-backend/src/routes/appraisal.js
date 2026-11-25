// Teacher appraisal (administrator only): who teaches what, and how their students perform.
import { Router } from 'express';
import { ACADEMIC_YEAR, MARK_SECTIONS, ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MarkSheet } from '../models/MarkSheet.js';
import { MockTest } from '../models/MockTest.js';
import { TestResult } from '../models/TestResult.js';
import { TeachingAssignment } from '../models/TeachingAssignment.js';
import { AppraisalSettings } from '../models/AppraisalSettings.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, bad, notFound, oid, wrap } from '../utils/helpers.js';
import { classificationReport, BAND_LABELS, DEFAULT_SETTINGS, HOME_ROOM, bandOf, SUBJECTS, buildLookups, computeAppraisals } from '../utils/appraisalMath.js';

const router = Router();
router.use(requireAuth(ROLES.ADMIN));

const GRADES = ['Nursery', 'KG-1', 'KG-2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];

async function getSettings() {
  const d = await AppraisalSettings.findOne({ key: 'settings' }).lean();
  return d ? { weights: { ...DEFAULT_SETTINGS.weights, ...d.weights }, weights12: { ...DEFAULT_SETTINGS.weights12, ...d.weights12 }, meeting: d.meeting ?? DEFAULT_SETTINGS.meeting, exceeding: d.exceeding ?? DEFAULT_SETTINGS.exceeding } : DEFAULT_SETTINGS;
}

// ── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', wrap(async (_req, res) => res.json({ ...(await getSettings()), labels: BAND_LABELS })));

router.put('/settings', wrap(async (req, res) => {
  const w = req.body.weights || {};
  const weights = {};
  for (const k of ['SA', 'DT', 'IBT']) {
    const v = Number(w[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) throw bad(`The weight for ${k} must be a number from 0 to 100.`);
    weights[k] = v;
  }
  if (weights.SA + weights.DT + weights.IBT <= 0) throw bad('At least one weight must be more than 0.');
  const w12 = req.body.weights12 || {};
  const weights12 = {};
  for (const k of ['SA', 'DT']) {
    const v = Number(w12[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) throw bad(`The Grades 1–2 weight for ${k} must be a number from 0 to 100.`);
    weights12[k] = v;
  }
  if (weights12.SA + weights12.DT <= 0) throw bad('At least one Grades 1–2 weight must be more than 0.');
  const meeting = Number(req.body.meeting), exceeding = Number(req.body.exceeding);
  if (!Number.isFinite(meeting) || !Number.isFinite(exceeding) || meeting <= 0 || exceeding > 100 || meeting >= exceeding) {
    throw bad('Meeting Expectation must start below Exceeding Expectation, both between 0 and 100.');
  }
  await AppraisalSettings.findOneAndUpdate({ key: 'settings' }, { $set: { weights, weights12, meeting, exceeding } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ ...(await getSettings()), labels: BAND_LABELS });
}));

// ── Teaching assignments ─────────────────────────────────────────────────────
router.get('/assignments', wrap(async (_req, res) => {
  const [teachers, rows] = await Promise.all([
    User.find({ role: ROLES.TEACHER }).collation({ locale: 'en' }).sort({ name: 1 }).select('name email').lean(),
    TeachingAssignment.find({ academicYear: ACADEMIC_YEAR }).lean(),
  ]);
  const by = new Map();
  for (const a of rows) { const k = String(a.teacher); if (!by.has(k)) by.set(k, []); by.get(k).push({ grade: a.grade, section: a.section, subject: a.subject }); }
  res.json({
    academicYear: ACADEMIC_YEAR, grades: GRADES, sections: MARK_SECTIONS, subjects: SUBJECTS, homeRoom: HOME_ROOM,
    teachers: teachers.map((t) => ({ id: String(t._id), name: t.name, email: t.email || '', assignments: (by.get(String(t._id)) || []).sort((x, y) => x.grade.localeCompare(y.grade, 'en', { numeric: true }) || x.section.localeCompare(y.section) || x.subject.localeCompare(y.subject)) })),
  });
}));

// Replaces everything one teacher teaches. body: { assignments: [{ grade, section, subject }] } (subject 'ALL' = home room)
router.put('/assignments/:teacherId', wrap(async (req, res) => {
  const teacher = await User.findOne({ _id: oid(req.params.teacherId), role: ROLES.TEACHER }).select('name').lean();
  if (!teacher) throw notFound('Teacher not found.');
  const input = Array.isArray(req.body.assignments) ? req.body.assignments : [];
  if (input.length > 200) throw bad('That is too many rows for one teacher.');

  const seen = new Set();
  const rows = [];
  for (const a of input) {
    if (!GRADES.includes(a.grade)) throw bad('Choose a grade for every row.');
    if (!MARK_SECTIONS.includes(a.section)) throw bad('Choose a section for every row.');
    if (a.subject !== HOME_ROOM && !SUBJECTS.includes(a.subject)) throw bad('Choose a subject for every row.');
    const key = `${a.grade}|${a.section}|${a.subject}`;
    if (seen.has(key)) throw bad(`${a.grade} ${a.section} ${a.subject === HOME_ROOM ? 'home room' : a.subject} is listed twice.`);
    seen.add(key);
    rows.push({ teacher: teacher._id, grade: a.grade, section: a.section, subject: a.subject, academicYear: ACADEMIC_YEAR });
  }

  // Nobody else may already have the same subject (or the home room) in the same class.
  if (rows.length) {
    const clash = await TeachingAssignment.find({ academicYear: ACADEMIC_YEAR, teacher: { $ne: teacher._id }, $or: rows.map((r) => ({ grade: r.grade, section: r.section, subject: r.subject })) }).populate('teacher', 'name').lean();
    if (clash.length) {
      const c = clash[0];
      throw new HttpError(409, `${c.grade} ${c.section} ${c.subject === HOME_ROOM ? 'home room' : c.subject} is already assigned to ${c.teacher?.name || 'another teacher'}. Remove it from them first.`);
    }
  }
  await TeachingAssignment.deleteMany({ academicYear: ACADEMIC_YEAR, teacher: teacher._id });
  if (rows.length) await TeachingAssignment.insertMany(rows);
  res.json({ saved: rows.length });
}));

// ── Results ──────────────────────────────────────────────────────────────────
async function compute() {
  const [settings, assignments, students, sheets, tests, results, teachers] = await Promise.all([
    getSettings(),
    TeachingAssignment.find({ academicYear: ACADEMIC_YEAR }).lean(),
    User.find({ role: ROLES.STUDENT }).select('grade section').lean(),
    MarkSheet.find({ academicYear: ACADEMIC_YEAR, kind: { $in: ['SA', 'DT'] } }).lean(),
    MockTest.find({}).select('subject').lean(),
    TestResult.find({}).select('student test percent').lean(),
    User.find({ role: ROLES.TEACHER }).collation({ locale: 'en' }).sort({ name: 1 }).select('name email').lean(),
  ]);
  const lookups = buildLookups({
    students: students.map((s) => ({ id: String(s._id), grade: s.grade, section: s.section })),
    sheets, tests: tests.map((t) => ({ id: String(t._id), subject: t.subject })), results,
  });
  const byTeacher = computeAppraisals({
    assignments: assignments.map((a) => ({ teacher: String(a.teacher), grade: a.grade, section: a.section, subject: a.subject })),
    lookups, settings,
  });
  const numbers = { DT: [], SA: [] };
  for (const sh of sheets) { const n = numbers[sh.kind]; if (n && !n.includes(sh.number)) n.push(sh.number); }
  numbers.DT.sort((a, b) => a - b); numbers.SA.sort((a, b) => a - b);
  return { settings, teachers, byTeacher, lookups, numbers };
}

// Every teacher with their overall figure.
router.get('/overview', wrap(async (_req, res) => {
  const { settings, teachers, byTeacher } = await compute();
  res.json({
    academicYear: ACADEMIC_YEAR, settings, labels: BAND_LABELS,
    teachers: teachers.map((t) => {
      const a = byTeacher[String(t._id)];
      return { id: String(t._id), name: t.name, email: t.email || '', assigned: !!a, classes: a ? a.sections.length : 0, overall: a?.overall ?? null, avgMoa: a?.avgMoa ?? null, band: a?.band ?? null, counted: a?.counted ?? 0, sections: a?.sections ?? [] };
    }),
  });
}));

// One teacher's sheet: every class and subject, with SA / DT / IBT, the combined figure and the band.
router.get('/teacher/:id', wrap(async (req, res) => {
  const { settings, teachers, byTeacher } = await compute();
  const t = teachers.find((x) => String(x._id) === String(oid(req.params.id)));
  if (!t) throw notFound('Teacher not found.');
  const a = byTeacher[String(t._id)] || { rows: [], sections: [], overall: null, band: null, counted: 0 };
  res.json({ academicYear: ACADEMIC_YEAR, settings, labels: BAND_LABELS, teacher: { id: String(t._id), name: t.name, email: t.email || '' }, ...a });
}));

// School-wide views built from every teacher's rows: by class and subject (with the teacher), by grade, by subject.
router.get('/reports', wrap(async (_req, res) => {
  const { settings, teachers, byTeacher } = await compute();
  const name = new Map(teachers.map((t) => [String(t._id), t.name]));
  const rows = [];
  for (const [tid, a] of Object.entries(byTeacher)) for (const r of a.rows) if (r.combined !== null) rows.push({ teacher: name.get(tid) || '—', grade: r.grade, section: r.section, subject: r.subject, role: r.role, combined: r.combined, moa: r.cls?.moa ?? null, band: r.band, by: r.by });
  const group = (keyFn, label) => {
    const m = new Map();
    for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, { ...label(r), vals: [], moas: [] }); m.get(k).vals.push(r.combined); if (r.moa !== null) m.get(k).moas.push(r.moa); }
    return [...m.values()].map(({ vals, moas, ...g }) => { const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10; const moa = moas.length ? Math.round((moas.reduce((a, b) => a + b, 0) / moas.length) * 10) / 10 : null; return { ...g, count: vals.length, avg, moa, band: bandOf(moa, settings) }; });
  };
  const gradeOrder = (a, b) => a.grade.localeCompare(b.grade, 'en', { numeric: true });
  res.json({
    academicYear: ACADEMIC_YEAR, settings, labels: BAND_LABELS,
    classes: rows.sort((a, b) => gradeOrder(a, b) || a.section.localeCompare(b.section) || a.subject.localeCompare(b.subject)),
    grades: group((r) => r.grade, (r) => ({ grade: r.grade })).sort(gradeOrder),
    subjects: group((r) => r.subject, (r) => ({ subject: r.subject })).sort((a, b) => a.subject.localeCompare(b.subject)),
  });
}));

// Performance classification: ME and EE counts and % per class and subject, with a total and an average row.
//   ?kind=DT | SA | APPRAISAL   &number=all|1|2…   &teacher=<id> (APPRAISAL only: just that teacher's classes and subjects)
router.get('/classification', wrap(async (req, res) => {
  const kind = ['DT', 'SA', 'APPRAISAL'].includes(req.query.kind) ? req.query.kind : 'DT';
  const number = kind === 'APPRAISAL' || !req.query.number ? 'all' : String(req.query.number);
  const { settings, teachers, byTeacher, lookups, numbers } = await compute();
  let allowed = null, teacher = null;
  if (kind === 'APPRAISAL' && req.query.teacher) {
    const t = teachers.find((x) => String(x._id) === String(oid(req.query.teacher)));
    if (!t) throw notFound('Teacher not found.');
    teacher = { id: String(t._id), name: t.name };
    allowed = new Set((byTeacher[String(t._id)]?.rows || []).map((r) => `${r.grade}|${r.section}|${r.subject}`));
  }
  res.json({ academicYear: ACADEMIC_YEAR, kind, number, numbers, teacher, settings, ...classificationReport({ lookups, settings, kind, number, allowed }) });
}));

export default router;
