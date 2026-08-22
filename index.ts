import express from 'express';
import cors from 'cors';
import { config, APP_NAME } from './config.js';
import { db, isLockdown } from './db.js';
import { seed } from './seed.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { usersRouter, balancesRouter, ordersRouter } from './routes/users.js';
import { leadsRouter, campaignsRouter, socialRouter, segmentsRouter } from './routes/crm.js';
import { chatsRouter, emailsRouter, popupsRouter } from './routes/comm.js';
import { websiteRouter } from './routes/website.js';
import { agreementsRouter } from './routes/agreements.js';
import { aiRouter } from './routes/ai.js';
import { systemRouter } from './routes/system.js';

// Seed the demo dataset on first boot (idempotent).
seed(false);

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Tiny request logger.
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const start = Date.now();
  _res.on('finish', () => {
    // eslint-disable-next-line no-console
    if (config.nodeEnv === 'development') {
      console.log(`${req.method} ${req.originalUrl} → ${_res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

// API index (self-documenting endpoint map).
app.get('/api', (_req, res) => {
  res.json({
    data: {
      app: APP_NAME,
      lockdown: isLockdown(),
      endpoints: [
        'auth', 'dashboard', 'users', 'balances', 'orders', 'leads', 'campaigns',
        'social', 'segments', 'chats', 'emails', 'popups', 'website', 'agreements',
        'ai', 'system',
      ].map((m) => `/api/${m}`),
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/social', socialRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/popups', popupsRouter);
app.use('/api/website', websiteRouter);
app.use('/api/agreements', agreementsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/system', systemRouter);

// 404 + error handling.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, '0.0.0.0', () => {
  const users = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  // eslint-disable-next-line no-console
  console.log(`\n⚡ ${APP_NAME} API ready → http://0.0.0.0:${config.port} (${users} users seeded)`);
  console.log('   Demo logins: master / Master@123 · n.kane / Admin@123\n');
});
