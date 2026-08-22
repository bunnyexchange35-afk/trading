import type { StaffPayload } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffPayload;
    }
  }
}

export {};
