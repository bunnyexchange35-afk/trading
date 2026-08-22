import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { generateAgreementText } from '../services/ai.js';
import { nowIso } from '../helpers.js';

export const agreementsRouter = Router();

agreementsRouter.get('/', authRequired, requirePermission('agreements.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM agreements ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
  const data = rows.map((a) => {
    const sends = db.prepare('SELECT COUNT(*) AS c FROM agreement_sends WHERE agreement_id = ?').get(Number(a.id)) as { c: number };
    const accepted = db.prepare("SELECT COUNT(*) AS c FROM agreement_sends WHERE agreement_id = ? AND status = 'accepted'").get(Number(a.id)) as { c: number };
    return { ...a, send_count: sends.c, accepted_count: accepted.c };
  });
  res.json({ data });
});

agreementsRouter.get('/:id', authRequired, requirePermission('agreements.view'), (req, res) => {
  const row = db.prepare('SELECT * FROM agreements WHERE id = ?').get(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: 'Agreement not found' });
    return;
  }
  const sends = db
    .prepare('SELECT ags.*, u.username, u.full_name AS user_name FROM agreement_sends ags LEFT JOIN users u ON u.id = ags.user_id WHERE ags.agreement_id = ? ORDER BY ags.sent_at DESC')
    .all(Number(req.params.id));
  res.json({ data: { ...row, sends } });
});

agreementsRouter.post('/', authRequired, requirePermission('agreements.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const info = db
    .prepare('INSERT INTO agreements (title, type, body, generated_by_ai, status) VALUES (?, ?, ?, 0, ?)')
    .run(String(b.title), b.type ?? 'terms', b.body ?? '', b.status ?? 'draft');
  logActivity(req.staff, 'agreements', 'create', { type: 'agreement', id: Number(info.lastInsertRowid) }, { title: b.title });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

agreementsRouter.post('/generate', authRequired, requirePermission('agreements.manage'), (req, res) => {
  const b = req.body ?? {};
  const title = String(b.title ?? 'Hype Coin Control Agreement');
  const type = String(b.type ?? 'terms');
  const body = generateAgreementText(type, title);
  const info = db
    .prepare('INSERT INTO agreements (title, type, body, generated_by_ai, status) VALUES (?, ?, ?, 1, ?)')
    .run(title, type, body, String(b.status ?? 'draft'));
  logActivity(req.staff, 'agreements', 'generate', { type: 'agreement', id: Number(info.lastInsertRowid) }, { title, type });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid), title, type, body } });
});

agreementsRouter.patch('/:id', authRequired, requirePermission('agreements.manage'), (req, res) => {
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  for (const col of ['title', 'type', 'body', 'status']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(b[col]);
    }
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  fields.push("updated_at = datetime('now')");
  args.push(Number(req.params.id));
  db.prepare(`UPDATE agreements SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'agreements', 'update', { type: 'agreement', id: Number(req.params.id) }, Object.keys(b));
  res.json({ data: { ok: true } });
});

agreementsRouter.delete('/:id', authRequired, requirePermission('agreements.manage'), (req, res) => {
  db.prepare('DELETE FROM agreements WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'agreements', 'delete', { type: 'agreement', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

// Send an agreement to a single user, a segment (mock) or everyone.
agreementsRouter.post('/:id/send', authRequired, requirePermission('agreements.manage'), (req, res) => {
  const id = Number(req.params.id);
  const agreement = db.prepare('SELECT * FROM agreements WHERE id = ?').get(id);
  if (!agreement) {
    res.status(404).json({ error: 'Agreement not found' });
    return;
  }
  const b = req.body ?? {};
  const channel = b.channel ?? 'email';
  const userIds: number[] = [];
  if (b.user_id) {
    userIds.push(Number(b.user_id));
  } else {
    const rows = db.prepare('SELECT id FROM users LIMIT 200').all() as Array<{ id: number }>;
    const target = b.audience === 'all' ? rows : rows.slice(0, Math.max(1, Math.round(rows.length * 0.3)));
    userIds.push(...target.map((r) => r.id));
  }
  for (const uid of userIds) {
    db.prepare('INSERT INTO agreement_sends (agreement_id, user_id, channel, sent_at, status) VALUES (?, ?, ?, ?, ?)').run(id, uid, channel, nowIso(), 'sent');
  }
  logActivity(req.staff, 'agreements', 'send', { type: 'agreement', id }, { channel, recipients: userIds.length });
  res.json({ data: { ok: true, recipients: userIds.length, channel } });
});

agreementsRouter.post('/sends/:sendId/accept', authRequired, requirePermission('agreements.manage'), (req, res) => {
  db.prepare("UPDATE agreement_sends SET status = 'accepted', accepted_at = ? WHERE id = ?").run(nowIso(), Number(req.params.sendId));
  logActivity(req.staff, 'agreements', 'mark_accepted', { type: 'agreement_send', id: Number(req.params.sendId) }, null);
  res.json({ data: { ok: true } });
});
