// Attendance: staff mark absences per class per day and note events (holiday, PTM...); students see their own monthly attendance %.
import { Router } from 'express';
import { MARK_SECTIONS, ROLES } from '../config.js';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceEvent, EVENT_TYPES } from '../models/AttendanceEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, bad, notFound, oid, str, wrap } from '../utils/helpers.js';
import { MIN_PERCENT, summarise, summariseByMonth } from '../utils/attendanceMath.js';
import { assertViewGrade, canEditSlot, loadAccess, sectionQuery, uiScope } from '../utils/teacherAccess.js';

const router = Router();
const staff = requireAuth(ROLES.TEACHER, ROLES.ADMIN);
const GRADES = ['Nursery', 'KG-1', 'KG-2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];

// Admins: acc is null and nothing is restricted. Teachers: view / edit rules from the Teachers page.
const teacherAcc = async (req) => (req.user?.role === ROLES.TEACHER ? loadAccess(req.user.id) : null);
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const validMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const inMonth = (m) => ({ $gte: `${m}-01`, $lte: `${m}-31` });

function classOf(q) {
  const grade = str(q.grade), section = str(q.section);
  if (!GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (!MARK_SECTIONS.includes(section)) throw bad('Choose a section.');
  return { grade, section };
}
const roster = (grade, section) => User.find({ role: ROLES.STUDENT, grade, section }).sort({ name: 1 }).select('name section').lean();

// Events that apply to one class (whole school, its grade, or its section).
const classEventQuery = (grade, section, extra = {}) => ({ ...extra, $or: [{ grade: null }, { grade, section: null }, { grade, section }] });
const appliesTo = (e, grade, section) => !e.grade || (e.grade === grade && (!e.section || e.section === section));
// Dates that this class's events say should NOT count as school days.
const excludedDates = (events, grade, section) => new Set(events.filter((e) => !e.countAttendance && appliesTo(e, grade, section)).map((e) => e.date));
const counted = (sheets, excluded) => sheets.filter((sh) => !excluded.has(sh.date));
const eventJson = (e) => ({ id: String(e._id), date: e.date, grade: e.grade, section: e.section, type: e.type, title: e.title, note: e.note || '', countAttendance: e.countAttendance });

// ── Staff ────────────────────────────────────────────────────────────────────
router.get('/config', staff, wrap(async (req, res) => {
  const scope = uiScope(await teacherAcc(req), GRADES, MARK_SECTIONS);
  res.json({ ...scope, minPercent: MIN_PERCENT, today: todayIST(), eventTypes: EVENT_TYPES, isAdmin: req.user.role === ROLES.ADMIN });
}));

// The class for one day: every student with their current mark (0 = present, 0.5 = half day, 1 = absent), plus that day's events.
router.get('/sheet', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const { grade, section } = classOf(req.query);
  const date = str(req.query.date);
  if (!validDate(date)) throw bad('Choose a valid date.');
  assertViewGrade(acc, grade);
  sectionQuery(acc, grade, section);                       // 403 if this section is not theirs
  const [students, doc, events] = await Promise.all([
    roster(grade, section), Attendance.findOne({ date, grade, section }).lean(),
    AttendanceEvent.find(classEventQuery(grade, section, { date })).sort({ created: 1 }).lean(),
  ]);
  const value = new Map((doc?.absences || []).map((a) => [String(a.student), a.value]));
  res.json({
    date, grade, section, taken: !!doc, today: todayIST(),
    canEdit: !acc || canEditSlot(acc, grade, section),
    counted: !events.some((e) => !e.countAttendance),
    events: events.map(eventJson),
    students: students.map((s) => ({ id: String(s._id), name: s.name, value: value.get(String(s._id)) ?? 0 })),
  });
}));

// Save the day. body: { date, grade, section, absences: { "<studentId>": 0.5 | 1 } }  (anyone not listed was present)
router.put('/sheet', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const { grade, section } = classOf(req.body);
  const date = str(req.body.date);
  if (!validDate(date)) throw bad('Choose a valid date.');
  if (date > todayIST()) throw bad('You cannot mark attendance for a future date.');
  if (acc && !canEditSlot(acc, grade, section)) throw new HttpError(403, `You do not have editing access for ${grade} section ${section}.`);
  const ids = new Set((await roster(grade, section)).map((s) => String(s._id)));
  const input = req.body.absences && typeof req.body.absences === 'object' ? req.body.absences : {};
  const absences = [];
  for (const [id, v] of Object.entries(input)) {
    const value = Number(v);
    if (value === 0) continue;
    if (!ids.has(id)) throw bad('A student in the list is not in this class.');
    if (value !== 0.5 && value !== 1) throw bad('Attendance must be present, half day (0.5) or absent (1).');
    absences.push({ student: id, value });
  }
  await Attendance.findOneAndUpdate({ date, grade, section }, { $set: { absences, markedBy: req.user.id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ saved: true, students: ids.size, absent: absences.length });
}));

// ── Events (holiday, PTM, meeting...) ────────────────────────────────────────
// Events visible for a class (or a whole grade) in a month.
router.get('/events', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const grade = str(req.query.grade), section = str(req.query.section) || null;
  const month = str(req.query.month) || todayIST().slice(0, 7);
  if (!GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !MARK_SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (!validMonth(month)) throw bad('Choose a valid month.');
  assertViewGrade(acc, grade);
  const sec = sectionQuery(acc, grade, section).section;
  const q = { date: inMonth(month), $or: [{ grade: null }, { grade, section: null }, { grade, section: sec ?? { $ne: null } }] };
  const events = await AttendanceEvent.find(q).sort({ date: 1, created: 1 }).lean();
  res.json({
    month,
    events: events.map((e) => ({
      ...eventJson(e),
      // Whole-school and whole-grade events belong to admins; a class event can be removed by anyone who may edit that class.
      canDelete: !acc || (!!e.grade && !!e.section && canEditSlot(acc, e.grade, e.section)),
    })),
  });
}));

// body: { date, grade, section, scope: 'class' | 'grade' | 'school', type, title, note, countAttendance }
router.post('/events', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const date = str(req.body.date);
  const type = str(req.body.type);
  const title = str(req.body.title) || (type === 'Holiday' ? 'No school' : '');
  const scope = str(req.body.scope) || 'class';
  if (!validDate(date)) throw bad('Choose a valid date.');
  if (!EVENT_TYPES.includes(type)) throw bad('Choose a valid event type.');
  if (!title) throw bad('Give the event a short title.');
  if (title.length > 120 || str(req.body.note).length > 500) throw bad('The title or note is too long.');
  if (typeof req.body.countAttendance !== 'boolean') throw bad('Say whether attendance counts for this day.');

  let grade = null, section = null;
  if (scope === 'class') ({ grade, section } = classOf(req.body));
  else if (scope === 'grade') { grade = str(req.body.grade); if (!GRADES.includes(grade)) throw bad('Choose a valid grade.'); }
  else if (scope !== 'school') throw bad('Choose a valid scope.');
  if (acc) {
    if (scope !== 'class') throw new HttpError(403, 'Only an administrator can add an event for a whole grade or the whole school.');
    if (!canEditSlot(acc, grade, section)) throw new HttpError(403, `You do not have editing access for ${grade} section ${section}.`);
  }
  const e = await AttendanceEvent.create({ date, grade, section, type, title, note: str(req.body.note), countAttendance: req.body.countAttendance, createdBy: req.user.id });
  res.json(eventJson(e));
}));

router.delete('/events/:id', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const e = await AttendanceEvent.findById(oid(req.params.id));
  if (!e) throw notFound('Event not found.');
  if (acc && !(e.grade && e.section && canEditSlot(acc, e.grade, e.section))) throw new HttpError(403, 'Only an administrator can remove this event.');
  await e.deleteOne();
  res.json({ removed: true });
}));

// Monthly report for a grade (one section, or every section the staff member may see). Days an event marks as "not counted" are left out.
router.get('/report', staff, wrap(async (req, res) => {
  const acc = await teacherAcc(req);
  const grade = str(req.query.grade), section = str(req.query.section) || null;
  const month = str(req.query.month) || todayIST().slice(0, 7);
  if (!GRADES.includes(grade)) throw bad('Choose a valid grade.');
  if (section && !MARK_SECTIONS.includes(section)) throw bad('Choose a valid section.');
  if (!validMonth(month)) throw bad('Choose a valid month.');
  assertViewGrade(acc, grade);
  const secFilter = sectionQuery(acc, grade, section).section;
  const [students, sheets, events] = await Promise.all([
    User.find({ role: ROLES.STUDENT, grade, ...(secFilter ? { section: secFilter } : {}) }).sort({ section: 1, name: 1 }).select('name section').lean(),
    Attendance.find({ grade, date: inMonth(month), ...(secFilter ? { section: secFilter } : {}) }).lean(),
    AttendanceEvent.find({ date: inMonth(month), $or: [{ grade: null }, { grade, section: null }, { grade, section: secFilter ?? { $ne: null } }] }).sort({ date: 1 }).lean(),
  ]);
  res.json({
    grade, section: section || '', month, minPercent: MIN_PERCENT,
    events: events.map(eventJson),
    students: students.map((s) => {
      const mine = counted(sheets.filter((sh) => sh.section === s.section), excludedDates(events, grade, s.section));
      const { absences, ...sum } = summarise(mine, s._id);
      return { id: String(s._id), name: s.name, section: s.section || '', ...sum };
    }),
  });
}));

// ── Student: own attendance only ─────────────────────────────────────────────
router.get('/my', requireAuth(ROLES.STUDENT), wrap(async (req, res) => {
  const s = await User.findById(req.user.id).select('name grade section').lean();
  if (!s) throw notFound('Student not found.');
  const ready = s.grade && s.section;
  const [sheets, events] = ready
    ? await Promise.all([Attendance.find({ grade: s.grade, section: s.section }).lean(), AttendanceEvent.find(classEventQuery(s.grade, s.section)).sort({ date: 1 }).lean()])
    : [[], []];
  res.json({
    student: { name: s.name, grade: s.grade, section: s.section || '' },
    minPercent: MIN_PERCENT, currentMonth: todayIST().slice(0, 7),
    months: summariseByMonth(counted(sheets, excludedDates(events, s.grade, s.section)), s._id),
    events: events.map(({ date, type, title, note, countAttendance }) => ({ date, type, title, note: note || '', countAttendance })),
  });
}));

export default router;
