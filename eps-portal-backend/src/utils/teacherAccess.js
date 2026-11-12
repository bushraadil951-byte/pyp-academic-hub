import { User } from '../models/User.js';
import { HttpError } from './helpers.js';

const ALL_GRADES = ['Nursery', 'KG-1', 'KG-2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];

// Rules { grade, section, canEdit } built from viewGrade+viewSections and editGrade+editSections.
// Old accounts (grade, viewSection, editSection) still work until the teacher is saved once.
export function rulesOf(u) {
  if (!u) return [];
  const make = (grade, sections, canEdit) => {
    if (!grade) return [];
    const grades = grade === 'ALL' ? ALL_GRADES : [grade];
    const secs = sections.length ? sections : [null];
    return grades.flatMap((g) => secs.map((section) => ({ grade: g, section, canEdit })));
  };
  const list = (many, one) => (many && many.length ? [...many] : one ? [one] : []);
  const rules = [
    ...make(u.viewGrade, list(u.viewSections, u.viewSection), false),
    ...make(u.editGrade ?? u.grade, list(u.editSections, u.editSection), true),
  ];
  const merged = new Map();
  for (const r of rules) {
    const key = `${r.grade}|${r.section}`;
    merged.set(key, { ...r, canEdit: r.canEdit || !!merged.get(key)?.canEdit });
  }
  return [...merged.values()];
}

export async function loadAccess(userId) {
  const u = await User.findById(userId).select('grade editGrade editSection editSections viewGrade viewSection viewSections').lean();
  return { rules: rulesOf(u) };
}

const covers = (r, grade, section) => r.grade === grade && (!r.section || r.section === section);
export const viewGrades = (acc) => [...new Set(acc.rules.map((r) => r.grade))];
export const canViewStudent = (acc, s) => acc.rules.some((r) => covers(r, s.grade, s.section));
export const canEditStudent = (acc, s) => acc.rules.some((r) => r.canEdit && covers(r, s.grade, s.section));
export const canEditSlot = (acc, grade, section) => acc.rules.some((r) => r.canEdit && r.grade === grade && (!r.section || r.section === section));

export const studentFilter = (acc) => (acc.rules.length
  ? { $or: acc.rules.map((r) => ({ grade: r.grade, ...(r.section ? { section: r.section } : {}) })) }
  : { _id: { $in: [] } });

export function sectionsFor(acc, grade) {
  const rs = acc.rules.filter((r) => r.grade === grade);
  if (rs.some((r) => !r.section)) return null;
  return [...new Set(rs.map((r) => r.section))];
}

// Section part of a student query for this grade; 403 if the teacher may not see what was asked for.
export function sectionQuery(acc, grade, requested) {
  if (!acc) return requested ? { section: requested } : {};
  const allowed = sectionsFor(acc, grade);
  if (allowed && allowed.length === 0) throw new HttpError(403, 'You do not have access to this grade.');
  if (requested) {
    if (allowed && !allowed.includes(requested)) throw new HttpError(403, 'You do not have access to this section.');
    return { section: requested };
  }
  return allowed ? { section: { $in: allowed } } : {};
}

export function assertViewGrade(acc, grade) {
  if (acc && !viewGrades(acc).includes(grade)) throw new HttpError(403, 'You do not have access to this grade.');
}

// What the grade / section dropdowns should offer.
export function uiScope(acc, allGrades, allSections) {
  if (!acc) return { grades: allGrades, sections: allSections, gradeLocked: false, sectionLocked: false };
  const mine = viewGrades(acc);
  const grades = allGrades.filter((g) => mine.includes(g));
  const rs = acc.rules.filter((r) => grades.includes(r.grade));
  const all = rs.some((r) => !r.section);
  const sections = all ? allSections : allSections.filter((s) => rs.some((r) => r.section === s));
  return { grades, sections, gradeLocked: grades.length <= 1, sectionLocked: !all && sections.length <= 1 };
}

export function describe(rules) {
  const by = new Map();
  for (const r of rules) (by.get(r.grade) ?? by.set(r.grade, []).get(r.grade)).push(r.section);
  const text = (secs) => (secs.includes(null) ? 'all sections' : [...secs].sort().join(', '));
  const parts = ALL_GRADES.filter((g) => by.has(g)).map((g) => [g, text(by.get(g))]);
  if (parts.length === ALL_GRADES.length && parts.every(([, t]) => t === parts[0][1])) return `All grades (${parts[0][1]})`;
  return parts.map(([g, t]) => `${g} (${t})`).join(', ');
}
