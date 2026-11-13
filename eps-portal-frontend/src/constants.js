// Mirrors the constants defined in the original app.py
export const SUBJECTS = ['English', 'Mathematics', 'Science', 'Reasoning'];
export const GRADES = ['Grade 3', 'Grade 4', 'Grade 5'];
export const DT_GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
export const EY_GRADES = ['Nursery', 'KG-1', 'KG-2'];
export const EY_NO_HINDI = ['Nursery', 'KG-1'];
export const EY_UOI = ['UOI-1', 'UOI-2', 'UOI-3', 'UOI-4'];
// Portal tiles for Nursery / KG-1 / KG-2 students: FA, SA and Aptitude only.
export const EY_STUDENT_MODULES = [
  { key: 'assessments', name: 'FA — Formative Assessments', icon: '📋', desc: 'Track your formative assessment progress in every subject.', to: '/student/progress/FA' },
  { key: 'assessments', name: 'SA — Summative Assessments', icon: '📋', desc: 'Track your summative assessment progress in every subject.', to: '/student/progress/SA' },
  { key: 'aptitude', name: 'Aptitude Profile', icon: '🎯', desc: 'See your aptitude strands, calculated from your FA and SA marks.', to: '/student/aptitude' },
];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const SECTIONS_BY_SUBJECT = {
  English: ['Reading Comprehension', 'Grammar', 'Spelling', 'Vocabulary', 'Punctuation'],
  Mathematics: ['Number Operations', 'Algebra', 'Geometry', 'Measurement', 'Data & Statistics'],
  Science: ['Life Science', 'Physical Science', 'Earth Science', 'Scientific Inquiry'],
  Reasoning: ['Verbal Reasoning', 'Non-Verbal Reasoning', 'Logical Thinking', 'Pattern Recognition'],
};

export const ROLES = { ADMIN: 'Resource_Manager', TEACHER: 'teacher', STUDENT: 'student' };
export const ROLE_LABELS = { Resource_Manager: 'Administrator', teacher: 'Teacher', student: 'Student' };

// Portal tiles per role. `to` is a React route; modules not yet ported point to /soon/:key.
export const PORTAL_MODULES = {
  Resource_Manager: [
    { key: 'ibt', name: 'IBT — Mock Tests', icon: '📝', desc: 'Create tests, manage question banks, and review scores and section-wise performance.', to: '/admin/tests' },
    { key: 'dt', name: 'DT — Diagnostic Tests', icon: '📊', desc: 'Enter diagnostic marks, view grade analytics and per-student progress across all DTs.', to: '/marks/DT' },
    { key: 'isp', name: 'ISP Profile Development', icon: '📖', desc: 'Track Islamic Studies Programme character attributes for each student.', to: '/isp' },
    { key: 'assessments', name: 'FA & SA — Formative & Summative', icon: '📋', desc: 'Enter formative and summative marks.', to: '/marks' },
    { key: 'ey', name: 'EY — Early Years', icon: '🧒', desc: 'Nursery, KG-1 and KG-2: enter FA and SA marks and view Aptitude.', to: '/ey' },
    { key: 'ib', name: 'IB Profile Development', icon: '🌱', desc: 'Rate students on Learner Profile attributes and ATL skills. View holistic growth reports per student.', to: '/ib' },
    { key: 'aptitude', name: 'Aptitude Analytics', icon: '🎯', desc: 'View class aptitude heatmap and per-strand student rankings.', to: '/aptitude' },
  ],
  teacher: [
    { key: 'ibt', name: 'IBT — Mock Tests', icon: '📝', desc: 'View student scores and section-wise analytics for mock tests.', to: '/teacher' },
    { key: 'dt', name: 'DT — Diagnostic Tests', icon: '📊', desc: 'Enter diagnostic marks, view grade analytics and per-student progress across all DTs.', to: '/marks/DT' },
    { key: 'assessments', name: 'FA & SA — Formative & Summative', icon: '📋', desc: 'Enter formative and summative marks.', to: '/marks' },
    { key: 'ey', name: 'EY — Early Years', icon: '🧒', desc: 'Nursery, KG-1 and KG-2: enter FA and SA marks and view Aptitude.', to: '/ey' },
    { key: 'ib', name: 'IB Profile Development', icon: '🌱', desc: 'Rate your students on Learner Profile attributes and ATL skills each term.', to: '/ib' },
    { key: 'isp', name: 'ISP Profile Development', icon: '📖', desc: 'Rate students on ISP character attributes anytime.', to: '/isp' },
    { key: 'aptitude', name: 'Aptitude Analytics', icon: '🎯', desc: 'View class aptitude heatmap and per-strand student rankings.', to: '/aptitude' },
  ],
  student: [
    { key: 'ibt', name: 'IBT — Mock Tests', icon: '📝', desc: 'Take active mock tests and review your past scores.', to: '/student' },
    { key: 'dt', name: 'DT — Diagnostic Tests', icon: '📊', desc: 'Track your diagnostic test progress across every subject.', to: '/student/progress/DT' },
    { key: 'ib', name: 'My IB Profile', icon: '🌱', desc: 'See your Learner Profile growth, self-rate each term, and write reflections.', to: '/student/ib' },
    { key: 'isp', name: 'My ISP Profile', icon: '📖', desc: 'Self-assess your Islamic character attributes anytime.', to: '/student/isp' },
    { key: 'aptitude', name: 'Aptitude Profile', icon: '🎯', desc: 'See your five aptitude strands, calculated from your FA, DT and SA marks.', to: '/student/aptitude' },
  ],
};

export const ACADEMIC_YEAR = '2026-27';

// Strand options for Science in FA and SA assessments.
// The stored subject remains 'Science'; only its display label changes to 'UOI'.
export const UOI_BY_ASSESSMENT = {
  SA: {
    1: ['UOI-1', 'UOI-2', 'UOI-3'],
    2: ['UOI-4', 'UOI-5', 'UOI-6'],
  },
  FA: ['UOI-1', 'UOI-2', 'UOI-3', 'UOI-4', 'UOI-5', 'UOI-6'],
};

// Keep this for any existing code that still imports UOI_STRANDS.
export const UOI_STRANDS = {
  SA1: ['UOI-1', 'UOI-2', 'UOI-3'],
  SA2: ['UOI-4', 'UOI-5', 'UOI-6'],
  FA: ['UOI-1', 'UOI-2', 'UOI-3', 'UOI-4', 'UOI-5', 'UOI-6'],
};

// Display Science as UOI outside IBT pages.
export const subjectLabel = (s) => (s === 'Science' ? 'UOI' : s);
