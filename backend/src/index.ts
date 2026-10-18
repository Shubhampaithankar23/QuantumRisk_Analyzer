import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { standardLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import assetRoutes from './routes/asset.routes';
import importRoutes from './routes/import.routes';
import scannerRoutes from './routes/scanner.routes';
import assessmentRoutes from './routes/assessment.routes';
import reportRoutes from './routes/report.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
import { seedDatabase } from './lib/seed';

const rawCors = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.DEPLOYED_FRONTEND_URL,
  'http://localhost:3000',
]
  .filter(Boolean)
  .join(',');
const allowedOrigins = rawCors.split(',').map((o) => o.trim()).filter(Boolean);

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, health probes)
      if (!origin) return callback(null, true);

      // Allow localhost and local loopback
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }

      // Allow any Vercel deployment URL
      if (origin.endsWith('.vercel.app') || origin === 'https://vercel.app') {
        return callback(null, true);
      }

      // Allow explicitly specified origins from env (CORS_ORIGIN, FRONTEND_URL, DEPLOYED_FRONTEND_URL)
      if (
        allowedOrigins.some(
          (allowed) =>
            allowed === '*' ||
            allowed === origin ||
            (allowed.startsWith('http') && origin.startsWith(allowed))
        )
      ) {
        return callback(null, true);
      }

      // Default allow for seamless cloud deployment
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(standardLimiter);

// API v1 Base Route
app.use('/api/v1', healthRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api/v1', assetRoutes);
app.use('/api/v1', importRoutes);
app.use('/api/v1', scannerRoutes);
app.use('/api/v1', assessmentRoutes);
app.use('/api/v1', reportRoutes);
app.use('/api/v1/auth', authRoutes);

// Central Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`🚀 PQ Readiness Backend API listening on port ${PORT}`);
    console.log(`📡 Base API URL: http://localhost:${PORT}/api/v1`);
    console.log(`🛡️  Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`=======================================================`);

    // Ensure baseline institutional datasets and admin accounts exist
    try {
      await seedDatabase();
    } catch (seedErr) {
      console.warn('[Startup] Database auto-seed note:', seedErr);
    }
  });
}

export default app;
