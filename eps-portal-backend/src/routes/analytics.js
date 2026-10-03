// IBT (mock test) analytics for admins and teachers. Replaces build_analytics() / /admin/analytics in app.py.
import { Router } from 'express';
import { GRADES, ROLES, SUBJECTS } from '../config.js';
import { User } from '../models/User.js';
import { TestResult } from '../models/TestResult.js';
import { requireAuth } from '../middleware/auth.js';
import { round1, safeAvg } from '../utils/math.js';
import { bad, str, wrap } from '../utils/helpers.js';

const router = Router();
const SECTIONS = ['A', 'B', 'C', 'D'];
const avgOf = (rows) => safeAvg(rows.map((r) => r.percent));

router.get('/', requireAuth(ROLES.ADMIN, ROLES.TEACHER), wrap(async (req, res) => {
  // Teachers are locked to their own grade, as in /teacher/analytics.
  const lockedGrade = req.user.role === ROLES.TEACHER ? (await User.findById(req.user.id).select('grade'))?.grade || null : null;
  const grade = lockedGrade || str(req.query.grade) || null;
  const section = str(req.query.section) || null;
  const subject = str(req.query.subject) || null;
  if (grade && !GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (subject && !SUBJECTS.includes(subject)) throw bad('Choose a valid subject.');

  const students = await User.find({ role: ROLES.STUDENT, ...(grade ? { grade } : {}), ...(section ? { section } : {}) }).select('name grade section').lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const raw = await TestResult.find({ student: { $in: students.map((s) => s._id) } })
    .select('student test percent sectionScores').populate('test', 'subject').lean();

  // One flat list: every result with its student's grade/section and its test's subject.
  const results = raw
    .filter((r) => r.test && byId.has(String(r.student)) && (!subject || r.test.subject === subject))
    .map((r) => ({ percent: r.percent, sectionScores: r.sectionScores || {}, subject: r.test.subject, student: byId.get(String(r.student)) }));

  const sectionPcts = {};
  const strandPcts = Object.fromEntries(SUBJECTS.map((s) => [s, {}]));
  for (const r of results) {
    for (const [sec, v] of Object.entries(r.sectionScores)) {
      if (!v || !(v.total > 0)) continue;
      const pct = round1((v.correct / v.total) * 100);
      (sectionPcts[sec] ??= []).push(pct);
      if (strandPcts[r.subject]) (strandPcts[r.subject][sec] ??= []).push(pct);
    }
  }
  const toList = (obj) => Object.entries(obj).map(([name, v]) => ({ section: name, avg: safeAvg(v) })).sort((a, b) => b.avg - a.avg);

  const studentRows = students.map((s) => {
    const mine = results.filter((r) => String(r.student._id) === String(s._id));
    return {
      id: String(s._id), name: s.name, grade: s.grade, section: s.section || '', testsTaken: mine.length, overallAvg: avgOf(mine),
      subjectAvgs: Object.fromEntries(SUBJECTS.map((sub) => [sub, avgOf(mine.filter((r) => r.subject === sub))])),
    };
  }).sort((a, b) => b.overallAvg - a.overallAvg);

  res.json({
    filters: { grade: grade || '', section: section || '', subject: subject || '' },
    options: { grades: lockedGrade ? [lockedGrade] : GRADES, sections: SECTIONS, subjects: SUBJECTS, gradeLocked: !!lockedGrade },
    totals: {
      overallAvg: avgOf(results), above80: results.filter((r) => r.percent >= 80).length, below60: results.filter((r) => r.percent < 60).length,
      results: results.length, students: students.length,
    },
    byGrade: GRADES.map((g) => ({ grade: g, avg: avgOf(results.filter((r) => r.student.grade === g)), count: results.filter((r) => r.student.grade === g).length, students: students.filter((s) => s.grade === g).length })),
    bySubject: SUBJECTS.map((sub) => ({ subject: sub, avg: avgOf(results.filter((r) => r.subject === sub)), count: results.filter((r) => r.subject === sub).length })),
    gradeSubject: GRADES.map((g) => ({ grade: g, ...Object.fromEntries(SUBJECTS.map((sub) => [sub, avgOf(results.filter((r) => r.student.grade === g && r.subject === sub))])) })),
    sectionAvgs: toList(sectionPcts),
    subjectStrands: Object.fromEntries(SUBJECTS.map((sub) => [sub, toList(strandPcts[sub])])),
    studentRows,
  });
}));

export default router;
