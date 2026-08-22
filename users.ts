import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { parse, nowIso } from '../helpers.js';

export const usersRouter = Router();
export const balancesRouter = Router();
export const ordersRouter = Router();

interface UserRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  phone: string | null;
  device: string | null;
  browser: string | null;
  ip: string | null;
  location: string | null;
  country: string | null;
  balance: number;
  limits: string;
  tags: string;
  lead_id: number | null;
  created_at: string;
  updated_at: string;
}

function decorate(u: UserRow) {
  return {
    ...u,
    balance: Number(u.balance),
    limits: parse(u.limits, {}),
    tags: parse<string[]>(u.tags, []),
  };
}

function findUserOr404(res: import('express').Response, id: number): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  return row;
}

// ── Users ────────────────────────────────────────────────────────────────
usersRouter.get('/', authRequired, requirePermission('users.view'), (req, res) => {
  const q = String(req.query.q ?? '');
  const status = String(req.query.status ?? '');
  let sql = 'SELECT * FROM users WHERE 1=1';
  const args: any[] = [];
  if (q) {
    sql += ' AND (full_name LIKE ? OR username LIKE ? OR email LIKE ? OR country LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    args.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = (db.prepare(sql).all(...args) as unknown as UserRow[]).map(decorate);
  const counts = ['active', 'cold', 'locked', 'blocked', 'pending'].map((s) => ({
    status: s,
    count: (db.prepare('SELECT COUNT(*) AS c FROM users WHERE status = ?').get(s) as { c: number }).c,
  }));
  res.json({ data: rows, meta: { counts } });
});

// Bulk status change (quick actions: lock all, etc.)
usersRouter.post('/bulk/status', authRequired, requirePermission('users.status'), (req, res) => {
  const { from, to, reason } = req.body ?? {};
  const allowed = ['active', 'cold', 'locked', 'blocked', 'pending'];
  if (!to || !allowed.includes(to)) {
    res.status(400).json({ error: `to must be one of ${allowed.join(', ')}` });
    return;
  }
  let sql = 'UPDATE users SET status = ?, updated_at = datetime(\'now\')';
  const args: any[] = [to];
  if (from && allowed.includes(from)) {
    sql += ' WHERE status = ?';
    args.push(from);
  }
  const info = db.prepare(sql).run(...args);
  logActivity(req.staff, 'users', 'bulk_status', { type: 'system' }, { from: from ?? 'all', to, reason: reason ?? null, changed: info.changes });
  res.json({ data: { ok: true, changed: info.changes, to } });
});

usersRouter.get('/:id', authRequired, requirePermission('users.view'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  const notes = db.prepare('SELECT * FROM user_notes WHERE user_id = ? ORDER BY created_at DESC').all(row.id);
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(row.id);
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(row.id);
  const statusHistory = db
    .prepare(
      `SELECT sh.*, s.full_name AS admin_name FROM status_history sh
       LEFT JOIN staff s ON s.id = sh.admin_id WHERE sh.user_id = ? ORDER BY sh.created_at DESC`
    )
    .all(row.id);
  res.json({ data: { ...decorate(row), notes, transactions, orders, statusHistory } });
});

usersRouter.post('/', authRequired, requirePermission('users.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.username || !b.email || !b.full_name) {
    res.status(400).json({ error: 'username, email and full_name are required' });
    return;
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO users (username, email, full_name, status, phone, country, location, limits, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(b.username),
        String(b.email),
        String(b.full_name),
        b.status ?? 'active',
        b.phone ?? null,
        b.country ?? null,
        b.location ?? null,
        JSON.stringify(b.limits ?? {}),
        JSON.stringify(b.tags ?? [])
      );
    logActivity(req.staff, 'users', 'create', { type: 'user', id: Number(info.lastInsertRowid) }, { name: b.full_name });
    res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
  } catch (e) {
    res.status(409).json({ error: 'Username or email already exists' });
  }
});

usersRouter.patch('/:id', authRequired, requirePermission('users.manage'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  const map: Record<string, string> = {
    full_name: 'full_name', username: 'username', email: 'email', phone: 'phone',
    country: 'country', location: 'location', device: 'device', browser: 'browser', ip: 'ip',
  };
  for (const [key, col] of Object.entries(map)) {
    if (b[key] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(String(b[key]));
    }
  }
  if (b.limits !== undefined) {
    fields.push('limits = ?');
    args.push(JSON.stringify(b.limits));
  }
  if (b.tags !== undefined) {
    fields.push('tags = ?');
    args.push(JSON.stringify(b.tags));
  }
  if (b.lead_id !== undefined) {
    fields.push('lead_id = ?');
    args.push(b.lead_id);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  fields.push("updated_at = datetime('now')");
  args.push(row.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'users', 'update', { type: 'user', id: row.id }, { fields: Object.keys(b) });
  res.json({ data: { ok: true } });
});

usersRouter.post('/:id/approve', authRequired, requirePermission('users.manage'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(row.id);
  db.prepare('INSERT INTO status_history (user_id, admin_id, from_status, to_status, reason) VALUES (?, ?, ?, ?, ?)').run(row.id, req.staff?.id ?? null, row.status, 'active', 'Approved');
  logActivity(req.staff, 'users', 'approve', { type: 'user', id: row.id }, row.username);
  res.json({ data: { ok: true, status: 'active' } });
});

usersRouter.post('/:id/reject', authRequired, requirePermission('users.manage'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  db.prepare("UPDATE users SET status = 'blocked', updated_at = datetime('now') WHERE id = ?").run(row.id);
  db.prepare('INSERT INTO status_history (user_id, admin_id, from_status, to_status, reason) VALUES (?, ?, ?, ?, ?)').run(row.id, req.staff?.id ?? null, row.status, 'blocked', 'Rejected by admin');
  logActivity(req.staff, 'users', 'reject', { type: 'user', id: row.id }, row.username);
  res.json({ data: { ok: true, status: 'blocked' } });
});

usersRouter.post('/:id/status', authRequired, requirePermission('users.status'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  const { status, reason } = req.body ?? {};
  const allowed = ['active', 'cold', 'locked', 'blocked'];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
    return;
  }
  db.prepare('UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, row.id);
  db.prepare('INSERT INTO status_history (user_id, admin_id, from_status, to_status, reason) VALUES (?, ?, ?, ?, ?)').run(row.id, req.staff?.id ?? null, row.status, status, reason ?? null);
  logActivity(req.staff, 'users', 'set_status', { type: 'user', id: row.id }, `${row.status} → ${status}`);
  res.json({ data: { ok: true, status } });
});

usersRouter.post('/:id/notes', authRequired, requirePermission('users.notes'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  const note = String(req.body?.note ?? '');
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  db.prepare('INSERT INTO user_notes (user_id, admin_id, note) VALUES (?, ?, ?)').run(row.id, req.staff?.id ?? null, note);
  logActivity(req.staff, 'users', 'note', { type: 'user', id: row.id }, note.slice(0, 120));
  res.status(201).json({ data: { ok: true } });
});

usersRouter.get('/:id/activity', authRequired, requirePermission('users.view'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.id));
  if (!row) return;
  const tx = (db.prepare('SELECT id, type, amount, reason, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').all(row.id) as any[]).map((t) => ({ kind: 'transaction', ...t }));
  const orders = (db.prepare('SELECT id, asset, amount, side, result, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').all(row.id) as any[]).map((o) => ({ kind: 'order', ...o }));
  const status = (db.prepare('SELECT from_status, to_status, reason, created_at FROM status_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').all(row.id) as any[]).map((s) => ({ kind: 'status', ...s }));
  const merged = [...tx, ...orders, ...status].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 50);
  res.json({ data: merged });
});

// ── Balances ─────────────────────────────────────────────────────────────
balancesRouter.get('/:userId', authRequired, requirePermission('users.view'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.userId));
  if (!row) return;
  res.json({ data: { userId: row.id, balance: Number(row.balance) } });
});

balancesRouter.post('/:userId/adjust', authRequired, requirePermission('balances.manage'), (req, res) => {
  const row = findUserOr404(res, Number(req.params.userId));
  if (!row) return;
  const { type, amount, reason } = req.body ?? {};
  const amt = Number(amount);
  if (!['add', 'deduct'].includes(type) || !Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: 'type must be "add" or "deduct" and amount a positive number' });
    return;
  }
  const delta = type === 'add' ? amt : -amt;
  const newBalance = Math.round((Number(row.balance) + delta) * 100) / 100;
  if (newBalance < 0) {
    res.status(400).json({ error: 'Deduction exceeds available balance' });
    return;
  }
  db.prepare('UPDATE users SET balance = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newBalance, row.id);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, reason, admin_id, balance_after) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(row.id, type, amt, reason ?? 'Manual adjustment', req.staff?.id ?? null, newBalance);
  logActivity(req.staff, 'balances', 'adjust', { type: 'user', id: row.id }, { type, amount: amt, reason, balanceAfter: newBalance });
  res.json({ data: { ok: true, balance: newBalance } });
});

// ── Orders ───────────────────────────────────────────────────────────────
ordersRouter.get('/', authRequired, requirePermission('orders.view'), (req, res) => {
  const userId = Number(req.query.userId ?? 0);
  let sql = `SELECT o.*, u.username, u.full_name AS user_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE 1=1`;
  const args: any[] = [];
  if (userId) {
    sql += ' AND o.user_id = ?';
    args.push(userId);
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 300';
  const rows = db.prepare(sql).all(...args) as Array<Record<string, unknown>>;
  res.json({ data: rows });
});

ordersRouter.get('/live', authRequired, requirePermission('orders.view'), (_req, res) => {
  const live = (db.prepare('SELECT COUNT(*) AS c FROM orders WHERE live = 1').get() as { c: number }).c;
  res.json({ data: { live } });
});

ordersRouter.get('/:id', authRequired, requirePermission('orders.view'), (req, res) => {
  const row = db.prepare('SELECT o.*, u.username, u.full_name AS user_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ data: row });
});

ordersRouter.patch('/:id', authRequired, requirePermission('orders.manage'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  for (const col of ['asset', 'amount', 'side', 'result']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(col === 'amount' ? Number(b[col]) : String(b[col]));
    }
  }
  if (b.live !== undefined) {
    fields.push('live = ?');
    args.push(b.live ? 1 : 0);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  fields.push("updated_at = datetime('now')");
  args.push(id);
  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'orders', 'update', { type: 'order', id }, b);
  res.json({ data: { ok: true } });
});

ordersRouter.post('/:id/result', authRequired, requirePermission('orders.manage'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const { result } = req.body ?? {};
  const allowed = ['win', 'lose', 'pending', 'live'];
  if (!allowed.includes(result)) {
    res.status(400).json({ error: `result must be one of ${allowed.join(', ')}` });
    return;
  }
  const live = result === 'live' ? 1 : 0;
  db.prepare("UPDATE orders SET result = ?, live = ?, updated_at = datetime('now') WHERE id = ?").run(result, live, id);
  logActivity(req.staff, 'orders', 'set_result', { type: 'order', id }, { result });
  res.json({ data: { ok: true, result, live } });
});
