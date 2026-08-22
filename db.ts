import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { fileURLToPath } from 'node:url';
import { json } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure the data directory exists.
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// Load schema (idempotent).
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
}

// ── Settings helpers (emergency lockdown + any global flags) ─────────────
export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO system_settings (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export const isLockdown = () => getSetting('lockdown', 'false') === 'true';

// ── Audit trail ──────────────────────────────────────────────────────────
export function logActivity(
  actor: { id?: number | null; full_name?: string | null } | null | undefined,
  module: string,
  action: string,
  target?: { type?: string; id?: number | null },
  details?: unknown
): void {
  try {
    db.prepare(
      `INSERT INTO activity_logs (actor_id, actor_name, module, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      actor?.id ?? null,
      actor?.full_name ?? 'system',
      module,
      action,
      target?.type ?? null,
      target?.id ?? null,
      details == null ? null : typeof details === 'string' ? details : json(details)
    );
  } catch {
    /* audit must never break the request */
  }
}

export function logSecurity(
  event: string,
  severity: 'info' | 'warning' | 'critical',
  extra?: { ip?: string; username?: string; details?: unknown }
): void {
  try {
    db.prepare(
      `INSERT INTO security_logs (event, severity, ip, username, details) VALUES (?, ?, ?, ?, ?)`
    ).run(
      event,
      severity,
      extra?.ip ?? null,
      extra?.username ?? null,
      extra?.details == null ? null : typeof extra.details === 'string' ? extra.details : json(extra.details)
    );
  } catch {
    /* noop */
  }
}

/** Fire a lightweight alert (appears in the security/alert widgets). */
export function raiseAlert(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'info',
  source = 'system'
): void {
  try {
    db.prepare(
      'INSERT INTO alerts (title, message, severity, source) VALUES (?, ?, ?, ?)'
    ).run(title, message, severity, source);
  } catch {
    /* noop */
  }
}
