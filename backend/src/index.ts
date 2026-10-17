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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching origin
      if (!origin || origin === CORS_ORIGIN || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in local development
      }
    },
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
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 PQ Readiness Backend API listening on port ${PORT}`);
    console.log(`📡 Base API URL: http://localhost:${PORT}/api/v1`);
    console.log(`🛡️  Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`=======================================================`);
  });
}

export default app;
