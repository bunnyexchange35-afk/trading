import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db, getSetting, setSetting, isLockdown, logActivity, logSecurity, raiseAlert } from '../db.js';
import { verifyPassword, signToken, permissionsFor } from '../auth.js';
import { config } from '../config.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { nowIso } from '../helpers.js';

export const authRouter = Router();

interface StaffRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'master_admin' | 'admin' | 'support' | 'viewer';
  active: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_location: string | null;
  mfa_enabled: number;
  avatar: string | null;
}

function staffPublic(s: StaffRow) {
  return {
    id: s.id,
    username: s.username,
    email: s.email,
    full_name: s.full_name,
    role: s.role,
    avatar: s.avatar,
    mfa_enabled: !!s.mfa_enabled,
    last_login_at: s.last_login_at,
    last_login_ip: s.last_login_ip,
    last_login_location: s.last_login_location,
    permissions: permissionsFor(s.role),
  };
}

const clientIp = (req: { ip?: string; headers: Record<string, unknown> }) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

function recordLogin(staffId: number | null, username: string, ip: string, success: number, req: { headers: Record<string, unknown> }) {
  db.prepare(
    `INSERT INTO login_history (staff_id, username, ip, location, device, browser, success)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    staffId,
    username,
    ip,
    '—',
    (req.headers['user-agent'] as string)?.slice(0, 80) ?? '—',
    (req.headers['user-agent'] as string)?.slice(0, 80) ?? '—',
    success
  );
}

// Public status (used by the login page: last login + lockdown flag).
authRouter.get('/status', (_req, res) => {
  const master = db
    .prepare('SELECT last_login_at, last_login_ip, last_login_location FROM staff WHERE role = ? LIMIT 1')
    .get('master_admin') as { last_login_at: string; last_login_ip: string; last_login_location: string } | undefined;
  res.json({
    data: {
      appName: getSetting('site_title', 'Hype Coin Control'),
      version: getSetting('app_version', '2.4.1'),
      lockdown: isLockdown(),
      maintenance: getSetting('maintenance_mode', 'false') === 'true',
      lastLogin: master
        ? { time: master.last_login_at, ip: master.last_login_ip, location: master.last_login_location }
        : null,
    },
  });
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const ip = clientIp(req);
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  const row = db
    .prepare('SELECT * FROM staff WHERE username = ? OR email = ?')
    .get(String(username), String(username)) as StaffRow | undefined;

  if (!row || !verifyPassword(String(password), row.password_hash)) {
    recordLogin(row?.id ?? null, String(username), ip, 0, req);
    logSecurity('Failed login attempt', 'warning', { ip, username: String(username), details: 'Invalid credentials' });
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  if (!row.active) {
    recordLogin(row.id, row.username, ip, 0, req);
    res.status(403).json({ error: 'Account is disabled' });
    return;
  }

  if (row.mfa_enabled) {
    const temp = jwt.sign({ staffId: row.id, scope: 'mfa' }, config.jwtSecret, { expiresIn: '5m' });
    recordLogin(row.id, row.username, ip, 0, req);
    res.json({ mfaRequired: true, tempToken: temp, hint: 'Demo code: 123456' });
    return;
  }

  finishLogin(row, ip, req, res);
});

function finishLogin(row: StaffRow, ip: string, req: { headers: Record<string, unknown> }, res: { json: (b: unknown) => void }) {
  db.prepare(
    `UPDATE staff SET last_login_at = ?, last_login_ip = ?, last_login_location = ? WHERE id = ?`
  ).run(nowIso(), ip, 'Secure node', row.id);
  recordLogin(row.id, row.username, ip, 1, req);
  logActivity({ id: row.id, full_name: row.full_name }, 'auth', 'login', { type: 'staff', id: row.id }, 'Signed in');
  const token = signToken({ id: row.id, username: row.username, full_name: row.full_name, role: row.role, email: row.email });
  res.json({ token, staff: staffPublic(row) });
}

authRouter.post('/mfa/verify', (req, res) => {
  const { tempToken, code } = req.body ?? {};
  if (!tempToken || !code) {
    res.status(400).json({ error: 'tempToken and code are required' });
    return;
  }
  let decoded: { staffId: number; scope: string } | null = null;
  try {
    decoded = jwt.verify(tempToken, config.jwtSecret) as { staffId: number; scope: string };
  } catch {
    decoded = null;
  }
  if (!decoded || decoded.scope !== 'mfa') {
    res.status(401).json({ error: 'MFA session expired. Please sign in again.' });
    return;
  }
  // Placeholder TOTP — swap for a real OTP library (otplib) in production.
  if (String(code) !== '123456') {
    logSecurity('MFA verification failed', 'warning', { details: 'Wrong 6-digit code' });
    res.status(401).json({ error: 'Invalid verification code (demo code: 123456)' });
    return;
  }
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(decoded.staffId) as StaffRow | undefined;
  if (!row) {
    res.status(401).json({ error: 'Staff account not found' });
    return;
  }
  finishLogin(row, clientIp(req), req, res);
});

// Passkey / face-scan design hooks (not implemented — reserved for WebAuthn / biometrics).
authRouter.post('/passkey/register', (_req, res) => {
  res.json({ data: { status: 'not_configured', message: 'Passkey (WebAuthn) integration is a design hook. Register will be enabled when configured.' } });
});
authRouter.post('/face-scan/enroll', (_req, res) => {
  res.json({ data: { status: 'not_configured', message: 'Face scan enrollment is a design hook for biometric auth.' } });
});

authRouter.get('/me', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.staff!.id) as StaffRow | undefined;
  if (!row) {
    res.status(401).json({ error: 'Staff account not found' });
    return;
  }
  res.json({
    data: {
      staff: staffPublic(row),
      lockdown: isLockdown(),
      maintenance: getSetting('maintenance_mode', 'false') === 'true',
      settings: { siteTitle: getSetting('site_title'), version: getSetting('app_version') },
    },
  });
});

authRouter.post('/logout', authRequired, (req, res) => {
  logActivity({ id: req.staff!.id, full_name: req.staff!.full_name }, 'auth', 'logout', { type: 'staff', id: req.staff!.id }, 'Signed out');
  res.json({ data: { ok: true } });
});

// Emergency lockdown — reachable from the login page using the master password (panic button).
authRouter.post('/lockdown', (req, res) => {
  const { password } = req.body ?? {};
  const master = db.prepare('SELECT * FROM staff WHERE role = ? LIMIT 1').get('master_admin') as StaffRow | undefined;
  if (!master || !verifyPassword(String(password ?? ''), master.password_hash)) {
    logSecurity('Lockdown attempt rejected', 'critical', { ip: clientIp(req), details: 'Wrong master password' });
    res.status(401).json({ error: 'Master password required to trigger lockdown' });
    return;
  }
  setSetting('lockdown', 'true');
  raiseAlert('Emergency lockdown triggered', 'All user-facing actions are now frozen by master admin.', 'critical', 'security');
  logActivity({ id: master.id, full_name: master.full_name }, 'security', 'lockdown', { type: 'system' }, 'Emergency lockdown ENABLED');
  res.json({ data: { lockdown: true, message: '🔒 Emergency lockdown is now active. All user actions are frozen.' } });
});

// Toggle lockdown from the dashboard (master only).
authRouter.post('/lockdown/toggle', authRequired, requirePermission('lockdown.manage'), (req, res) => {
  const next = !isLockdown();
  setSetting('lockdown', String(next));
  if (next) {
    raiseAlert('Emergency lockdown triggered', `Enabled by ${req.staff!.full_name}.`, 'critical', 'security');
  }
  logActivity({ id: req.staff!.id, full_name: req.staff!.full_name }, 'security', next ? 'lockdown' : 'unlock', { type: 'system' }, `Lockdown ${next ? 'enabled' : 'disabled'}`);
  res.json({ data: { lockdown: next } });
});
