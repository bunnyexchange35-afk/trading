import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { parse } from '../helpers.js';

export const leadsRouter = Router();
export const campaignsRouter = Router();
export const socialRouter = Router();
export const segmentsRouter = Router();

const decorateLead = (l: Record<string, unknown>) => ({
  ...l,
  tags: parse<string[]>(l.tags, []),
  value: Number(l.value),
});

// ── Leads ────────────────────────────────────────────────────────────────
leadsRouter.get('/', authRequired, requirePermission('leads.view'), (req, res) => {
  const stage = String(req.query.stage ?? '');
  let sql = `SELECT l.*, s.full_name AS assignee_name FROM leads l LEFT JOIN staff s ON s.id = l.assigned_to WHERE 1=1`;
  const args: any[] = [];
  if (stage && stage !== 'all') {
    sql += ' AND l.stage = ?';
    args.push(stage);
  }
  sql += ' ORDER BY l.updated_at DESC';
  const rows = (db.prepare(sql).all(...args) as Array<Record<string, unknown>>).map(decorateLead);
  const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map((s) => ({
    stage: s,
    count: (db.prepare('SELECT COUNT(*) AS c FROM leads WHERE stage = ?').get(s) as { c: number }).c,
  }));
  res.json({ data: rows, meta: { stages } });
});

leadsRouter.post('/', authRequired, requirePermission('leads.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO leads (name, email, phone, source, interest, region, tags, stage, assigned_to, value, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.name), b.email ?? null, b.phone ?? null, b.source ?? 'organic', b.interest ?? null,
      b.region ?? null, JSON.stringify(b.tags ?? []), b.stage ?? 'New', b.assigned_to ?? null,
      Number(b.value ?? 0), b.notes ?? null
    );
  logActivity(req.staff, 'leads', 'create', { type: 'lead', id: Number(info.lastInsertRowid) }, { name: b.name });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

leadsRouter.patch('/:id', authRequired, requirePermission('leads.manage'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  const b = req.body ?? {};
  const map: Record<string, string> = { name: 'name', email: 'email', phone: 'phone', source: 'source', interest: 'interest', region: 'region', stage: 'stage', notes: 'notes' };
  const fields: string[] = [];
  const args: any[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(b[k]);
    }
  }
  if (b.assigned_to !== undefined) {
    fields.push('assigned_to = ?');
    args.push(b.assigned_to);
  }
  if (b.value !== undefined) {
    fields.push('value = ?');
    args.push(Number(b.value));
  }
  if (b.tags !== undefined) {
    fields.push('tags = ?');
    args.push(JSON.stringify(b.tags));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  fields.push("updated_at = datetime('now')");
  args.push(id);
  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'leads', 'update', { type: 'lead', id }, Object.keys(b));
  res.json({ data: { ok: true } });
});

leadsRouter.delete('/:id', authRequired, requirePermission('leads.manage'), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  logActivity(req.staff, 'leads', 'delete', { type: 'lead', id }, null);
  res.json({ data: { ok: true } });
});

// ── Campaigns ────────────────────────────────────────────────────────────
campaignsRouter.get('/', authRequired, requirePermission('campaigns.view'), (_req, res) => {
  const rows = db.prepare('SELECT c.*, s.full_name AS creator FROM campaigns c LEFT JOIN staff s ON s.id = c.created_by ORDER BY c.created_at DESC').all();
  const totals = (db.prepare('SELECT COALESCE(SUM(spent),0) AS spent, COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(conversions),0) AS conv FROM campaigns').get() as { spent: number; clicks: number; conv: number });
  res.json({ data: rows, meta: totals });
});

campaignsRouter.post('/', authRequired, requirePermission('campaigns.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO campaigns (name, type, status, budget, spent, impressions, clicks, conversions, roi, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?)`
    )
    .run(String(b.name), b.type ?? 'email', b.status ?? 'draft', Number(b.budget ?? 0), b.start_date ?? null, b.end_date ?? null, req.staff?.id ?? null);
  logActivity(req.staff, 'campaigns', 'create', { type: 'campaign', id: Number(info.lastInsertRowid) }, { name: b.name });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

campaignsRouter.patch('/:id', authRequired, requirePermission('campaigns.manage'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  for (const col of ['name', 'type', 'status', 'start_date', 'end_date']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(b[col]);
    }
  }
  for (const col of ['budget', 'spent', 'impressions', 'clicks', 'conversions', 'roi']) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      args.push(Number(b[col]));
    }
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  args.push(id);
  db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'campaigns', 'update', { type: 'campaign', id }, Object.keys(b));
  res.json({ data: { ok: true } });
});

campaignsRouter.delete('/:id', authRequired, requirePermission('campaigns.manage'), (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'campaigns', 'delete', { type: 'campaign', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

// ── Social ───────────────────────────────────────────────────────────────
socialRouter.get('/accounts', authRequired, requirePermission('social.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM social_accounts ORDER BY id').all() as Array<Record<string, unknown>>;
  const data = rows.map((r) => ({ ...r, engagement: parse(r.engagement, {}) }));
  res.json({ data });
});

socialRouter.post('/accounts', authRequired, requirePermission('social.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.platform || !b.handle) {
    res.status(400).json({ error: 'platform and handle are required' });
    return;
  }
  const info = db
    .prepare('INSERT INTO social_accounts (platform, handle, status, followers, engagement) VALUES (?, ?, ?, 0, ?)')
    .run(String(b.platform), String(b.handle), b.status ?? 'connected', JSON.stringify({ likes: 0, shares: 0, comments: 0 }));
  logActivity(req.staff, 'social', 'connect', { type: 'social_account', id: Number(info.lastInsertRowid) }, { platform: b.platform });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

socialRouter.delete('/accounts/:id', authRequired, requirePermission('social.manage'), (req, res) => {
  db.prepare('DELETE FROM social_accounts WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'social', 'disconnect', { type: 'social_account', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

socialRouter.get('/posts', authRequired, requirePermission('social.view'), (_req, res) => {
  const rows = db
    .prepare('SELECT p.*, sa.platform, sa.handle FROM scheduled_posts p LEFT JOIN social_accounts sa ON sa.id = p.account_id ORDER BY p.scheduled_at DESC')
    .all();
  res.json({ data: rows });
});

socialRouter.post('/posts', authRequired, requirePermission('social.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.content || !b.account_id) {
    res.status(400).json({ error: 'content and account_id are required' });
    return;
  }
  const info = db
    .prepare('INSERT INTO scheduled_posts (account_id, content, scheduled_at, status) VALUES (?, ?, ?, ?)')
    .run(Number(b.account_id), String(b.content), b.scheduled_at ?? new Date().toISOString(), 'scheduled');
  logActivity(req.staff, 'social', 'schedule_post', { type: 'post', id: Number(info.lastInsertRowid) }, null);
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

socialRouter.patch('/posts/:id', authRequired, requirePermission('social.manage'), (req, res) => {
  const b = req.body ?? {};
  db.prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run(b.status ?? 'published', Number(req.params.id));
  logActivity(req.staff, 'social', 'update_post', { type: 'post', id: Number(req.params.id) }, b);
  res.json({ data: { ok: true } });
});

socialRouter.delete('/posts/:id', authRequired, requirePermission('social.manage'), (req, res) => {
  db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'social', 'delete_post', { type: 'post', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

// ── Segments ─────────────────────────────────────────────────────────────
segmentsRouter.get('/', authRequired, requirePermission('segments.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM segments ORDER BY id').all() as Array<Record<string, unknown>>;
  const data = rows.map((r) => ({ ...r, criteria: parse(r.criteria, {}) }));
  res.json({ data });
});

segmentsRouter.post('/', authRequired, requirePermission('segments.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const info = db
    .prepare('INSERT INTO segments (name, description, criteria) VALUES (?, ?, ?)')
    .run(String(b.name), b.description ?? null, JSON.stringify(b.criteria ?? {}));
  logActivity(req.staff, 'segments', 'create', { type: 'segment', id: Number(info.lastInsertRowid) }, { name: b.name });
  res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
});

segmentsRouter.patch('/:id', authRequired, requirePermission('segments.manage'), (req, res) => {
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  if (b.name !== undefined) {
    fields.push('name = ?');
    args.push(String(b.name));
  }
  if (b.description !== undefined) {
    fields.push('description = ?');
    args.push(b.description);
  }
  if (b.criteria !== undefined) {
    fields.push('criteria = ?');
    args.push(JSON.stringify(b.criteria));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  args.push(Number(req.params.id));
  db.prepare(`UPDATE segments SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  logActivity(req.staff, 'segments', 'update', { type: 'segment', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});

segmentsRouter.delete('/:id', authRequired, requirePermission('segments.manage'), (req, res) => {
  db.prepare('DELETE FROM segments WHERE id = ?').run(Number(req.params.id));
  logActivity(req.staff, 'segments', 'delete', { type: 'segment', id: Number(req.params.id) }, null);
  res.json({ data: { ok: true } });
});
