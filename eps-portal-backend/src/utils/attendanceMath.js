// Pure functions (no database access).
// Attendance % for a period = (school days - absence units) / school days x 100, where a full-day absence is 1 unit
// and a half-day absence is 0.5. A "school day" is a date on which the class's attendance was saved.
import { round1 } from './math.js';

export const MIN_PERCENT = 80;

// Used until an administrator sets the semester months. The whole year is Semester I + Semester II.
export const DEFAULT_TERMS = { sem1Start: '2026-03', sem1End: '2026-09', sem2Start: '2026-10', sem2End: '2027-03' };

// Saved days whose month ('YYYY-MM') falls between from and to, inclusive.
export const inRange = (sheets, from, to) => sheets.filter((sh) => { const m = sh.date.slice(0, 7); return m >= from && m <= to; });
export const termRange = (t, period) => (period === 'sem1' ? [t.sem1Start, t.sem1End] : period === 'sem2' ? [t.sem2Start, t.sem2End] : [t.sem1Start, t.sem2End]);

// sheets: this student's class, one document per saved day { date, absences: [{ student, value }] }
export function summarise(sheets, studentId) {
  const sid = String(studentId);
  const absences = [];
  let absentUnits = 0;
  for (const sh of sheets) {
    const a = sh.absences.find((x) => String(x.student) === sid);
    if (a) { absentUnits += a.value; absences.push({ date: sh.date, value: a.value }); }
  }
  absences.sort((x, y) => (x.date < y.date ? -1 : 1));
  const workingDays = sheets.length;
  const percent = workingDays ? round1(((workingDays - absentUnits) / workingDays) * 100) : null;
  return {
    workingDays,
    absentDays: absentUnits,
    presentDays: workingDays - absentUnits,
    percent,
    belowMinimum: percent !== null && percent < MIN_PERCENT,
    absences,
  };
}

// Group a class's saved days by month ('YYYY-MM') and summarise each month for one student, newest month first.
export function summariseByMonth(sheets, studentId) {
  const byMonth = new Map();
  for (const sh of sheets) {
    const m = sh.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(sh);
  }
  return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, list]) => ({ month, ...summarise(list, studentId) }));
}

// Semester I, Semester II and the whole year (Sem I + Sem II) for one student.
export function summariseTerms(sheets, studentId, t) {
  const strip = ({ absences, ...rest }) => rest;
  const s1 = inRange(sheets, t.sem1Start, t.sem1End), s2 = inRange(sheets, t.sem2Start, t.sem2End);
  return { sem1: strip(summarise(s1, studentId)), sem2: strip(summarise(s2, studentId)), annual: strip(summarise([...s1, ...s2], studentId)) };
}
