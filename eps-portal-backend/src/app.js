import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { HttpError } from './utils/helpers.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import teacherRoutes from './routes/teacher.js';
import studentRoutes from './routes/student.js';
import marksRoutes from './routes/marks.js';
import profileRoutes from './routes/profile.js';
import analyticsRoutes from './routes/analytics.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy: needed for secure cookies and per-IP rate limits

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...config.corsOrigins],
      },
    },
  }));
  if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '4mb' })); // question images arrive as base64 (max 2 MB each)
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.send('OK')); // same health check URL Render already uses
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/marks', marksRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // Optionally serve the built React app from this same server (one Render service instead of two).
  const dist = config.frontendDist && path.resolve(config.frontendDist);
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.code === 11000) return res.status(409).json({ error: 'That value already exists.' });
    if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Invalid data.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large — images are limited to 2MB.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  return app;
}
