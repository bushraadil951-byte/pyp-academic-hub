// DT (Diagnostic Tests), FA and SA: marks entry, CSV bulk upload, analytics, student progress.
import { Router } from 'express';
import { ACADEMIC_YEAR, MARK_GRADES, MARK_KINDS, MARK_SECTIONS, ROLES } from '../config.js';
import { User } from '../models/User.js';
import { MarkSheet } from '../models/MarkSheet.js';
import { requireAuth } from '../middleware/auth.js';
import { bad, notFound, str, wrap } from '../utils/helpers.js';
import { computeCrossGrade, computeGradeAnalytics, computeStudentSeries } from '../utils/marksMath.js';

const router = Router();
const staff = requireAuth(ROLES.TEACHER, ROLES.ADMIN);
const adminOnly = requireAuth(ROLES.ADMIN);

// Teachers are locked to their assigned grade (null = unrestricted), as current_teacher_grade() in app.py.
const lockedGrade = async (req) => (req.user.role === ROLES.TEACHER ? (await User.findById(req.user.id).select('grade'))?.grade || null : null);

router.param('kind', (req, _res, next, raw) => {
  const kind = String(raw).toUpperCase();
  if (!MARK_KINDS[kind]) return next(notFound());
  req.kind = kind; req.cfg = MARK_KINDS[kind];
  next();
});

function slot(req, source) {
  const grade = source.grade;
  const section = str(source.section) || null;
  const subject = req.cfg.subjects.find((s) => s.toLowerCase() === str(source.subject).toLowerCase());
  const number = Number(source.number);
  if (!MARK_GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !MARK_SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (!subject) throw bad('Choose a valid subject.');
  if (!req.cfg.numbers.includes(number)) throw bad(`Choose a valid ${req.kind} number.`);
  return { kind: req.kind, grade, section, subject, number, academicYear: ACADEMIC_YEAR };
}

const studentsOf = (grade, section) =>
  User.find({ role: ROLES.STUDENT, grade, ...(section ? { section } : {}) }).sort({ name: 1 }).select('name username section').lean();
const asStudent = (u) => ({ id: String(u._id), name: u.name, username: u.username, section: u.section || '' });

// A sheet for the whole grade (section null) or this section; the section-specific one wins.
async function findSheet(s) {
  const found = await MarkSheet.find({ kind: s.kind, number: s.number, subject: s.subject, grade: s.grade, academicYear: s.academicYear, section: { $in: [null, s.section] } });
  return found.find((x) => x.section) || found[0] || null;
}
const getOrCreateSheet = (s, createdBy) => MarkSheet.findOneAndUpdate(
  { kind: s.kind, number: s.number, subject: s.subject, grade: s.grade, section: s.section, academicYear: s.academicYear },
  { $setOnInsert: { ...s, createdBy } }, { upsert: true, new: true });

function applyMark(sheet, studentId, value, remarks, enteredBy) {
  const i = sheet.marks.findIndex((m) => String(m.student) === studentId);
  const entry = { student: studentId, marks: value, remarks: remarks || '', enteredBy, enteredAt: new Date() };
  if (i >= 0) sheet.marks.set(i, entry); else sheet.marks.push(entry);
}
const dropMark = (sheet, studentId) => { sheet.marks = sheet.marks.filter((m) => String(m.student) !== studentId); };
const parseValue = (v, max) => {
  if (v === '' || v === null || v === undefined) return { blank: true };
  const n = Number(String(v).trim());
  return Number.isFinite(n) && n >= 0 && n <= max ? { value: n } : { invalid: true };
};

// ── Student progress (own marks only) ───────────────────────────────────────
router.get('/student-progress/:kind', requireAuth(ROLES.STUDENT), wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const sheets = await MarkSheet.find({ kind: req.kind, grade: me.grade, academicYear: ACADEMIC_YEAR }).lean();
  const { series, insights } = computeStudentSeries({ sheets, studentId: me.id, studentSection: me.section, subjects: req.cfg.subjects, numbers: req.cfg.numbers });
  res.json({ label: req.cfg.label, academicYear: ACADEMIC_YEAR, student: { name: me.name, grade: me.grade, section: me.section }, subjects: req.cfg.subjects, numbers: req.cfg.numbers, series, insights });
}));

// ── Config and hub ──────────────────────────────────────────────────────────
router.get('/config', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  res.json({ academicYear: ACADEMIC_YEAR, kinds: MARK_KINDS, grades: locked ? [locked] : MARK_GRADES, gradeLocked: !!locked, sections: MARK_SECTIONS, isAdmin: req.user.role === ROLES.ADMIN });
}));

router.get('/hub', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const sheets = await MarkSheet.find({ academicYear: ACADEMIC_YEAR, ...(locked ? { grade: locked } : {}) }).select('kind marks.student').lean();
  res.json(Object.entries(MARK_KINDS).map(([kind, cfg]) => {
    const mine = sheets.filter((s) => s.kind === kind);
    return { kind, label: cfg.label, totalSheets: mine.length, totalMarks: mine.reduce((n, s) => n + s.marks.length, 0) };
  }));
}));

router.get('/:kind/dashboard', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const grades = locked ? [locked] : MARK_GRADES;
  const sheets = await MarkSheet.find({ kind: req.kind, academicYear: ACADEMIC_YEAR, grade: { $in: grades } }).select('marks.student').lean();
  const counts = await Promise.all(grades.map((g) => User.countDocuments({ role: ROLES.STUDENT, grade: g })));
  res.json({
    label: req.cfg.label, academicYear: ACADEMIC_YEAR, numbers: req.cfg.numbers,
    totalSheets: sheets.length, totalMarks: sheets.reduce((n, s) => n + s.marks.length, 0), totalStudents: counts.reduce((a, b) => a + b, 0),
    grades: grades.map((g, i) => ({ grade: g, studentCount: counts[i] })),
  });
}));

// ── Entry (one subject + number + grade/section) ────────────────────────────
router.get('/:kind/entry', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const s = slot(req, { ...req.query, grade: locked || req.query.grade || MARK_GRADES[0], subject: req.query.subject || req.cfg.subjects[0], number: req.query.number || req.cfg.numbers[0] });
  const [students, sheet] = await Promise.all([studentsOf(s.grade, s.section), findSheet(s)]);
  const marks = {};
  for (const m of sheet?.marks || []) marks[String(m.student)] = { marks: m.marks, remarks: m.remarks || '' };
  res.json({
    slot: { grade: s.grade, section: s.section || '', subject: s.subject, number: s.number },
    students: students.map(asStudent),
    sheet: sheet ? { maxMarks: sheet.maxMarks, testDate: sheet.testDate, section: sheet.section } : null,
    marks,
  });
}));

router.put('/:kind/entry', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const s = slot(req, { ...req.body, grade: locked || req.body.grade });
  const maxMarks = Number(req.body.maxMarks ?? 25);
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) throw bad('Maximum marks must be more than 0.');
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

  const roster = new Map((await studentsOf(s.grade, s.section)).map((u) => [String(u._id), u.name]));
  const sheet = await getOrCreateSheet(s, req.user.id);
  sheet.maxMarks = maxMarks;
  if (req.body.testDate) { const d = new Date(req.body.testDate); if (!Number.isNaN(d.getTime())) sheet.testDate = d; }

  let saved = 0, removed = 0; const invalid = [];
  for (const row of rows) {
    const id = String(row.studentId);
    if (!roster.has(id)) continue;
    const v = parseValue(row.marks, maxMarks);
    if (v.blank) { const before = sheet.marks.length; dropMark(sheet, id); removed += before - sheet.marks.length; } // blank = absent
    else if (v.invalid) invalid.push(roster.get(id));
    else { applyMark(sheet, id, v.value, str(row.remarks), req.user.id); saved += 1; }
  }
  await sheet.save();
  res.json({ saved, removed, invalid });
}));

// ── CSV bulk upload: one row per student, one column per subject ────────────
router.put('/:kind/bulk', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const base = slot(req, { ...req.body, grade: locked || req.body.grade, subject: req.cfg.subjects[0] });
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 1000) : [];
  const byUsername = new Map((await studentsOf(base.grade, base.section)).map((u) => [u.username, String(u._id)]));

  const subjectsInFile = [...new Set(rows.flatMap((r) => Object.keys(r.marks || {})))]
    .map((k) => req.cfg.subjects.find((s) => s.toLowerCase() === k.trim().toLowerCase())).filter(Boolean);
  if (!subjectsInFile.length) throw bad(`No subject columns recognised. Expected headers like: username,${req.cfg.subjects.map((s) => s.toLowerCase()).join(',')}`);

  let saved = 0, skipped = 0; const unknownUsers = new Set();
  for (const subject of subjectsInFile) {
    const max = Number(req.body.maxMarks?.[subject] ?? 25) || 25;
    const sheet = await getOrCreateSheet({ ...base, subject }, req.user.id);
    sheet.maxMarks = max;
    for (const row of rows) {
      const id = byUsername.get(str(row.username));
      if (!id) { if (str(row.username)) unknownUsers.add(str(row.username)); continue; }
      const raw = Object.entries(row.marks || {}).find(([k]) => k.trim().toLowerCase() === subject.toLowerCase())?.[1];
      const v = parseValue(raw, max);
      if (v.blank) continue;
      if (v.invalid) { skipped += 1; continue; }
      applyMark(sheet, id, v.value, '', req.user.id); saved += 1;
    }
    await sheet.save();
  }
  res.json({ saved, skipped, subjects: subjectsInFile, unknownUsers: [...unknownUsers] });
}));

// ── Analytics ───────────────────────────────────────────────────────────────
router.get('/:kind/analytics', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const grade = locked || req.query.grade || MARK_GRADES[0];
  if (!MARK_GRADES.includes(grade)) throw bad('Choose a valid grade.');
  const section = str(req.query.section) || null;
  const [students, sheets] = await Promise.all([studentsOf(grade, section), MarkSheet.find({ kind: req.kind, grade, academicYear: ACADEMIC_YEAR }).lean()]);
  res.json({ grade, section: section || '', academicYear: ACADEMIC_YEAR, ...computeGradeAnalytics({ students: students.map(asStudent), sheets, subjects: req.cfg.subjects, numbers: req.cfg.numbers }) });
}));

router.get('/:kind/cross-grade', adminOnly, wrap(async (req, res) => {
  const sheets = await MarkSheet.find({ kind: req.kind, academicYear: ACADEMIC_YEAR }).lean();
  const counts = await Promise.all(MARK_GRADES.map((g) => User.countDocuments({ role: ROLES.STUDENT, grade: g })));
  const studentCounts = Object.fromEntries(MARK_GRADES.map((g, i) => [g, counts[i]]));
  res.json({ subjects: req.cfg.subjects, grades: computeCrossGrade({ grades: MARK_GRADES, studentCounts, sheets, subjects: req.cfg.subjects }) });
}));

export default router;
