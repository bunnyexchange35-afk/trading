import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'hype-coin-control-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  clientOrigin: process.env.CLIENT_ORIGIN ?? '*',
  dbPath:
    process.env.DB_PATH ??
    path.resolve(__dirname, '..', 'data', 'hype-control.db'),
  ai: {
    apiKey: process.env.AI_API_KEY ?? '',
    apiUrl: process.env.AI_API_URL ?? '',
  },
  email: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? 'no-reply@hypecoincontrol.io',
  },
};

export const APP_NAME = 'Hype Coin Control';
