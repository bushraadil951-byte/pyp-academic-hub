// IB Learner Profile + ATL, ISP character profile, and Aptitude Analytics.
import { Router } from 'express';
import { ACADEMIC_YEAR, MARK_GRADES, MARK_SECTIONS, ROLES } from '../config.js';
import { User } from '../models/User.js';
import { TestResult } from '../models/TestResult.js';
import { MarkSheet } from '../models/MarkSheet.js';
import { AtlRating, IspRating, LpRating, Reflection } from '../models/ProfileRatings.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, bad, notFound, oid, safeAvg, str, wrap } from '../utils/helpers.js';
import {
  APTITUDE_STRANDS, ATL_DESCRIPTORS, ATL_SKILLS, ISP_ATTRIBUTES, ISP_PROFILE, LEARNER_PROFILE, LP_ATTRIBUTES,
  RATING_COLORS, RATING_SCALE, TERMS,
} from '../utils/profileData.js';
import { computeAptitude } from '../utils/aptitude.js';

const router = Router();
const staff = requireAuth(ROLES.TEACHER, ROLES.ADMIN);
const student = requireAuth(ROLES.STUDENT);

// ── helpers ─────────────────────────────────────────────────────────────────
const lockedGrade = async (req) => (req.user.role === ROLES.TEACHER ? (await User.findById(req.user.id).select('grade'))?.grade || null : null);
const avg = (xs) => (xs.length ? safeAvg(xs) : 0);
const person = (u) => ({ id: String(u._id ?? u.id), name: u.name, grade: u.grade ?? null, section: u.section || '' });

function checkRating(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw bad('Ratings must be between 1 and 4.');
  return n;
}
function checkTerm(raw) {
  const term = str(raw) || TERMS[0];
  if (!TERMS.includes(term)) throw bad('Choose a valid UOI.');
  return term;
}

// Students the caller may see: teachers only in their grade; admins may filter by grade/section.
async function visibleStudents(req) {
  const locked = await lockedGrade(req);
  const grade = locked || str(req.query.grade) || null;
  const section = str(req.query.section) || null;
  const rows = await User.find({ role: ROLES.STUDENT, ...(grade ? { grade } : {}), ...(section ? { section } : {}) }).sort({ grade: 1, name: 1 }).lean();
  return { rows, grade, section, locked };
}

// Loads a student and enforces the teacher's grade lock.
async function studentForStaff(req, id) {
  const s = await User.findOne({ _id: oid(id), role: ROLES.STUDENT });
  if (!s) throw notFound('Student not found.');
  const locked = await lockedGrade(req);
  if (locked && s.grade !== locked) throw new HttpError(403, 'That student is not in your grade.');
  return s;
}

const mapBy = (rows, key, val) => Object.fromEntries(rows.map((r) => [r[key], val(r)]));

// ── Config (constants) ──────────────────────────────────────────────────────
router.get('/config', requireAuth(), wrap(async (req, res) => {
  const locked = req.user.role === ROLES.STUDENT ? null : await lockedGrade(req);
  res.json({
    academicYear: ACADEMIC_YEAR, terms: TERMS, ratingScale: RATING_SCALE, ratingColors: RATING_COLORS,
    learnerProfile: LEARNER_PROFILE, ispProfile: ISP_PROFILE, atlSkills: ATL_SKILLS, atlDescriptors: ATL_DESCRIPTORS,
    strands: Object.keys(APTITUDE_STRANDS),
    grades: locked ? [locked] : MARK_GRADES, gradeLocked: !!locked, sections: MARK_SECTIONS, isAdmin: req.user.role === ROLES.ADMIN,
  });
}));

// ═══ IB — staff ═════════════════════════════════════════════════════════════
router.get('/ib/dashboard', staff, wrap(async (req, res) => {
  const { rows, grade, section } = await visibleStudents(req);
  const ids = rows.map((s) => s._id);
  const [lp, atl] = await Promise.all([
    LpRating.find({ student: { $in: ids }, raterType: 'teacher' }).select('student attribute rating').lean(),
    AtlRating.find({ student: { $in: ids }, raterType: 'teacher' }).select('student').lean(),
  ]);
  const lpBy = new Map(); const atlBy = new Map();
  for (const r of lp) lpBy.set(String(r.student), (lpBy.get(String(r.student)) || 0) + 1);
  for (const r of atl) atlBy.set(String(r.student), (atlBy.get(String(r.student)) || 0) + 1);
  res.json({
    grade, section,
    students: rows.map((s) => ({ ...person(s), lpCount: lpBy.get(String(s._id)) || 0, atlCount: atlBy.get(String(s._id)) || 0 })),
    totalLp: lp.length, totalAtl: atl.length,
    lpAvgs: Object.fromEntries(LP_ATTRIBUTES.map((a) => [a, avg(lp.filter((r) => r.attribute === a).map((r) => r.rating))])),
  });
}));

router.get('/ib/students', staff, wrap(async (req, res) => {
  const { rows } = await visibleStudents(req);
  res.json(rows.map(person));
}));

// Learner Profile — teacher rating + evidence
router.get('/ib/lp', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.query.studentId);
  const term = checkTerm(req.query.term);
  const rows = await LpRating.find({ student: s._id, raterType: 'teacher', term }).lean();
  res.json({ student: person(s), term, ratings: mapBy(rows, 'attribute', (r) => ({ rating: r.rating, evidence: r.evidence || '' })) });
}));

router.put('/ib/lp', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.body.studentId);
  const term = checkTerm(req.body.term);
  const input = req.body.ratings && typeof req.body.ratings === 'object' ? req.body.ratings : {};
  let saved = 0;
  for (const attribute of LP_ATTRIBUTES) {
    const item = input[attribute];
    if (!item || item.rating === '' || item.rating === null || item.rating === undefined) continue;
    await LpRating.findOneAndUpdate(
      { student: s._id, raterType: 'teacher', term, attribute },
      { $set: { rating: checkRating(item.rating), evidence: str(item.evidence).slice(0, 2000), rater: req.user.id } },
      { upsert: true });
    saved += 1;
  }
  res.json({ saved });
}));

// ATL — teacher rating, one skill at a time
router.get('/ib/atl', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.query.studentId);
  const term = checkTerm(req.query.term);
  const grade = ATL_SKILLS.Communication[s.grade] ? s.grade : 'Grade 3';
  const rows = await AtlRating.find({ student: s._id, raterType: 'teacher', term }).lean();
  const ratings = {};
  for (const r of rows) (ratings[r.skill] ??= {})[r.descriptor] = r.rating;
  res.json({
    student: person(s), term, gradeUsed: grade,
    skills: Object.fromEntries(Object.entries(ATL_SKILLS).map(([skill, byGrade]) => [skill, (byGrade[grade] || []).map((d) => ({ descriptor: d, rating: ratings[skill]?.[d] ?? null }))])),
    legend: ATL_DESCRIPTORS[grade] || {},
  });
}));

router.put('/ib/atl', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.body.studentId);
  const term = checkTerm(req.body.term);
  const skill = str(req.body.skill);
  const grade = ATL_SKILLS.Communication[s.grade] ? s.grade : 'Grade 3';
  const descriptors = ATL_SKILLS[skill]?.[grade];
  if (!descriptors) throw bad('Choose a valid ATL skill.');
  const values = Array.isArray(req.body.ratings) ? req.body.ratings : [];
  let saved = 0;
  for (let i = 0; i < descriptors.length; i++) {
    const v = values[i];
    if (v === '' || v === null || v === undefined) continue;
    await AtlRating.findOneAndUpdate(
      { student: s._id, raterType: 'teacher', term, skill, descriptor: descriptors[i] },
      { $set: { rating: checkRating(v), rater: req.user.id } }, { upsert: true });
    saved += 1;
  }
  res.json({ saved });
}));

// Combined holistic report for one student, all UOIs.
async function buildReport(studentDoc) {
  const sid = studentDoc._id;
  const [lp, atl, results] = await Promise.all([
    LpRating.find({ student: sid }).lean(),
    AtlRating.find({ student: sid }).lean(),
    TestResult.find({ student: sid }).sort({ takenAt: -1 }).populate('test', 'name subject').lean(),
  ]);
  const report = {};
  for (const term of TERMS) {
    const lpData = {};
    for (const attribute of LP_ATTRIBUTES) {
      const t = lp.find((r) => r.term === term && r.attribute === attribute && r.raterType === 'teacher');
      const st = lp.find((r) => r.term === term && r.attribute === attribute && r.raterType === 'student');
      if (t || st) lpData[attribute] = { teacher: t?.rating ?? null, student: st?.rating ?? null, evidence: t?.evidence || '' };
    }
    const atlData = {};
    for (const skill of Object.keys(ATL_SKILLS)) {
      const teacher = atl.filter((r) => r.term === term && r.skill === skill && r.raterType === 'teacher').map((r) => r.rating);
      const self = atl.filter((r) => r.term === term && r.skill === skill && r.raterType === 'student').map((r) => r.rating);
      if (teacher.length || self.length) atlData[skill] = { avg: avg(teacher), selfAvg: self.length ? avg(self) : null, count: teacher.length };
    }
    report[term] = { lp: lpData, atl: atlData };
  }
  return {
    student: person(studentDoc), report,
    testResults: results.filter((r) => r.test).map((r) => ({ id: String(r._id), test: r.test.name, subject: r.test.subject, percent: r.percent, takenAt: r.takenAt })),
  };
}
router.get('/ib/report/:studentId', staff, wrap(async (req, res) => res.json(await buildReport(await studentForStaff(req, req.params.studentId)))));

// ═══ IB — student ═══════════════════════════════════════════════════════════
router.get('/student/ib', student, wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const term = checkTerm(req.query.term);
  const grade = ATL_SKILLS.Communication[me.grade] ? me.grade : 'Grade 3';
  const [lp, refs, atl] = await Promise.all([
    LpRating.find({ student: me._id }).lean(),
    Reflection.find({ student: me._id, term }).lean(),
    AtlRating.find({ student: me._id, term }).lean(),
  ]);
  const inTerm = lp.filter((r) => r.term === term);
  const avgByAttr = (raterType) => LP_ATTRIBUTES.map((a) => avg(lp.filter((r) => r.raterType === raterType && r.attribute === a).map((r) => r.rating)));
  res.json({
    student: person(me), term,
    selfRatings: mapBy(inTerm.filter((r) => r.raterType === 'student'), 'attribute', (r) => r.rating),
    teacherRatings: mapBy(inTerm.filter((r) => r.raterType === 'teacher'), 'attribute', (r) => r.rating),
    teacherEvidence: mapBy(inTerm.filter((r) => r.raterType === 'teacher' && r.evidence), 'attribute', (r) => r.evidence),
    reflections: mapBy(refs, 'attribute', (r) => r.reflection),
    atl: Object.fromEntries(Object.entries(ATL_SKILLS).map(([skill, byGrade]) => [skill, (byGrade[grade] || []).map((d) => ({
      descriptor: d,
      teacher: atl.find((r) => r.raterType === 'teacher' && r.skill === skill && r.descriptor === d)?.rating ?? null,
      self: atl.find((r) => r.raterType === 'student' && r.skill === skill && r.descriptor === d)?.rating ?? null,
    }))])),
    radar: { attributes: LP_ATTRIBUTES, self: avgByAttr('student'), teacher: avgByAttr('teacher') }, // averaged over all UOIs
  });
}));

router.put('/student/ib', student, wrap(async (req, res) => {
  const term = checkTerm(req.body.term);
  const ratings = req.body.ratings && typeof req.body.ratings === 'object' ? req.body.ratings : {};
  const reflections = req.body.reflections && typeof req.body.reflections === 'object' ? req.body.reflections : {};
  for (const attribute of LP_ATTRIBUTES) {
    const v = ratings[attribute];
    if (v !== '' && v !== null && v !== undefined) {
      await LpRating.findOneAndUpdate({ student: req.user.id, raterType: 'student', term, attribute }, { $set: { rating: checkRating(v) } }, { upsert: true });
    }
    if (typeof reflections[attribute] === 'string') {
      const text = reflections[attribute].trim().slice(0, 4000);
      if (text) await Reflection.findOneAndUpdate({ student: req.user.id, term, attribute }, { $set: { reflection: text } }, { upsert: true });
      else await Reflection.deleteOne({ student: req.user.id, term, attribute }); // an emptied box clears the reflection
    }
  }
  res.json({});
}));

router.put('/student/atl', student, wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const term = checkTerm(req.body.term);
  const grade = ATL_SKILLS.Communication[me.grade] ? me.grade : 'Grade 3';
  const input = req.body.ratings && typeof req.body.ratings === 'object' ? req.body.ratings : {};
  let saved = 0;
  for (const [skill, byGrade] of Object.entries(ATL_SKILLS)) {
    const values = Array.isArray(input[skill]) ? input[skill] : [];
    for (let i = 0; i < (byGrade[grade] || []).length; i++) {
      const v = values[i];
      if (v === '' || v === null || v === undefined) continue;
      await AtlRating.findOneAndUpdate({ student: me._id, raterType: 'student', term, skill, descriptor: byGrade[grade][i] }, { $set: { rating: checkRating(v) } }, { upsert: true });
      saved += 1;
    }
  }
  res.json({ saved });
}));

// ═══ ISP ════════════════════════════════════════════════════════════════════
router.get('/isp/dashboard', staff, wrap(async (req, res) => {
  const { rows, grade, section } = await visibleStudents(req);
  const ratings = await IspRating.find({ student: { $in: rows.map((s) => s._id) }, raterType: 'teacher' }).select('student attribute rating').lean();
  const by = new Map();
  for (const r of ratings) (by.get(String(r.student)) ?? by.set(String(r.student), []).get(String(r.student))).push(r.rating);
  res.json({
    grade, section, totalRatings: ratings.length,
    students: rows.map((s) => { const v = by.get(String(s._id)) || []; return { ...person(s), rated: v.length, avg: avg(v) }; }),
    ispAvgs: Object.fromEntries(ISP_ATTRIBUTES.map((a) => [a, avg(ratings.filter((r) => r.attribute === a).map((r) => r.rating))])),
  });
}));

router.get('/isp/students', staff, wrap(async (req, res) => res.json((await visibleStudents(req)).rows.map(person))));

router.get('/isp/rate', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.query.studentId);
  const rows = await IspRating.find({ student: s._id }).lean();
  res.json({
    student: person(s),
    ratings: mapBy(rows.filter((r) => r.raterType === 'teacher'), 'attribute', (r) => r.rating),
    selfRatings: mapBy(rows.filter((r) => r.raterType === 'student'), 'attribute', (r) => r.rating),
    reflections: mapBy(rows.filter((r) => r.raterType === 'student' && r.reflection), 'attribute', (r) => r.reflection),
  });
}));

router.put('/isp/rate', staff, wrap(async (req, res) => {
  const s = await studentForStaff(req, req.body.studentId);
  const input = req.body.ratings && typeof req.body.ratings === 'object' ? req.body.ratings : {};
  let saved = 0;
  for (const attribute of ISP_ATTRIBUTES) {
    const v = input[attribute];
    if (v === '' || v === null || v === undefined) continue;
    await IspRating.findOneAndUpdate({ student: s._id, raterType: 'teacher', attribute }, { $set: { rating: checkRating(v), rater: req.user.id } }, { upsert: true });
    saved += 1;
  }
  res.json({ saved });
}));

router.get('/student/isp', student, wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const rows = await IspRating.find({ student: me._id }).lean();
  res.json({
    student: person(me),
    selfRatings: mapBy(rows.filter((r) => r.raterType === 'student'), 'attribute', (r) => r.rating),
    teacherRatings: mapBy(rows.filter((r) => r.raterType === 'teacher'), 'attribute', (r) => r.rating),
    reflections: mapBy(rows.filter((r) => r.raterType === 'student' && r.reflection), 'attribute', (r) => r.reflection),
  });
}));

router.put('/student/isp', student, wrap(async (req, res) => {
  const ratings = req.body.ratings && typeof req.body.ratings === 'object' ? req.body.ratings : {};
  const reflections = req.body.reflections && typeof req.body.reflections === 'object' ? req.body.reflections : {};
  for (const attribute of ISP_ATTRIBUTES) {
    const v = ratings[attribute];
    const reflection = typeof reflections[attribute] === 'string' ? reflections[attribute].trim().slice(0, 4000) : null;
    if (v === '' || v === null || v === undefined) continue; // as in Flask, the reflection is saved together with a rating
    const $set = { rating: checkRating(v) };
    if (reflection !== null) $set.reflection = reflection;
    await IspRating.findOneAndUpdate({ student: req.user.id, raterType: 'student', attribute }, { $set }, { upsert: true });
  }
  res.json({});
}));

// ═══ Aptitude ═══════════════════════════════════════════════════════════════
router.get('/aptitude', staff, wrap(async (req, res) => {
  const locked = await lockedGrade(req);
  const grade = locked || str(req.query.grade) || MARK_GRADES[0];
  if (!MARK_GRADES.includes(grade)) throw bad('Choose a valid grade.');
  const section = str(req.query.section) || null;
  const students = await User.find({ role: ROLES.STUDENT, grade, ...(section ? { section } : {}) }).sort({ name: 1 }).lean();
  const sheets = await MarkSheet.find({ academicYear: ACADEMIC_YEAR, grade }).select('kind number subject strand section grade academicYear maxMarks marks.student marks.marks').lean();
  const apt = computeAptitude({ sheets, studentIds: students.map((s) => String(s._id)) });
  const strands = Object.keys(APTITUDE_STRANDS);
  res.json({
    grade, section: section || '', academicYear: ACADEMIC_YEAR, strands,
    students: students.map((s) => ({ ...person(s), aptitude: apt[String(s._id)] })),
    classAvg: Object.fromEntries(strands.map((st) => [st, (() => { const v = students.map((s) => apt[String(s._id)][st].score).filter((x) => x !== null); return v.length ? safeAvg(v) : null; })()])),
  });
}));

router.get('/student/aptitude', student, wrap(async (req, res) => {
  const me = await User.findById(req.user.id);
  const sheets = await MarkSheet.find({ academicYear: ACADEMIC_YEAR, grade: me.grade, 'marks.student': me._id }).select('kind number subject strand section grade academicYear maxMarks marks.student marks.marks').lean();
  const apt = computeAptitude({ sheets, studentIds: [String(me._id)] })[String(me._id)];
  res.json({ student: person(me), academicYear: ACADEMIC_YEAR, strands: Object.keys(APTITUDE_STRANDS), aptitude: apt, weights: APTITUDE_STRANDS });
}));

export default router;
