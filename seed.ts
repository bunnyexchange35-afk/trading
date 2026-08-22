import { db, setSetting, logActivity } from './db.js';
import { hashPassword } from './auth.js';
import { json, nowIso, randInt, randFloat, pick } from './helpers.js';

const TABLES = [
  'agreement_sends', 'agreements', 'page_versions', 'pages', 'popups', 'emails',
  'email_templates', 'chat_messages', 'chats', 'segments', 'scheduled_posts',
  'social_accounts', 'campaigns', 'leads', 'user_notes', 'status_history',
  'orders', 'transactions', 'users', 'login_history', 'security_logs',
  'activity_logs', 'ai_commands', 'notifications', 'alerts', 'backup_points',
  'staff', 'system_settings',
];

function wipe(): void {
  for (const t of TABLES) {
    try {
      db.exec(`DELETE FROM ${t}`);
    } catch {
      /* ignore */
    }
  }
}

export function seed(force = false): void {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM staff').get() as { c: number };
  if (!force && existing.c > 0) return;
  if (force) wipe();

  const run = (sql: string, ...args: any[]) => db.prepare(sql).run(...args);
  const insertStaff = (s: {
    username: string; email: string; password: string; full_name: string;
    role: string; last_login_at?: string; last_login_ip?: string; last_login_location?: string;
    mfa_enabled?: number;
  }) => {
    const info = run(
      `INSERT INTO staff (username, email, password_hash, full_name, role, last_login_at, last_login_ip, last_login_location, mfa_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.username, s.email, hashPassword(s.password), s.full_name, s.role,
      s.last_login_at ?? nowIso(), s.last_login_ip ?? '203.0.113.42',
      s.last_login_location ?? 'Dubai, AE', s.mfa_enabled ?? 0
    );
    return Number(info.lastInsertRowid);
  };

  const masterId = insertStaff({
    username: 'master', email: 'master@hypecoincontrol.io', password: 'Master@123',
    full_name: 'Ava Stone', role: 'master_admin', mfa_enabled: 1,
  });
  const adminId = insertStaff({
    username: 'n.kane', email: 'niles@hypecoincontrol.io', password: 'Admin@123',
    full_name: 'Niles Kane', role: 'admin',
  });
  const supportId = insertStaff({
    username: 's.bloom', email: 'sana@hypecoincontrol.io', password: 'Support@123',
    full_name: 'Sana Bloom', role: 'support',
  });
  insertStaff({
    username: 'v.read', email: 'vic@hypecoincontrol.io', password: 'Viewer@123',
    full_name: 'Vic Reader', role: 'viewer',
  });

  // ── End users ──────────────────────────────────────────────────────────
  const userRows: Array<Record<string, unknown>> = [];
  const USER_DATA: Array<[string, string, string, string, string, string, string, string, number, string]> = [
    // name, username, email, country, location, device, browser, ip, balance, status
    ['Marcus Reed', 'm.reed', 'marcus.reed@gmail.com', 'US', 'New York, US', 'iPhone 15 Pro', 'Safari 17', '104.28.9.201', 18420.5, 'active'],
    ['Lina Petrova', 'l.petrova', 'lina.p@proton.me', 'DE', 'Berlin, DE', 'MacBook Pro', 'Chrome 126', '91.66.42.10', 9204.0, 'active'],
    ['Diego Santos', 'd.santos', 'diego.s@outlook.com', 'BR', 'São Paulo, BR', 'Samsung S24', 'Chrome Mobile', '177.54.220.7', 3420.25, 'active'],
    ['Yuki Tanaka', 'y.tanaka', 'yuki.t@gmail.com', 'JP', 'Tokyo, JP', 'iPad Air', 'Safari 16', '126.203.44.5', 15200.0, 'active'],
    ['Omar Haddad', 'o.haddad', 'omar.h@gmail.com', 'AE', 'Dubai, AE', 'Pixel 8', 'Chrome Mobile', '94.56.12.90', 58120.75, 'active'],
    ['Sofia Rossi', 's.rossi', 'sofia.r@libero.it', 'IT', 'Milan, IT', 'Windows 11', 'Edge 126', '151.30.18.4', 2100.0, 'cold'],
    ['Liam O\'Connor', 'l.oconnor', 'liam.oc@icloud.com', 'IE', 'Dublin, IE', 'iPhone 14', 'Safari 17', '86.44.100.3', 430.0, 'active'],
    ['Amara Diallo', 'a.diallo', 'amara.d@gmail.com', 'SN', 'Dakar, SN', 'Android Tablet', 'Chrome', '196.207.55.2', 7800.0, 'active'],
    ['Chen Wei', 'c.wei', 'chen.wei@qq.com', 'CN', 'Shanghai, CN', 'Huawei Mate 60', 'HarmonyOS', '223.104.5.1', 125000.0, 'active'],
    ['Isabella Cruz', 'i.cruz', 'isa.cruz@gmail.com', 'MX', 'CDMX, MX', 'MacBook Air', 'Chrome 125', '187.190.33.9', 950.5, 'locked'],
    ['Noah Berg', 'n.berg', 'noah.berg@gmail.com', 'SE', 'Stockholm, SE', 'iPhone 15', 'Safari 17', '90.129.22.6', 12450.0, 'active'],
    ['Priya Sharma', 'p.sharma', 'priya.s@gmail.com', 'IN', 'Mumbai, IN', 'OnePlus 12', 'Chrome Mobile', '49.207.88.4', 6120.0, 'active'],
    ['Viktor Novák', 'v.novak', 'viktor.n@seznam.cz', 'CZ', 'Prague, CZ', 'ThinkPad X1', 'Firefox 127', '89.177.99.1', 0.0, 'blocked'],
    ['Grace Kim', 'g.kim', 'grace.k@gmail.com', 'KR', 'Seoul, KR', 'Galaxy Z Fold', 'Samsung Internet', '211.246.77.3', 28400.0, 'active'],
    ['Ethan Cole', 'e.cole', 'ethan.c@gmail.com', 'AU', 'Sydney, AU', 'MacBook Pro', 'Chrome 126', '1.129.44.8', 1750.0, 'cold'],
    ['Zara Ahmed', 'z.ahmed', 'zara.ahmed@gmail.com', 'GB', 'London, UK', 'iPhone 15 Pro', 'Safari 17', '81.101.9.12', 33200.0, 'active'],
    ['Mateo Rossi', 'm.rossi', 'mateo.rossi@gmail.com', 'AR', 'Buenos Aires, AR', 'Windows 10', 'Chrome 124', '181.43.200.5', 890.0, 'pending'],
    ['Ingrid Larsen', 'i.larsen', 'ingrid.l@online.no', 'NO', 'Oslo, NO', 'MacBook Air', 'Safari 16', '88.89.120.4', 9450.0, 'active'],
    ['Tunde Adeyemi', 't.adeyemi', 'tunde.a@gmail.com', 'NG', 'Lagos, NG', 'Infinix Note', 'Chrome Mobile', '105.112.30.7', 5120.0, 'active'],
    ['Chloe Martin', 'c.martin', 'chloe.m@gmail.com', 'FR', 'Paris, FR', 'iPhone 13', 'Safari 16', '90.84.10.6', 2780.0, 'active'],
    ['Ravi Patel', 'r.patel', 'ravi.patel@gmail.com', 'IN', 'Delhi, IN', 'Redmi Note 13', 'Chrome Mobile', '103.205.66.2', 390.0, 'locked'],
    ['Emma Wilson', 'e.wilson', 'emma.w@gmail.com', 'CA', 'Toronto, CA', 'MacBook Pro', 'Chrome 126', '70.53.140.9', 16700.0, 'active'],
    ['Hugo Silva', 'h.silva', 'hugo.silva@gmail.com', 'PT', 'Lisbon, PT', 'Windows 11', 'Edge 125', '89.155.9.3', 6230.0, 'active'],
    ['Nadia Ivanova', 'n.ivanova', 'nadia.iv@gmail.com', 'RU', 'Moscow, RU', 'iPhone 12', 'Safari 15', '95.24.17.8', 0.0, 'blocked'],
  ];

  const userIds: number[] = [];
  for (const [name, uname, email, country, location, device, browser, ip, balance, status] of USER_DATA) {
    const tags = pick([
      ['whale', 'vip'], ['new', 'retention'], ['referral'], ['eu', 'high-value'],
      ['inactive', 'cold'], ['pro', 'whale'], ['social'], [],
    ]);
    const info = run(
      `INSERT INTO users (username, email, full_name, status, phone, device, browser, ip, location, country, balance, limits, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(10, 300)} days'), datetime('now'))`,
      uname, email, name, status, `+${randInt(10000000000, 99999999999)}`, device, browser, ip,
      location, country, balance, json({ maxOrder: randInt(1000, 50000), maxWithdraw: randInt(500, 20000), dailyWithdraw: randInt(200, 5000) }),
      json(tags)
    );
    userIds.push(Number(info.lastInsertRowid));
  }
  userRows.push(...USER_DATA.map((u, i) => ({ name: u[0], id: userIds[i] })));

  // ── Transactions ───────────────────────────────────────────────────────
  for (let i = 0; i < 46; i++) {
    const uid = pick(userIds);
    const type = Math.random() > 0.4 ? 'add' : 'deduct';
    const amount = randFloat(50, 9000);
    run(
      `INSERT INTO transactions (user_id, type, amount, reason, admin_id, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 60)} days'))`,
      uid, type, amount, pick(['Manual adjustment', 'Deposit', 'Withdrawal', 'Promo credit', 'Risk deduction', 'Trading correction']),
      pick([masterId, adminId, null]), randFloat(0, 90000)
    );
  }

  // ── Orders ─────────────────────────────────────────────────────────────
  const ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'XRP/USDT', 'ADA/USDT'];
  for (let i = 0; i < 42; i++) {
    const live = Math.random() < 0.18 ? 1 : 0;
    const result = live ? 'live' : pick(['win', 'lose', 'pending', 'win', 'win']);
    const info = run(
      `INSERT INTO orders (user_id, asset, amount, side, result, live, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 40)} days'), datetime('now'))`,
      pick(userIds), pick(ASSETS), randFloat(100, 50000), pick(['buy', 'sell']), result, live
    );
    if (i < 5) userRows.push({ orderId: Number(info.lastInsertRowid) });
  }

  // ── Leads ──────────────────────────────────────────────────────────────
  const LEADS: Array<Record<string, unknown>> = [
    { name: 'Felix Grant', email: 'felix.g@gmail.com', phone: '+44 7700 900123', source: 'ads', interest: 'Crypto trading', region: 'UK', tags: ['high-value'], stage: 'Qualified', value: 12000 },
    { name: 'Mona Qadir', email: 'mona.q@gmail.com', phone: '+971 50 123 4567', source: 'referral', interest: 'Staking', region: 'AE', tags: ['whale'], stage: 'Proposal', value: 48000 },
    { name: 'Peter Novak', email: 'peter.n@gmail.com', phone: '+420 601 234 567', source: 'social', interest: 'Derivatives', region: 'CZ', tags: ['new'], stage: 'New', value: 1500 },
    { name: 'Aisha Bello', email: 'aisha.b@gmail.com', phone: '+234 803 555 1212', source: 'organic', interest: 'Spot trading', region: 'NG', tags: ['new'], stage: 'Contacted', value: 800 },
    { name: 'Tomás Rivera', email: 'tomas.r@gmail.com', phone: '+52 55 1234 5678', source: 'ads', interest: 'Copy trading', region: 'MX', tags: ['retention'], stage: 'New', value: 2500 },
    { name: 'Hana Suzuki', email: 'hana.s@gmail.com', phone: '+81 90 1234 5678', source: 'social', interest: 'Altcoins', region: 'JP', tags: ['high-value'], stage: 'Qualified', value: 32000 },
    { name: 'Luca Bianchi', email: 'luca.b@gmail.com', phone: '+39 333 123 4567', source: 'referral', interest: 'Crypto trading', region: 'IT', tags: [], stage: 'Won', value: 9000 },
    { name: 'Elena Petrova', email: 'elena.p@gmail.com', phone: '+7 900 123 4567', source: 'ads', interest: 'Leverage', region: 'RU', tags: ['cold'], stage: 'Lost', value: 6000 },
    { name: 'Kwame Mensah', email: 'kwame.m@gmail.com', phone: '+233 24 123 4567', source: 'organic', interest: 'Savings', region: 'GH', tags: ['new'], stage: 'Contacted', value: 1200 },
    { name: 'Sarah Connor', email: 'sarah.c@gmail.com', phone: '+1 212 555 0144', source: 'social', interest: 'Crypto trading', region: 'US', tags: ['high-value', 'whale'], stage: 'Proposal', value: 65000 },
    { name: 'Jonas Weber', email: 'jonas.w@gmail.com', phone: '+49 170 123 4567', source: 'ads', interest: 'Portfolio', region: 'DE', tags: [], stage: 'New', value: 3400 },
    { name: 'Mia Anderson', email: 'mia.a@gmail.com', phone: '+61 412 345 678', source: 'referral', interest: 'Altcoins', region: 'AU', tags: ['retention'], stage: 'Qualified', value: 7800 },
    { name: 'Rafael Costa', email: 'rafael.c@gmail.com', phone: '+55 11 91234 5678', source: 'social', interest: 'Spot trading', region: 'BR', tags: ['new'], stage: 'Won', value: 4100 },
    { name: 'Leila Haddad', email: 'leila.h@gmail.com', phone: '+961 70 123 456', source: 'organic', interest: 'Staking', region: 'LB', tags: ['cold'], stage: 'Lost', value: 2200 },
  ];
  const leadIds: number[] = [];
  for (const l of LEADS) {
    const info = run(
      `INSERT INTO leads (name, email, phone, source, interest, region, tags, stage, assigned_to, value, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(1, 90)} days'), datetime('now'))`,
      l.name, l.email, l.phone, l.source, l.interest, l.region, json(l.tags), l.stage,
      pick([adminId, supportId, null, adminId]), l.value, 'Follow up scheduled for next week.'
    );
    leadIds.push(Number(info.lastInsertRowid));
  }

  // ── Campaigns ──────────────────────────────────────────────────────────
  const CAMPAIGNS = [
    { name: 'Summer Trading Surge', type: 'email', status: 'active', budget: 12000, spent: 6400, impressions: 210000, clicks: 8400, conversions: 320, roi: 2.4 },
    { name: 'Instagram Stories Promo', type: 'social', status: 'active', budget: 8000, spent: 5100, impressions: 480000, clicks: 19200, conversions: 540, roi: 3.1 },
    { name: 'VIP Whale Onboarding', type: 'promo', status: 'active', budget: 15000, spent: 9800, impressions: 96000, clicks: 4100, conversions: 96, roi: 1.9 },
    { name: 'Referral Boost Week', type: 'email', status: 'paused', budget: 6000, spent: 2100, impressions: 88000, clicks: 3600, conversions: 180, roi: 2.8 },
    { name: 'Altcoin Season Push', type: 'social', status: 'draft', budget: 10000, spent: 0, impressions: 0, clicks: 0, conversions: 0, roi: 0 },
    { name: 'Cold User Re-engagement', type: 'email', status: 'completed', budget: 4500, spent: 4500, impressions: 54000, clicks: 1300, conversions: 61, roi: 1.2 },
  ];
  for (const c of CAMPAIGNS) {
    run(
      `INSERT INTO campaigns (name, type, status, budget, spent, impressions, clicks, conversions, roi, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '-30 days'), date('now', '+30 days'), ?)`,
      c.name, c.type, c.status, c.budget, c.spent, c.impressions, c.clicks, c.conversions, c.roi, pick([masterId, adminId])
    );
  }

  // ── Social accounts ────────────────────────────────────────────────────
  const SOCIAL = [
    ['facebook', '@hypecoincontrol', 184000, { likes: 12400, shares: 3100, comments: 980 }],
    ['instagram', '@hype.coin.control', 362000, { likes: 48900, shares: 6700, comments: 5400 }],
    ['tiktok', '@hypecoincontrol', 815000, { likes: 220000, shares: 41000, comments: 12800 }],
    ['linkedin', 'Hype Coin Control', 24000, { likes: 2100, shares: 640, comments: 210 }],
    ['x', '@hypecoin', 96000, { likes: 8300, shares: 2400, comments: 1500 }],
  ];
  const socialIds: number[] = [];
  for (const [platform, handle, followers, engagement] of SOCIAL) {
    const info = run(
      `INSERT INTO social_accounts (platform, handle, status, followers, engagement, connected_at)
       VALUES (?, ?, 'connected', ?, ?, datetime('now', '-${randInt(30, 200)} days'))`,
      platform, handle, followers, json(engagement)
    );
    socialIds.push(Number(info.lastInsertRowid));
  }

  const POSTS = [
    '🚀 The future of trading is here. Hype Coin Control v2 is live!',
    '📈 BTC just broke resistance. Are you positioned? #HypeCoin',
    '🎁 Refer a friend, earn 20% commission for 30 days. Terms apply.',
    '🔒 Security first: enable 2FA on your account today.',
    '🌊 Altcoin season is heating up. Watch DOGE & SOL momentum.',
    '💡 Master the market with our new copy-trading feature.',
  ];
  for (const p of POSTS) {
    run(
      `INSERT INTO scheduled_posts (account_id, content, scheduled_at, status, likes, comments, shares)
       VALUES (?, ?, datetime('now', '+${randInt(1, 14)} days'), 'scheduled', 0, 0, 0)`,
      pick(socialIds), p
    );
  }
  for (let i = 0; i < 6; i++) {
    run(
      `INSERT INTO scheduled_posts (account_id, content, scheduled_at, status, likes, comments, shares)
       VALUES (?, ?, datetime('now', '-${randInt(1, 20)} days'), 'published', ?, ?, ?)`,
      pick(socialIds), POSTS[i % POSTS.length], randInt(200, 9000), randInt(20, 900), randInt(10, 600)
    );
  }

  // ── Segments ───────────────────────────────────────────────────────────
  const SEGMENTS = [
    { name: 'Whales (balance > $20k)', description: 'High-net-worth users for VIP campaigns.', criteria: { balance: { gte: 20000 } } },
    { name: 'EU traders', description: 'Users located in the European Union.', criteria: { region: { in: ['DE', 'IT', 'FR', 'PT', 'CZ', 'SE', 'NO', 'IE'] } } },
    { name: 'Cold / at-risk users', description: 'Inactive users for re-engagement.', criteria: { status: { in: ['cold'] } } },
    { name: 'Referral sourced', description: 'Leads who came via referral links.', criteria: { source: 'referral' } },
  ];
  for (const s of SEGMENTS) {
    run('INSERT INTO segments (name, description, criteria) VALUES (?, ?, ?)', s.name, s.description, json(s.criteria));
  }

  // ── Chats ──────────────────────────────────────────────────────────────
  const chatDefs = [
    { uid: userIds[1], status: 'active', mode: 'manual' },
    { uid: userIds[6], status: 'waiting', mode: 'ai' },
    { uid: userIds[11], status: 'active', mode: 'hybrid' },
    { uid: userIds[3], status: 'waiting', mode: 'manual' },
    { uid: userIds[16], status: 'closed', mode: 'ai' },
  ];
  const chatIds: number[] = [];
  for (const c of chatDefs) {
    const info = run(
      `INSERT INTO chats (user_id, assignee_id, status, mode, last_message_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      c.uid, pick([adminId, supportId, null]), c.status, c.mode
    );
    chatIds.push(Number(info.lastInsertRowid));
  }
  const MSG_PAIRS: Array<[string, string]> = [
    ['user', 'Hi, my withdrawal has been pending for 3 days.'],
    ['admin', 'Thanks for reaching out — let me check your account status right now.'],
    ['user', 'I need help understanding the leverage limits.'],
    ['ai', 'Your current leverage limit is 1:20 for major pairs. I can raise a request for review.'],
    ['user', 'Is the platform down right now?'],
    ['admin', 'All systems are operational. If you see an error, please share a screenshot.'],
  ];
  let mi = 0;
  for (const cid of chatIds) {
    const n = randInt(2, 6);
    for (let k = 0; k < n; k++) {
      const [sender, body] = MSG_PAIRS[(mi + k) % MSG_PAIRS.length];
      run(
        `INSERT INTO chat_messages (chat_id, sender, body, created_at) VALUES (?, ?, ?, datetime('now', '-${(n - k) * 7} minutes'))`,
        cid, sender, body
      );
    }
    mi += n;
  }

  // ── Email templates & sends ────────────────────────────────────────────
  const TEMPLATES = [
    { name: 'Welcome aboard', category: 'welcome', subject: 'Welcome to Hype Coin Control 🚀', body: 'Hi {{name}},\n\nWelcome! Your account is ready. Verify your email and start trading in minutes.\n\n— Team Hype' },
    { name: 'Account warning', category: 'warning', subject: 'Action required on your account', body: 'Hi {{name}},\n\nWe noticed unusual activity. Please secure your account immediately.\n\n— Security Team' },
    { name: 'Launch promo', category: 'promo', subject: '50% bonus on your next deposit', body: 'Hi {{name}},\n\nFor a limited time, get a 50% bonus on deposits over $500.\n\n— Team Hype' },
    { name: 'Agreement notice', category: 'agreement', subject: 'Please review our updated Terms', body: 'Hi {{name}},\n\nWe updated our Terms of Service. Please review and accept.\n\n— Legal Team' },
  ];
  for (const t of TEMPLATES) {
    run('INSERT INTO email_templates (name, category, subject, body) VALUES (?, ?, ?, ?)', t.name, t.category, t.subject, t.body);
  }
  const EMAILS = [
    { subject: 'Welcome to Hype Coin Control 🚀', template: 'Welcome aboard', audience: 'all', recipients: 1824, opens: 1340, clicks: 512, status: 'sent' },
    { subject: '50% bonus on your next deposit', template: 'Launch promo', audience: 'segment', recipients: 640, opens: 431, clicks: 198, status: 'sent' },
    { subject: 'Action required on your account', template: 'Account warning', audience: 'single', recipients: 1, opens: 1, clicks: 0, status: 'sent' },
    { subject: 'Please review our updated Terms', template: 'Agreement notice', audience: 'all', recipients: 1824, opens: 981, clicks: 402, status: 'sent' },
    { subject: 'VIP Whale Onboarding invite', template: '', audience: 'segment', recipients: 210, opens: 176, clicks: 88, status: 'sent' },
  ];
  for (const e of EMAILS) {
    run(
      `INSERT INTO emails (subject, body, template, audience, recipient_count, opens, clicks, sent_by, sent_at, status)
       VALUES (?, '…', ?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(1, 30)} days'), ?)`,
      e.subject, e.template, e.audience, e.recipients, e.opens, e.clicks, pick([masterId, adminId]), e.status
    );
  }

  // ── Pop-ups ────────────────────────────────────────────────────────────
  const POPUPS = [
    { title: '⚠️ Security notice', body: 'Enable 2FA to protect your funds. It takes 30 seconds.', type: 'warning', target: 'all', frequency: 'every_login', enabled: 1 },
    { title: '🎁 Weekend bonus', body: 'Deposit $500+ this weekend and get a 50% bonus.', type: 'promo', target: 'segment', frequency: 'once', enabled: 1 },
    { title: 'ℹ️ Maintenance window', body: 'Scheduled maintenance tonight 02:00–03:00 UTC.', type: 'info', target: 'all', frequency: 'every_session', enabled: 0 },
  ];
  for (const p of POPUPS) {
    run(
      `INSERT INTO popups (title, body, type, target, target_id, pages, frequency, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      p.title, p.body, p.type, p.target, p.target === 'segment' ? 1 : null, json(['home', 'dashboard']), p.frequency, p.enabled
    );
  }

  // ── Pages + versions ───────────────────────────────────────────────────
  const homeSections = [
    { id: 'hero', type: 'hero', title: 'Trade the future. Control everything.', subtitle: 'The most powerful trading & CRM command center for ambitious teams.', cta: 'Start trading', cta2: 'View markets', theme: 'dark', order: 1 },
    { id: 'stats', type: 'stats', title: 'Trusted by traders worldwide', items: [{ label: 'Active users', value: '182,400' }, { label: 'Volume 24h', value: '$1.2B' }, { label: 'Uptime', value: '99.98%' }], order: 2 },
    { id: 'features', type: 'cards', title: 'Why Hype Coin Control', items: [{ title: 'Lightning execution', desc: 'Sub-millisecond order routing.', icon: 'zap' }, { title: 'Bank-grade security', desc: '2FA, cold storage, audits.', icon: 'shield' }, { title: 'AI insights', desc: 'Signals tuned to your style.', icon: 'sparkles' }], order: 3 },
    { id: 'banner', type: 'banner', title: 'Limited launch promo', cta: 'Claim bonus', color: '#a855f7', order: 4 },
    { id: 'footer', type: 'footer', text: '© 2026 Hype Coin Control. All rights reserved.', links: [{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/privacy' }], order: 5 },
  ];
  const homeId = Number(
    run(
      `INSERT INTO pages (slug, name, sections, published, version) VALUES ('home', 'Homepage', ?, 1, 3)`,
      json(homeSections)
    ).lastInsertRowid
  );
  const olderHome = homeSections.map((s) => ({ ...s, title: s.type === 'hero' ? 'Trade smarter. Grow faster.' : s.title }));
  run(`INSERT INTO page_versions (page_id, version, note, sections, created_by) VALUES (?, 2, 'Hero headline refresh', ?, ?)`, homeId, json(olderHome), masterId);
  run(`INSERT INTO page_versions (page_id, version, note, sections, created_by) VALUES (?, 1, 'Initial launch', ?, ?)`, homeId, json(olderHome), masterId);

  run(
    `INSERT INTO pages (slug, name, sections, published, version) VALUES ('pricing', 'Pricing', ?, 1, 1)`,
    json([{ id: 'hero', type: 'hero', title: 'Simple pricing. Serious power.', subtitle: 'Plans for every stage of your journey.', cta: 'Choose plan', order: 1 }])
  );
  run(
    `INSERT INTO pages (slug, name, sections, published, version) VALUES ('terms', 'Terms of Service', ?, 1, 1)`,
    json([{ id: 'hero', type: 'hero', title: 'Terms of Service', subtitle: 'The legal terms governing your use of the platform.', cta: '', order: 1 }])
  );

  // ── Agreements ─────────────────────────────────────────────────────────
  const AGREEMENTS = [
    { title: 'Terms of Service (2026)', type: 'terms', body: '1. Acceptance of Terms\nBy accessing Hype Coin Control you agree to these Terms...\n\n2. Eligible Use\nYou must be of legal age in your jurisdiction...\n\n3. Risk Disclosure\nTrading digital assets involves substantial risk...', generated: 1, status: 'published' },
    { title: 'Trading Risk Disclaimer', type: 'disclaimer', body: 'RISK DISCLOSURE\nDigital asset trading carries a high level of risk and may not be suitable for all investors...', generated: 1, status: 'published' },
    { title: 'Affiliate Partnership Contract', type: 'contract', body: 'PARTNERSHIP AGREEMENT\nThis agreement is entered between Hype Coin Control ("Company") and the Partner...', generated: 0, status: 'draft' },
  ];
  const agreementIds: number[] = [];
  for (const a of AGREEMENTS) {
    const info = run(
      `INSERT INTO agreements (title, type, body, generated_by_ai, status) VALUES (?, ?, ?, ?, ?)`,
      a.title, a.type, a.body, a.generated, a.status
    );
    agreementIds.push(Number(info.lastInsertRowid));
  }
  for (let i = 0; i < 8; i++) {
    run(
      `INSERT INTO agreement_sends (agreement_id, user_id, channel, sent_at, accepted_at, status)
       VALUES (?, ?, ?, datetime('now', '-${randInt(1, 25)} days'), datetime('now', '-${randInt(0, 20)} days'), ?)`,
      pick(agreementIds), pick(userIds), pick(['email', 'chat', 'social']), pick(['accepted', 'accepted', 'sent'])
    );
  }

  // ── AI commands ────────────────────────────────────────────────────────
  const AI_CMDS = [
    { command: 'Update homepage hero text', intent: 'website.edit', actions: [{ module: 'website', action: 'update_section', target: 'home/hero', description: 'Open the hero section editor for homepage' }], status: 'executed' },
    { command: 'Send warning email to users with negative balance', intent: 'email.send', actions: [{ module: 'emails', action: 'send', target: 'segment:negative_balance', description: 'Send "Account warning" template to 0 users' }], status: 'executed' },
    { command: 'Lock all users from country X', intent: 'users.lock', actions: [{ module: 'users', action: 'set_status', target: 'country:X', description: 'Lock all users from the selected country' }], status: 'pending' },
  ];
  for (const c of AI_CMDS) {
    run(
      `INSERT INTO ai_commands (command, intent, suggested_actions, status, admin_id, result, created_at, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(1, 10)} days'), datetime('now'))`,
      c.command, c.intent, json(c.actions), c.status, masterId,
      c.status === 'executed' ? 'Executed successfully' : null
    );
  }

  // ── Security / audit / alerts / backups ────────────────────────────────
  const LOGIN_ROWS = [
    [masterId, 'master', 1], [adminId, 'n.kane', 1], [supportId, 's.bloom', 1],
    [null, 'root', 0], [null, 'admin', 0], [masterId, 'master', 1], [null, 'master', 0],
  ];
  for (const [sid, uname, ok] of LOGIN_ROWS) {
    run(
      `INSERT INTO login_history (staff_id, username, ip, location, device, browser, success, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 20)} days'))`,
      sid, uname, `203.0.113.${randInt(2, 250)}`, pick(['Dubai, AE', 'New York, US', 'Berlin, DE', 'London, UK', 'Singapore, SG']),
      pick(['MacBook Pro', 'Windows 11', 'iPhone 15']), pick(['Chrome 126', 'Safari 17', 'Firefox 127']), ok
    );
  }
  const SEC_ROWS: Array<[string, string, string]> = [
    ['Failed login attempt', 'warning', '5 rapid failures from 103.22.200.14'],
    ['New device sign-in', 'info', 'master signed in from an unrecognized MacBook'],
    ['Possible brute force', 'critical', '42 failed attempts from 45.155.205.99'],
    ['Geo-impossible login', 'critical', 'US account logged in from RU 6 min after US session'],
    ['MFA disabled', 'warning', 'support agent disabled MFA'],
  ];
  for (const [event, sev, details] of SEC_ROWS) {
    run(
      `INSERT INTO security_logs (event, severity, ip, username, details, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 15)} days'))`,
      event, sev, `10.0.${randInt(0, 255)}.${randInt(0, 255)}`, pick(['master', 'unknown', 'n.kane']), details
    );
  }
  const ALERTS = [
    ['Failed login spike', '12 failed logins in the last 10 minutes.', 'warning', 'security'],
    ['API latency', 'Orders API p95 latency above 500ms.', 'info', 'system'],
    ['Large withdrawal', 'User o.haddad requested a $50,000 withdrawal.', 'warning', 'risk'],
    ['Campaign goal reached', 'Summer Trading Surge passed its conversion target.', 'info', 'marketing'],
  ];
  for (const [title, message, sev, source] of ALERTS) {
    run('INSERT INTO alerts (title, message, severity, source, dismissed) VALUES (?, ?, ?, ?, 0)', title, message, sev, source);
  }
  const BACKUPS = [
    ['Daily backup — 2026-08-22 02:00 UTC', '1.4 GB', 'Automated nightly snapshot'],
    ['Pre-migration backup', '1.3 GB', 'Captured before schema migration v12'],
    ['Manual backup — post-campaign', '1.2 GB', 'Requested by master admin'],
  ];
  for (const [name, size, note] of BACKUPS) {
    run('INSERT INTO backup_points (name, size, status, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\', \'-7 days\'))', name, size, 'completed', note, masterId);
  }
  const NOTIFS = [
    ['New lead assigned', 'Felix Grant was assigned to you.', 'info'],
    ['Agreement pending', '3 users have not accepted the updated Terms.', 'warning'],
    ['Backup completed', 'Nightly backup finished successfully.', 'info'],
  ];
  for (const [title, body, type] of NOTIFS) {
    run('INSERT INTO notifications (title, body, type) VALUES (?, ?, ?)', title, body, type);
  }

  // ── Guarantee "today" activity so live KPIs aren't empty ───────────────
  for (let i = 0; i < 6; i++) {
    run(
      `INSERT INTO orders (user_id, asset, amount, side, result, live, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 6)} hours'), datetime('now'))`,
      pick(userIds), pick(ASSETS), randFloat(500, 30000), pick(['buy', 'sell']), pick(['win', 'win', 'live', 'lose']), Math.random() < 0.25 ? 1 : 0
    );
  }
  for (let i = 0; i < 8; i++) {
    run(
      `INSERT INTO transactions (user_id, type, amount, reason, admin_id, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${randInt(0, 10)} hours'))`,
      pick(userIds), pick(['add', 'deduct']), randFloat(100, 6000), pick(['Deposit', 'Trading fee', 'Promo credit', 'Withdrawal']), pick([masterId, adminId]), randFloat(0, 90000)
    );
  }

  // ── System settings ────────────────────────────────────────────────────
  setSetting('lockdown', 'false');
  setSetting('site_title', 'Hype Coin Control');
  setSetting('support_email', 'support@hypecoincontrol.io');
  setSetting('maintenance_mode', 'false');
  setSetting('app_version', '2.4.1');

  // A couple of seed audit rows so the log page isn't empty on first run.
  logActivity({ id: masterId, full_name: 'Ava Stone' }, 'system', 'seeded', { type: 'system' }, 'Initial dataset created');
  logActivity({ id: masterId, full_name: 'Ava Stone' }, 'auth', 'login', { type: 'staff', id: masterId }, 'Master admin signed in');
}

// Allow `npm run seed` / `npm run seed -- --force`
if (process.argv[1]?.includes('seed')) {
  const force = process.argv.includes('--force');
  seed(force);
  const counts = ['users', 'leads', 'campaigns', 'orders', 'chats', 'emails', 'popups', 'pages', 'agreements', 'segments', 'staff'].map((t) => {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number };
    return `${t}=${row.c}`;
  });
  console.log('🌱 Seed complete →', counts.join(', '));
}
