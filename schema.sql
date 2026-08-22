-- Hype Coin Control · SQLite schema (easily portable to PostgreSQL / MySQL)
-- This file is loaded by src/db.ts on boot and is idempotent.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Staff (the people who log into this admin panel) ────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',          -- master_admin | admin | support | viewer
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  last_login_ip TEXT,
  last_login_location TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_secret TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── End users (platform members managed through the CRM) ────────────────
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',       -- active | cold | locked | blocked | pending
  phone TEXT,
  device TEXT,
  browser TEXT,
  ip TEXT,
  location TEXT,
  country TEXT,
  balance REAL NOT NULL DEFAULT 0,
  limits TEXT NOT NULL DEFAULT '{}',           -- JSON { maxOrder, maxWithdraw, ... }
  tags TEXT NOT NULL DEFAULT '[]',             -- JSON string[]
  lead_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Wallets & ledger ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,                          -- add | deduct
  amount REAL NOT NULL,
  reason TEXT,
  admin_id INTEGER,
  balance_after REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Orders (trading activity) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  asset TEXT NOT NULL,
  amount REAL NOT NULL,
  side TEXT NOT NULL DEFAULT 'buy',            -- buy | sell
  result TEXT NOT NULL DEFAULT 'pending',      -- pending | live | win | lose
  live INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Login & security history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER,
  username TEXT,
  ip TEXT,
  location TEXT,
  device TEXT,
  browser TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',       -- info | warning | critical
  ip TEXT,
  username TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Audit trail for every admin action ───────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── User status lifecycle + internal notes ───────────────────────────────
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  admin_id INTEGER,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  admin_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── CRM: leads, campaigns, social, segments ──────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,                                 -- ads | referral | social | organic ...
  interest TEXT,
  region TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'New',           -- New | Contacted | Qualified | Proposal | Won | Lost
  assigned_to INTEGER,
  value REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email',          -- email | social | promo
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | active | paused | completed
  budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  roi REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,                      -- facebook | instagram | tiktok | linkedin | x
  handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  followers INTEGER NOT NULL DEFAULT 0,
  engagement TEXT NOT NULL DEFAULT '{}',
  connected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  content TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',    -- scheduled | published | failed
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  criteria TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Communication center ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  assignee_id INTEGER,
  status TEXT NOT NULL DEFAULT 'waiting',      -- waiting | active | closed
  mode TEXT NOT NULL DEFAULT 'manual',         -- manual | ai | hybrid
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER,
  sender TEXT NOT NULL,                        -- user | admin | ai | system
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',     -- welcome | warning | promo | agreement
  subject TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  body TEXT,
  template TEXT,
  audience TEXT NOT NULL DEFAULT 'all',        -- all | segment | single
  recipient_count INTEGER NOT NULL DEFAULT 0,
  opens INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  sent_by INTEGER,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS popups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',           -- warning | info | promo
  target TEXT NOT NULL DEFAULT 'all',          -- single | segment | all
  target_id INTEGER,
  pages TEXT NOT NULL DEFAULT '[]',
  frequency TEXT NOT NULL DEFAULT 'once',      -- once | every_login | every_session
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Website editor ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sections TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER,
  version INTEGER,
  note TEXT,
  sections TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Agreements & document automation ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'terms',          -- terms | contract | disclaimer
  body TEXT,
  generated_by_ai INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agreement_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER,
  user_id INTEGER,
  channel TEXT NOT NULL DEFAULT 'email',       -- email | chat | social
  sent_at TEXT,
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'sent'          -- sent | accepted | declined
);

-- ── AI command center ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  intent TEXT,
  suggested_actions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | confirmed | executed | cancelled
  admin_id INTEGER,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  executed_at TEXT
);

-- ── System ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  target TEXT NOT NULL DEFAULT 'all',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backup_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  size TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
