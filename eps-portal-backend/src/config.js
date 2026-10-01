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
