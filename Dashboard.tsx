import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Users, UserCheck, UserX, Target, Megaphone, TrendingUp, DollarSign, Activity, Radio, Server, Lock, BellRing, Rocket, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, StatCard, Modal, Field, Input, Select, Textarea, ConfirmModal, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtMoney, fmtNum, badge, fmtDate } from '../lib/format';

interface Dash {
  kpi: Record<string, number>;
  charts: { labels: string[]; traffic: number[]; signups: number[]; orders: number[]; funnel: Array<{ stage: string; value: number }> };
  online: number;
  onlineUsers: Array<{ id: number; username: string; full_name: string; country: string; status: string; balance: number; last_seen: string }>;
  health: Record<string, unknown>;
  lockdown: boolean;
}

const tooltipStyle = {
  background: '#0e1320',
  border: '1px solid #26314d',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

export default function Dashboard() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [popupOpen, setPopupOpen] = useState(false);
  const [campOpen, setCampOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [popup, setPopup] = useState({ title: '', body: '', type: 'info' });
  const [camp, setCamp] = useState({ name: '', type: 'promo', budget: 5000 });

  const load = () => {
    api.get<{ data: Dash }>('/dashboard')
      .then((r) => setDash(r.data))
      .catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  if (err) return <div className="py-20 text-center text-sm text-neon-red">{err}</div>;
  if (!dash) return <Loading label="Loading command center…" />;

  const { kpi, charts, online, onlineUsers, health } = dash;
  const trafficData = charts.labels.map((l, i) => ({ day: l, visits: charts.traffic[i], signups: charts.signups[i] }));
  const ordersData = charts.labels.map((l, i) => ({ day: l, orders: charts.orders[i] }));
  const maxFunnel = Math.max(1, ...charts.funnel.map((f) => f.value));
  const funnelColors = ['#22ff9a', '#00e5ff', '#a855f7', '#ffb020', '#ff4d8d'];

  const quickLock = async () => {
    try {
      const r = await api.post<{ data: { locked: number } }>('/system/quick/lock-all');
      toast.push('error', `🔒 ${r.data.locked} user(s) locked`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };
  const sendPopup = async () => {
    try {
      await api.post('/system/quick/popup', popup);
      toast.push('success', 'Global pop-up broadcast');
      setPopupOpen(false);
      setPopup({ title: '', body: '', type: 'info' });
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };
  const startCamp = async () => {
    try {
      await api.post('/system/quick/campaign', camp);
      toast.push('success', 'Campaign started');
      setCampOpen(false);
      setCamp({ name: '', type: 'promo', budget: 5000 });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="fade-up">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total users" value={fmtNum(kpi.totalUsers)} sub={`${fmtNum(kpi.activeUsers)} active`} icon={<Users className="h-4 w-4" />} tone="cyan" onClick={() => navigate('/users')} />
        <StatCard label="Active users" value={fmtNum(kpi.activeUsers)} sub={`${kpi.coldUsers} cold`} icon={<UserCheck className="h-4 w-4" />} tone="green" />
        <StatCard label="Locked / Blocked" value={`${kpi.lockedUsers} / ${kpi.blockedUsers}`} sub={`${kpi.pendingUsers} pending approval`} icon={<UserX className="h-4 w-4" />} tone="red" />
        <StatCard label="Total leads" value={fmtNum(kpi.totalLeads)} sub={`${fmtNum(kpi.activeCampaigns)} active campaigns`} icon={<Target className="h-4 w-4" />} tone="purple" />
      </div>

      {/* KPI row 2 */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Today's revenue" value={fmtMoney(kpi.todayRevenue)} sub={<span className="flex items-center gap-1 text-neon-green"><ArrowUpRight className="h-3 w-3" /> live</span>} icon={<DollarSign className="h-4 w-4" />} tone="green" />
        <StatCard label="Weekly revenue" value={fmtMoney(kpi.weeklyRevenue)} icon={<TrendingUp className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total revenue" value={fmtMoney(kpi.totalRevenue)} icon={<Activity className="h-4 w-4" />} tone="purple" />
        <StatCard label="AUM (user balances)" value={fmtMoney(kpi.totalBalance, 0)} sub={`${kpi.openChats} open chats`} icon={<Megaphone className="h-4 w-4" />} tone="amber" />
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Website traffic" subtitle="Visits & signups · last 14 days" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22ff9a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22ff9a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSign" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c253a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="visits" name="Visits" stroke="#22ff9a" strokeWidth={2} fill="url(#gVisits)" />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#00e5ff" strokeWidth={2} fill="url(#gSign)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Orders activity" subtitle="Orders per day · last 14 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersData} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1c253a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,229,255,0.06)' }} />
                <Bar dataKey="orders" name="Orders" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Conversion funnel */}
        <Card title="Conversion funnel" subtitle="Leads by pipeline stage">
          <div className="space-y-2.5">
            {charts.funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-300">{f.stage}</span>
                  <span className="font-mono text-slate-500">{f.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(f.value / maxFunnel) * 100}%`, background: funnelColors[i] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live online users */}
        <Card title="Live online users" subtitle="Projected from active base" actions={<span className="flex items-center gap-1.5 text-xs font-semibold text-neon-green"><Radio className="h-3.5 w-3.5 animate-pulse-dot" /> {online} online</span>}>
          <ul className="divide-y divide-ink-700">
            {onlineUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
                </span>
                <span className="flex-1 truncate text-sm text-slate-200">{u.full_name}</span>
                <span className="text-xs text-slate-500">{u.country ?? '—'}</span>
                <span className="w-20 text-right font-mono text-xs text-neon-cyan">{fmtMoney(u.balance, 0)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* System health + quick actions */}
        <div className="space-y-4">
          <Card title="System health" subtitle={`v${String(health.version)}`} actions={<span className="flex items-center gap-1.5 text-xs text-neon-green"><Server className="h-3.5 w-3.5" /> {String(health.api)}</span>}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-ink-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">API</p>
                <p className="mt-0.5 font-semibold text-neon-green">{String(health.api)}</p>
              </div>
              <div className="rounded-lg bg-ink-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Database</p>
                <p className="mt-0.5 font-semibold text-neon-cyan">{String(health.db)}</p>
              </div>
              <div className="rounded-lg bg-ink-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Uptime</p>
                <p className="mt-0.5 font-semibold text-slate-200">{Math.floor(Number(health.uptimeSec) / 60)}m</p>
              </div>
              <div className="rounded-lg bg-ink-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Memory</p>
                <p className="mt-0.5 font-semibold text-slate-200">{String(health.rssMb)} MB</p>
              </div>
            </div>
            <p className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Last backup</span>
              <span className="text-slate-300">{fmtDate(String(health.lastBackup ?? ''))}</span>
            </p>
            <p className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Open alerts</span>
              <span className="font-semibold text-neon-amber">{String(health.pendingAlerts)}</span>
            </p>
          </Card>

          {can('users.status') && (
            <Card title="Quick actions" subtitle="Danger zone — use with care">
              <div className="grid gap-2">
                <button onClick={() => setLockOpen(true)} className="hcc-btn-danger w-full">
                  <Lock className="h-4 w-4" /> Lock all users
                </button>
                <button onClick={() => setPopupOpen(true)} className="hcc-btn-cyan w-full">
                  <BellRing className="h-4 w-4" /> Send global pop-up
                </button>
                <button onClick={() => setCampOpen(true)} className="hcc-btn-purple w-full">
                  <Rocket className="h-4 w-4" /> Start campaign
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal open={lockOpen} onClose={() => setLockOpen(false)} onConfirm={quickLock} title="Lock all users" message="This will set every active, cold and pending user to LOCKED. This is reversible per user, but it affects everyone. Continue?" confirmLabel="Lock all users" danger />

      <Modal open={popupOpen} onClose={() => setPopupOpen(false)} title="Send global pop-up">
        <div className="space-y-4">
          <Field label="Title"><Input value={popup.title} onChange={(e) => setPopup({ ...popup, title: e.target.value })} placeholder="Announcement" /></Field>
          <Field label="Message"><Textarea value={popup.body} onChange={(e) => setPopup({ ...popup, body: e.target.value })} placeholder="Message to show users…" /></Field>
          <Field label="Type">
            <Select value={popup.type} onChange={(e) => setPopup({ ...popup, type: e.target.value })}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="promo">Promo</option>
            </Select>
          </Field>
          <button onClick={sendPopup} className="hcc-btn-cyan w-full"><BellRing className="h-4 w-4" /> Broadcast now</button>
        </div>
      </Modal>

      <Modal open={campOpen} onClose={() => setCampOpen(false)} title="Start campaign">
        <div className="space-y-4">
          <Field label="Campaign name"><Input value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} placeholder="e.g. Q4 Growth Push" /></Field>
          <Field label="Type">
            <Select value={camp.type} onChange={(e) => setCamp({ ...camp, type: e.target.value })}>
              <option value="promo">Promo</option>
              <option value="email">Email</option>
              <option value="social">Social</option>
            </Select>
          </Field>
          <Field label="Budget (USD)"><Input type="number" value={camp.budget} onChange={(e) => setCamp({ ...camp, budget: Number(e.target.value) })} /></Field>
          <button onClick={startCamp} className="hcc-btn-purple w-full"><Rocket className="h-4 w-4" /> Launch campaign</button>
        </div>
      </Modal>
    </div>
  );
}
