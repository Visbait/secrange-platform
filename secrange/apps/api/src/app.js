import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/error.js';

import { auth } from './modules/auth.routes.js';
import { courses } from './modules/courses.routes.js';
import { progress } from './modules/progress.routes.js';
import { profile } from './modules/profile.routes.js';
import { payments } from './modules/payments.routes.js';
import { webhooks } from './modules/webhooks.routes.js';

export function buildApp() {
  const app = express();
  app.set('trust proxy', 1);                 // behind a load balancer
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: config.webOrigin, credentials: true }));

  // Stripe webhook needs the RAW body — mount it BEFORE the JSON parser.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooks);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Health/readiness (used by load balancer + k8s probes)
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', async (_req, res) => {
    try { const { pool } = await import('./db/pool.js'); await pool.query('SELECT 1'); res.json({ ready: true }); }
    catch { res.status(503).json({ ready: false }); }
  });

  // Throttle auth endpoints harder than the rest.
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 50, standardHeaders: true, legacyHeaders: false });
  const apiLimiter  = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });

  app.use('/api/auth', authLimiter, auth);
  app.use('/api', apiLimiter);
  app.use('/api/courses', courses);
  app.use('/api/me', progress);
  app.use('/api/me', profile);
  app.use('/api/payments', payments);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
