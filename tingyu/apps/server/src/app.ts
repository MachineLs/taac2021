// Express app factory. Owned by the lead — agents add routes only inside their own module folders.
import express from 'express';
import { openDb } from './core/db';
import { config } from './core/config';
import { optionalAuth } from './core/auth';
import { errorMiddleware, notFound } from './core/errors';
import { clearListeners } from './core/events';
import { router as auth } from './modules/auth/routes';
import { router as counselors } from './modules/counselors/routes';
import { router as coupons } from './modules/coupons/routes';
import { router as appointments } from './modules/appointments/routes';
import { router as workbench } from './modules/workbench/routes';
import { router as applications } from './modules/applications/routes';
import { router as adminCommerce } from './modules/admin-commerce/routes';
import { router as intake } from './modules/intake/routes';
import { router as assessments } from './modules/assessments/routes';
import { router as mood } from './modules/mood/routes';
import { router as messages } from './modules/messages/routes';
import { router as notifications } from './modules/notifications/routes';
import { router as creators } from './modules/creators/routes';
import { router as adminOps } from './modules/admin-ops/routes';
import { registerListeners as registerCreatorListeners } from './modules/creators/listeners';

export function createApp(opts: { dbPath?: string } = {}) {
  openDb(opts.dbPath ?? config.dbPath);
  clearListeners();
  registerCreatorListeners();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(optionalAuth);
  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  for (const r of [auth, counselors, coupons, appointments, workbench, applications, adminCommerce,
    intake, assessments, mood, messages, notifications, creators, adminOps]) app.use('/api', r);
  app.use('/api', (_req, _res, next) => next(notFound('接口不存在')));
  app.use(errorMiddleware);
  return app;
}
