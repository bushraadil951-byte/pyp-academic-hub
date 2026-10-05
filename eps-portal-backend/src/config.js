import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me')) {
  throw new Error('JWT_SECRET must be set to a long random value in production.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eps_portal',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  frontendDist: process.env.FRONTEND_DIST || '',
};

export const ROLES = { ADMIN: 'Resource_Manager', TEACHER: 'teacher', STUDENT: 'student' };
export const GRADES = ['Grade 3', 'Grade 4', 'Grade 5'];
export const SUBJECTS = ['English', 'Mathematics', 'Science', 'Reasoning'];

export const ACADEMIC_YEAR = '2026-27';
export const MARK_GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
export const MARK_SECTIONS = ['A', 'B', 'C', 'D'];

// FA and SA are assessed strand by strand. A subject that is NOT listed here (Science, and all of DT) keeps one mark per student.
// To change the strands, edit the lists below: the entry screen, CSV upload, analytics and student reports all follow this.
const LANGUAGE_STRANDS = ['Viewing and Presenting', 'Listening and Speaking', 'Reading', 'Writing'];
const ASSESSMENT_STRANDS = {
  English: LANGUAGE_STRANDS,
  Hindi: LANGUAGE_STRANDS,
  Urdu: LANGUAGE_STRANDS,
  Maths: ['Numbers', 'Shape and Space', 'Measurement', 'Data Handling', 'Patterns and Function'],
  // Science: ['Living Things', 'Earth and Space', 'Materials and Matter', 'Forces and Energy'],   <- remove the // if Science is assessed by strands too
};

// DT, FA and SA all work the same way: a numbered sheet of marks per subject / grade / section.
export const MARK_KINDS = {
  DT: { label: 'Diagnostic Tests', short: 'DT', numbers: [1, 2, 3, 4, 5], subjects: ['English', 'Hindi', 'Maths', 'Science', 'Urdu', 'ICT'] },
  FA: { label: 'Formative Assessment', short: 'FA', numbers: [1, 2, 3, 4], subjects: ['English', 'Hindi', 'Maths', 'Science', 'Urdu'], strands: ASSESSMENT_STRANDS },
  SA: { label: 'Summative Assessment', short: 'SA', numbers: [1, 2], subjects: ['English', 'Hindi', 'Maths', 'Science', 'Urdu'], strands: ASSESSMENT_STRANDS },
};

// The entry columns of one assessment type: one per strand for strand subjects, one per subject otherwise.
// `key` is the lower-case CSV header, e.g. "english - reading" or "science".
export function columnsFor(kindCfg) {
  return kindCfg.subjects.flatMap((subject) => {
    const strands = kindCfg.strands?.[subject];
    return strands
      ? strands.map((strand) => ({ key: `${subject} - ${strand}`.toLowerCase(), label: `${subject} - ${strand}`, subject, strand }))
      : [{ key: subject.toLowerCase(), label: subject, subject, strand: null }];
  });
}
