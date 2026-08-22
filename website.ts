import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { parse } from '../helpers.js';

export const websiteRouter = Router();

type Section = { id: string; type: string; [k: string]: unknown };

websiteRouter.get('/pages', authRequired, requirePermission('website.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM pages ORDER BY id').all() as Array<Record<string, unknown>>;
  res.json({ data: rows.map((r) => ({ ...r, sections: parse<Section[]>(r.sections, []), published: !!r.published })) });
});

websiteRouter.get('/pages/:id', authRequired, requirePermission('website.view'), (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(Number(req.params.id)) as Record<string, unknown> | undefined;
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  const versions = db
    .prepare('SELECT pv.*, s.full_name AS author FROM page_versions pv LEFT JOIN staff s ON s.id = pv.created_by WHERE pv.page_id = ? ORDER BY pv.version DESC')
    .all(Number(req.params.id));
  res.json({ data: { ...page, sections: parse<Section[]>(page.sections, []), published: !!page.published, versions } });
});

websiteRouter.post('/pages', authRequired, requirePermission('website.manage'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !b.slug) {
    res.status(400).json({ error: 'name and slug are required' });
    return;
  }
  try {
    const info = db
      .prepare('INSERT INTO pages (slug, name, sections, published, version) VALUES (?, ?, ?, 0, 1)')
      .run(String(b.slug), String(b.name), JSON.stringify(b.sections ?? []));
    logActivity(req.staff, 'website', 'create_page', { type: 'page', id: Number(info.lastInsertRowid) }, { name: b.name });
    res.status(201).json({ data: { id: Number(info.lastInsertRowid) } });
  } catch {
    res.status(409).json({ error: 'Slug already exists' });
  }
});

websiteRouter.patch('/pages/:id', authRequired, requirePermission('website.manage'), (req, res) => {
  const id = Number(req.params.id);
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  const b = req.body ?? {};
  const fields: string[] = [];
  const args: any[] = [];
  if (b.name !== undefined) {
    fields.push('name = ?');
    args.push(String(b.name));
  }
  if (b.slug !== undefined) {
    fields.push('slug = ?');
    args.push(String(b.slug));
  }
  if (b.sections !== undefined) {
    fields.push('sections = ?');
    args.push(JSON.stringify(b.sections));
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  fields.push("updated_at = datetime('now')");
  args.push(id);
  db.prepare(`UPDATE pages SET ${fields.join(', ')} WHERE id = ?`).run(...args);

  if (b.sections !== undefined) {
    const nextVersion = Number(page.version) + 1;
    db.prepare('UPDATE pages SET version = ? WHERE id = ?').run(nextVersion, id);
    db.prepare('INSERT INTO page_versions (page_id, version, note, sections, created_by) VALUES (?, ?, ?, ?, ?)').run(id, nextVersion, b.note ?? 'Draft edit', JSON.stringify(b.sections), req.staff?.id ?? null);
  }
  logActivity(req.staff, 'website', 'update_page', { type: 'page', id }, Object.keys(b));
  res.json({ data: { ok: true } });
});

websiteRouter.post('/pages/:id/publish', authRequired, requirePermission('website.manage'), (req, res) => {
  const id = Number(req.params.id);
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  db.prepare('UPDATE pages SET published = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  db.prepare('INSERT INTO page_versions (page_id, version, note, sections, created_by) VALUES (?, ?, ?, ?, ?)').run(id, Number(page.version) + 1, 'Published', page.sections as string, req.staff?.id ?? null);
  db.prepare('UPDATE pages SET version = version + 1 WHERE id = ?').run(id);
  logActivity(req.staff, 'website', 'publish', { type: 'page', id }, null);
  res.json({ data: { ok: true, published: true } });
});

websiteRouter.post('/pages/:id/rollback', authRequired, requirePermission('website.manage'), (req, res) => {
  const id = Number(req.params.id);
  const version = Number(req.body?.version ?? 0);
  const snap = db.prepare('SELECT * FROM page_versions WHERE page_id = ? AND version = ?').get(id, version) as { sections: string } | undefined;
  if (!snap) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Record<string, unknown>;
  const nextVersion = Number(page.version) + 1;
  db.prepare('UPDATE pages SET sections = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?').run(snap.sections, nextVersion, id);
  db.prepare('INSERT INTO page_versions (page_id, version, note, sections, created_by) VALUES (?, ?, ?, ?, ?)').run(id, nextVersion, `Rolled back to v${version}`, snap.sections, req.staff?.id ?? null);
  logActivity(req.staff, 'website', 'rollback', { type: 'page', id }, { toVersion: version });
  res.json({ data: { ok: true, version: nextVersion } });
});
