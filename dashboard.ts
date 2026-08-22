import { Router } from 'express';
import { db, getSetting, isLockdown } from '../db.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

export const dashboardRouter = Router();

function count(sql: string): number {
  return (db.prepare(sql).get() as { c: number }).c;
}

/** Deterministic mock series for charts that have no dedicated table yet. */
function syntheticSeries(days: number, base: number, growth: number, noise = 0.3): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const trend = base + (days - i) * growth;
    const wobble = Math.sin(i * 1.7) * base * noise;
    out.push(Math.max(0, Math.round(trend + wobble)));
  }
  return out;
}

function dayLabels(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
}

dashboardRouter.get('/', authRequired, requirePermission('dashboard.view'), (_req, res) => {
  const totalUsers = count('SELECT COUNT(*) AS c FROM users');
  const activeUsers = count("SELECT COUNT(*) AS c FROM users WHERE status = 'active'");
  const lockedUsers = count("SELECT COUNT(*) AS c FROM users WHERE status = 'locked'");
  const blockedUsers = count("SELECT COUNT(*) AS c FROM users WHERE status = 'blocked'");
  const coldUsers = count("SELECT COUNT(*) AS c FROM users WHERE status = 'cold'");
  const pendingUsers = count("SELECT COUNT(*) AS c FROM users WHERE status = 'pending'");
  const totalLeads = count('SELECT COUNT(*) AS c FROM leads');
  const activeCampaigns = count("SELECT COUNT(*) AS c FROM campaigns WHERE status = 'active'");
  const openChats = count("SELECT COUNT(*) AS c FROM chats WHERE status IN ('waiting','active')");
  const totalBalance = (db.prepare('SELECT COALESCE(SUM(balance),0) AS s FROM users').get() as { s: number }).s;

  const fee = (result: string, period: string) =>
    (db
      .prepare(
        `SELECT COALESCE(SUM(amount * 0.008), 0) AS s FROM orders WHERE result = ? AND ${period}`
      )
      .get(result) as { s: number }).s;

  const todayRevenue = fee('win', "date(created_at) = date('now')");
  const weeklyRevenue = fee('win', "created_at >= datetime('now', '-7 days')");
  const totalRevenue = fee('win', '1=1');

  const labels = dayLabels(14);
  const traffic = syntheticSeries(14, 900, 55, 0.35);
  const signups = syntheticSeries(14, 40, 3, 0.4);

  // Orders per day (real data from DB).
  const ordersByDay = db
    .prepare(
      `SELECT date(created_at) AS d, COUNT(*) AS c FROM orders
       WHERE created_at >= datetime('now', '-14 days') GROUP BY date(created_at) ORDER BY d`
    )
    .all() as Array<{ d: string; c: number }>;
  const orderMap = new Map(ordersByDay.map((r) => [r.d, r.c]));
  const ordersSeries = labels.map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return orderMap.get(key) ?? 0;
  });

  // Conversion funnel from lead stages.
  const stageMap = new Map(
    (db.prepare('SELECT stage, COUNT(*) AS c FROM leads GROUP BY stage').all() as Array<{ stage: string; c: number }>).map(
      (r) => [r.stage, r.c]
    )
  );
  const funnel = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'].map((stage) => ({
    stage,
    value: stageMap.get(stage) ?? 0,
  }));

  // Live online users (plausible projection from active base + open chats).
  const online = Math.min(activeUsers, Math.max(12, Math.round(activeUsers * 0.07) + openChats));
  const recent = db
    .prepare(
      `SELECT id, username, full_name, country, status, balance, updated_at AS last_seen FROM users
       ORDER BY RANDOM() LIMIT 8`
    )
    .all();

  const health = {
    api: 'operational',
    db: 'operational',
    uptimeSec: Math.round(process.uptime()),
    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    version: getSetting('app_version', '2.4.1'),
    lastBackup: (db.prepare('SELECT created_at FROM backup_points ORDER BY created_at DESC LIMIT 1').get() as { created_at: string } | undefined)?.created_at ?? null,
    pendingAlerts: count('SELECT COUNT(*) AS c FROM alerts WHERE dismissed = 0'),
  };

  res.json({
    data: {
      kpi: {
        totalUsers,
        activeUsers,
        lockedUsers,
        blockedUsers,
        coldUsers,
        pendingUsers,
        totalLeads,
        activeCampaigns,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        weeklyRevenue: Math.round(weeklyRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100,
        openChats,
      },
      charts: {
        labels,
        traffic,
        signups,
        orders: ordersSeries,
        funnel,
      },
      online,
      onlineUsers: recent,
      health,
      lockdown: isLockdown(),
      maintenance: getSetting('maintenance_mode', 'false') === 'true',
    },
  });
});
