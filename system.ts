import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, getSetting, setSetting, logActivity, logSecurity, raiseAlert } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { hashPassword } from '../auth.js';
import { config } from '../config.js';
import { parse } from '../helpers.js';

export const systemRouter = Router();

// ── Health (public) ──────────────────────────────────────────────────────
systemRouter.get('/health', (_req, res) => {
  let dbOk = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    dbOk = false;
  }
  res.json({
    data: {
      status: dbOk ? 'ok' : 'degraded',
      api: 'operational',
      db: dbOk ? 'operational' : 'down',
      uptime: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Activity logs ────────────────────────────────────────────────────────
systemRouter.get('/logs/activity', authRequired, requirePermission('logs.view'), (req, res) => {
  const q = String(req.query.q ?? '');
  const module = String(req.query.module ?? '');
  const date = String(req.query.date ?? '');
  let sql = 'SELECT * FROM activity_logs WHERE 1=1';
  const args: any[] = [];
  if (q) {
    sql += ' AND (actor_name LIKE ? OR action LIKE ? OR details LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  if (module && module !== 'all') {
    sql += ' AND module = ?';
    args.push(module);
  }
  if (date) {
    sql += ' AND date(created_at) = ?';
    args.push(date);
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  res.json({ data: db.prepare(sql).all(...args) });
});

// ── Security logs & alerts ───────────────────────────────────────────────
systemRouter.get('/logs/security', authRequired, requirePermission('security.view'), (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 500').all() });
});

systemRouter.get('/alerts', authRequired, requirePermission('security.view'), (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM alerts ORDER BY dismissed ASC, created_at DESC').all() });
});

systemRouter.post('/alerts/:id/dismiss', authRequired, requirePermission('security.view'), (req, res) => {
  db.prepare('UPDATE alerts SET dismissed = 1 WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'security', 'dismiss_alert', { type: 'alert', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

// ── Backups ──────────────────────────────────────────────────────────────
systemRouter.get('/backups', authRequired, requirePermission('logs.view'), (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM backup_points ORDER BY created_at DESC').all() });
});

systemRouter.post('/backups', authRequired, requirePermission('backups.manage'), (req, res) => {
  const dir = path.dirname(config.dbPath);
  const backupsDir = path.join(dir, 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `backup-${stamp}.db`;
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(config.dbPath, path.join(backupsDir, name));
    const size = fs.statSync(path.join(backupsDir, name)).size;
    const pretty = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
    db.prepare('INSERT INTO backup_points (name, size, status, note, created_by) VALUES (?, ?, ?, ?, ?)').run(name, pretty, 'completed', req.body?.note ?? 'Manual backup', req.staff?.id ?? null);
    logActivity(req.staff, 'backups', 'create', { type: 'backup' }, { name, size: pretty });
    res.status(201).json({ data: { ok: true, name, size: pretty } });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Backup failed' });
  }
});

// Restore is a design hook — a live restore would restart the process.
systemRouter.post('/backups/:id/restore', authRequired, requirePermission('backups.manage'), (req, res) => {
  const row = db.prepare('SELECT * FROM backup_points WHERE id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  logActivity(req.staff, 'backups', 'restore_request', { type: 'backup', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true, message: 'Restore queued. (Design hook — a live restore requires a process restart in production.)' } });
});

// ── Settings ─────────────────────────────────────────────────────────────
systemRouter.get('/settings', authRequired, requirePermission('logs.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM system_settings ORDER BY key').all();
  res.json({ data: rows });
});

systemRouter.patch('/settings', authRequired, requirePermission('settings.manage'), (req, res) => {
  const { key, value } = req.body ?? {};
  if (!key || value === undefined) {
    res.status(400).json({ error: 'key and value are required' });
    return;
  }
  setSetting(String(key), String(value));
  logActivity(req.staff, 'settings', 'update', { type: 'setting' }, { key, value });
  res.json({ data: { ok: true } });
});

// Assignable staff (anyone who can view leads needs this for assignment).
systemRouter.get('/staff/options', authRequired, requirePermission('leads.view'), (_req, res) => {
  const rows = db.prepare("SELECT id, full_name, role FROM staff WHERE active = 1 AND role IN ('master_admin','admin','support') ORDER BY id").all();
  res.json({ data: rows });
});

// ── Staff management (master only) ───────────────────────────────────────
systemRouter.get('/staff', authRequired, requirePermission('staff.manage'), (_req, res) => {
  const rows = db.prepare('SELECT id, username, email, full_name, role, active, last_login_at, last_login_ip, mfa_enabled, created_at FROM staff ORDER BY id').all();
  res.json({ data: rows });
});

systemRouter.post('/staff', authRequired, requirePermission('staff.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.username || !b.email || !b.full_name || !b.password || !b.role) {
    res.status(400).json({ error: 'username, email, full_name, password and role are required' });
    return;
  }
  try {
    const info = db
      .prepare('INSERT INTO staff (username, email, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(String(b.username), String(b.email), hashPassword(String(b.password)), String(b.full_name), String(b.role));
    logActivity(req.staff, 'staff', 'create', { type: 'staff', id: Number(info.lastInsertRowid) }, { username: b.username, role: b.role });
    res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
  } catch {
    res.status(409).json({ error: 'Username or email already exists' });
  }
});

systemRouter.patch('/staff/:id', authRequired, requirePermission('staff.manage'), (req, res) => {
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  for (const col of ['full_name', 'role', 'email', 'username']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(String(b[col]));
    }
  }
  if (b.active !== undefined) {
    fields.push('active = ?');
    args.push(b.active ? 1 : 0);
  }
  if (b.mfa_enabled !== undefined) {
    fields.push('mfa_enabled = ?');
    args.push(b.mfa_enabled ? 1 : 0);
  }
  if (b.password) {
    fields.push('password_hash = ?');
    args.push(hashPassword(String(b.password)));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  args.push(Number(req.params.id));
  db.prepare(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'staff', 'update', { type: 'staff', id: Number(req.params.id) }, Object.keys(b));
  res.json({ data: { ok: true } });
});

// ── Notifications ────────────────────────────────────────────────────────
systemRouter.get('/notifications', authRequired, (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all() });
});

systemRouter.post('/notifications/:id/read', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ data: { ok: true } });
});

// ── Quick actions ────────────────────────────────────────────────────────
systemRouter.post('/quick/lock-all', authRequired, requirePermission('users.status'), (req, res) => {
  const info = db.prepare("UPDATE users SET status = 'locked', updated_at = datetime('now') WHERE status IN ('active','cold','pending')").run();
  raiseAlert('Bulk lockdown', `${info.changes} user(s) locked by ${req.staff?.full_name}.`, 'critical', 'security');
  logActivity(req.staff, 'users', 'bulk_lock', { type: 'system' }, { locked: info.changes });
  res.json({ data: { ok: true, locked: info.changes } });
});

systemRouter.post('/quick/popup', authRequired, requirePermission('popups.manage'), (req, res) => {
  const b = req.body ?? {};
  db.prepare("INSERT INTO popups (title, body, type, target, pages, frequency, enabled) VALUES (?, ?, ?, 'all', ?, 'every_login', 1)").run(b.title ?? 'Announcement', b.body ?? '', b.type ?? 'info', JSON.stringify(['home']));
  raiseAlert('Global pop-up sent', String(b.title ?? 'Announcement'), 'info', 'communication');
  logActivity(req.staff, 'popups', 'global_popup', { type: 'system' }, { title: b.title });
  res.status(201).json({ data: { ok: true } });
});

systemRouter.post('/quick/campaign', authRequired, requirePermission('campaigns.manage'), (req, res) => {
  const b = req.body ?? {};
  const info = db.prepare("INSERT INTO campaigns (name, type, status, budget, spent, impressions, clicks, conversions, roi, created_by) VALUES (?, ?, 'active', ?, 0, 0, 0, 0, 0, ?)").run(b.name ?? 'Quick campaign', b.type ?? 'promo', Number(b.budget ?? 5000), req.staff?.id ?? null);
  raiseAlert('Campaign started', String(b.name ?? 'Quick campaign'), 'info', 'marketing');
  logActivity(req.staff, 'campaigns', 'quick_start', { type: 'campaign', id: Number(info.lastInsertRowid) }, { name: b.name });
  res.status(201).json({ data: { ok: true, id: Number(info.lastInsertRowid) } });
});

// Expose parsed helper for potential reuse.
export { parse };
