import { Router } from 'express';
import { db, logActivity, raiseAlert } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';
import { aiReply } from '../services/ai.js';
import { parse, nowIso } from '../helpers.js';

export const chatsRouter = Router();
export const emailsRouter = Router();
export const popupsRouter = Router();

// ── Chat support ─────────────────────────────────────────────────────────
chatsRouter.get('/', authRequired, requirePermission('chats.manage'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, u.username, u.full_name AS user_name, u.country,
        (SELECT body FROM chat_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM chats c LEFT JOIN users u ON u.id = c.user_id
       ORDER BY CASE c.status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, c.last_message_at DESC`
    )
    .all();
  res.json({ data: rows });
});

chatsRouter.get('/:id', authRequired, requirePermission('chats.manage'), (req, res) => {
  const chat = db
    .prepare(
      `SELECT c.*, u.username, u.full_name AS user_name, u.country FROM chats c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(Number(req.params.id));
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const messages = db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC').all(Number(req.params.id));
  res.json({ data: { ...chat, messages } });
});

chatsRouter.post('/:id/messages', authRequired, requirePermission('chats.manage'), (req, res) => {
  const id = Number(req.params.id);
  const body = String(req.body?.body ?? '');
  if (!body) {
    res.status(400).json({ error: 'body is required' });
    return;
  }
  db.prepare('INSERT INTO chat_messages (chat_id, sender, body) VALUES (?, ?, ?)').run(id, 'admin', body);
  db.prepare("UPDATE chats SET status = 'active', last_message_at = datetime('now') WHERE id = ?").run(id);
  logActivity(req.staff, 'chats', 'reply', { type: 'chat', id }, body.slice(0, 100));
  res.status(201).json({ data: { ok: true } });
});

// Generate an AI draft reply (also saves it as an "ai" message for hybrid mode).
chatsRouter.post('/:id/ai', authRequired, requirePermission('chats.manage'), (req, res) => {
  const id = Number(req.params.id);
  const chat = db.prepare('SELECT c.*, u.full_name AS user_name FROM chats c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(id) as Record<string, unknown> | undefined;
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const last = db.prepare('SELECT body FROM chat_messages WHERE chat_id = ? AND sender = ? ORDER BY created_at DESC LIMIT 1').get(id, 'user') as { body: string } | undefined;
  const reply = aiReply(String(last?.body ?? ''), { userName: String(chat.user_name ?? '') });
  db.prepare('INSERT INTO chat_messages (chat_id, sender, body) VALUES (?, ?, ?)').run(id, 'ai', reply);
  db.prepare("UPDATE chats SET last_message_at = datetime('now') WHERE id = ?").run(id);
  res.json({ data: { reply } });
});

chatsRouter.post('/:id/assign', authRequired, requirePermission('chats.manage'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE chats SET assignee_id = ? WHERE id = ?').run(req.body?.assignee_id ?? null, id);
  logActivity(req.staff, 'chats', 'assign', { type: 'chat', id }, { assignee: req.body?.assignee_id });
  res.json({ data: { ok: true } });
});

chatsRouter.post('/:id/mode', authRequired, requirePermission('chats.manage'), (req, res) => {
  const id = Number(req.params.id);
  const mode = String(req.body?.mode ?? 'manual');
  if (!['manual', 'ai', 'hybrid'].includes(mode)) {
    res.status(400).json({ error: 'mode must be manual, ai or hybrid' });
    return;
  }
  db.prepare('UPDATE chats SET mode = ? WHERE id = ?').run(mode, id);
  logActivity(req.staff, 'chats', 'set_mode', { type: 'chat', id }, { mode });
  res.json({ data: { ok: true, mode } });
});

chatsRouter.post('/:id/status', authRequired, requirePermission('chats.manage'), (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? 'closed');
  db.prepare('UPDATE chats SET status = ? WHERE id = ?').run(status, id);
  logActivity(req.staff, 'chats', 'set_status', { type: 'chat', id }, { status });
  res.json({ data: { ok: true, status } });
});

// ── Email center ─────────────────────────────────────────────────────────
emailsRouter.get('/', authRequired, requirePermission('emails.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM emails ORDER BY sent_at DESC').all();
  const templates = db.prepare('SELECT * FROM email_templates ORDER BY id').all();
  const totals = (db.prepare('SELECT COALESCE(SUM(recipient_count),0) AS sent, COALESCE(SUM(opens),0) AS opens, COALESCE(SUM(clicks),0) AS clicks FROM emails').get() as { sent: number; opens: number; clicks: number });
  res.json({ data: rows, templates, meta: totals });
});

emailsRouter.post('/templates', authRequired, requirePermission('emails.send'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !b.subject) {
    res.status(400).json({ error: 'name and subject are required' });
    return;
  }
  const info = db
    .prepare('INSERT INTO email_templates (name, category, subject, body) VALUES (?, ?, ?, ?)')
    .run(String(b.name), b.category ?? 'custom', String(b.subject), b.body ?? '');
  logActivity(req.staff, 'emails', 'create_template', { type: 'template', id: Number(info.lastInsertRowid) }, { name: b.name });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

emailsRouter.post('/send', authRequired, requirePermission('emails.send'), (req, res) => {
  const b = req.body ?? {};
  if (!b.subject) {
    res.status(400).json({ error: 'subject is required' });
    return;
  }
  const totalUsers = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const audience = b.audience ?? 'all';
  const recipients = audience === 'all' ? totalUsers : audience === 'single' ? 1 : Math.max(1, Math.round(totalUsers * 0.25));

  const result = sendEmail({ to: Array.from({ length: recipients }, () => 'x@example.com'), subject: String(b.subject), body: b.body ?? '' });

  const info = db
    .prepare(
      `INSERT INTO emails (subject, body, template, audience, recipient_count, opens, clicks, sent_by, sent_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`
    )
    .run(
      String(b.subject), b.body ?? '', b.template ?? null, audience, recipients,
      result.opens, result.clicks, req.staff?.id ?? null, nowIso()
    );
  logActivity(req.staff, 'emails', 'send', { type: 'email', id: Number(info.lastInsertRowid) }, { subject: b.subject, audience, recipients });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid), ...result, recipients } });
});

// ── Pop-up manager ───────────────────────────────────────────────────────
popupsRouter.get('/', authRequired, requirePermission('popups.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM popups ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  res.json({ data: rows.map((r) => ({ ...r, pages: parse(r.pages, []) })) });
});

popupsRouter.post('/', authRequired, requirePermission('popups.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO popups (title, body, type, target, target_id, pages, frequency, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title), b.body ?? '', b.type ?? 'info', b.target ?? 'all', b.target_id ?? null,
      JSON.stringify(b.pages ?? []), b.frequency ?? 'once', b.enabled ? 1 : 0
    );
  logActivity(req.staff, 'popups', 'create', { type: 'popup', id: Number(info.lastInsertRowid) }, { title: b.title });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

popupsRouter.patch('/:id', authRequired, requirePermission('popups.manage'), (req, res) => {
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  for (const col of ['title', 'body', 'type', 'target', 'frequency']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(b[col]);
    }
  }
  if (b.target_id !== undefined) {
    fields.push('target_id = ?');
    args.push(b.target_id);
  }
  if (b.pages !== undefined) {
    fields.push('pages = ?');
    args.push(JSON.stringify(b.pages));
  }
  if (b.enabled !== undefined) {
    fields.push('enabled = ?');
    args.push(b.enabled ? 1 : 0);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  args.push(Number(req.params.id));
  db.prepare(`UPDATE popups SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'popups', 'update', { type: 'popup', id: Number(req.params.id) }, Object.keys(b));
  res.json({ data: { ok: true } });
});

popupsRouter.delete('/:id', authRequired, requirePermission('popups.manage'), (req, res) => {
  db.prepare('DELETE FROM popups WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'popups', 'delete', { type: 'popup', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

popupsRouter.post('/:id/toggle', authRequired, requirePermission('popups.manage'), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT enabled FROM popups WHERE id = ?').get(id) as { enabled: number } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Popup not found' });
    return;
  }
  db.prepare('UPDATE popups SET enabled = ? WHERE id = ?').run(row.enabled ? 0 : 1, id);
  if (!row.enabled) raiseAlert('Pop-up activated', 'A new pop-up was enabled.', 'info', 'communication');
  logActivity(req.staff, 'popups', 'toggle', { type: 'popup', id }, { enabled: !row.enabled });
  res.json({ data: { ok: true, enabled: !row.enabled } });
});
