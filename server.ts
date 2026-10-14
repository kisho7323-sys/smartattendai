import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './server/db.js';

// Route handlers
import authRoutes from './server/routes/authRoutes.js';
import userRoutes from './server/routes/userRoutes.js';
import academicRoutes from './server/routes/academicRoutes.js';
import biometricRoutes from './server/routes/biometricRoutes.js';
import attendanceRoutes from './server/routes/attendanceRoutes.js';
import odLeaveRoutes from './server/routes/odLeaveRoutes.js';
import studyRoutes from './server/routes/studyRoutes.js';
import quizRoutes from './server/routes/quizRoutes.js';
import analyticsRoutes from './server/routes/analyticsRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'SmartAttend AI API Service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

app.get('/api/health/db', (req, res) => {
  res.json(db.getHealth());
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/biometrics', biometricRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/od-leave', odLeaveRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SmartAttend AI] Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SmartAttend AI] Failed to start server:', err);
  process.exit(1);
});
