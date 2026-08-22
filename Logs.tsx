import { useEffect, useState } from 'react';
import { ScrollText, ShieldAlert, BellRing, DatabaseBackup, Download, RotateCcw, Search } from 'lucide-react';
import { PageHeader, Card, TableShell, Loading, Empty, Input, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtDateTime, timeAgo } from '../lib/format';

type Tab = 'activity' | 'security' | 'alerts' | 'backups';

interface Activity { id: number; actor_name: string; module: string; action: string; target_type: string | null; details: string | null; created_at: string }
interface Security { id: number; event: string; severity: string; ip: string | null; username: string | null; details: string | null; created_at: string }
interface Alert { id: number; title: string; message: string; severity: string; source: string; dismissed: number; created_at: string }
interface Backup { id: number; name: string; size: string; status: string; note: string; created_at: string }

export default function Logs() {
  const [tab, setTab] = useState<Tab>('activity');
  const [activity, setActivity] = useState<Activity[]>([]);
  const [security, setSecurity] = useState<Security[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState('all');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { can } = useAuth();

  const loadActivity = () => {
    const qs = new URLSearchParams({ module, q, date }).toString();
    api.get<{ data: Activity[] }>(`/system/logs/activity?${qs}`).then((r) => setActivity(r.data)).catch(() => undefined);
  };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.get<{ data: Activity[] }>('/system/logs/activity'),
      api.get<{ data: Security[] }>('/system/logs/security'),
      api.get<{ data: Alert[] }>('/system/alerts'),
      api.get<{ data: Backup[] }>('/system/backups'),
    ])
      .then(([a, s, al, b]) => {
        setActivity(a.data);
        setSecurity(s.data);
        setAlerts(al.data);
        setBackups(b.data);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadAll, []);

  const dismiss = async (id: number) => {
    try {
      await api.post(`/system/alerts/${id}/dismiss`);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: 1 } : a)));
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ data: { name: string; size: string } }>('/system/backups');
      toast.push('success', `Backup created (${r.data.size})`);
      const b = await api.get<{ data: Backup[] }>('/system/backups');
      setBackups(b.data);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: number) => {
    try {
      const r = await api.post<{ data: { message: string } }>(`/system/backups/${id}/restore`);
      toast.push('info', r.data.message);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'activity', label: 'Activity logs', icon: <ScrollText className="h-4 w-4" /> },
    { key: 'security', label: 'Security', icon: <ShieldAlert className="h-4 w-4" /> },
    { key: 'alerts', label: 'Alerts', icon: <BellRing className="h-4 w-4" /> },
    { key: 'backups', label: 'Backups', icon: <DatabaseBackup className="h-4 w-4" /> },
  ];

  if (loading) return <Loading />;

  const openAlerts = alerts.filter((a) => !a.dismissed).length;

  return (
    <div className="fade-up">
      <PageHeader title="Logs & Security" subtitle="Full audit trail, security events, alerts and backups" />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${tab === t.key ? 'bg-neon-green/10 text-neon-green ring-1 ring-inset ring-neon-green/30' : 'bg-ink-800 text-slate-400 hover:text-white'}`}
          >
            {t.icon} {t.label}
            {t.key === 'alerts' && openAlerts > 0 && <span className="rounded-full bg-neon-red px-1.5 text-[10px] font-bold text-white">{openAlerts}</span>}
          </button>
        ))}
      </div>

      {tab === 'activity' && (
        <Card title="Admin activity" subtitle="Who did what, when" actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="!w-44 !py-1.5 pl-8 text-xs" />
            </div>
            <Select value={module} onChange={(e) => setModule(e.target.value)} className="!w-36 !py-1.5 text-xs">
              <option value="all">All modules</option>
              {['auth', 'users', 'balances', 'orders', 'leads', 'campaigns', 'social', 'chats', 'emails', 'popups', 'website', 'agreements', 'ai', 'security', 'backups', 'settings', 'staff', 'system'].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-40 !py-1.5 text-xs" />
            <button onClick={loadActivity} className="hcc-btn-ghost !py-1.5 text-xs">Filter</button>
          </div>
        }>
          <TableShell>
            <thead className="bg-ink-850/80">
              <tr>
                <th className="th">Actor</th>
                <th className="th">Module</th>
                <th className="th">Action</th>
                <th className="th">Target</th>
                <th className="th">Details</th>
                <th className="th">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {activity.map((a) => (
                <tr key={a.id} className="hover:bg-ink-800/40">
                  <td className="td font-medium text-slate-100">{a.actor_name}</td>
                  <td className="td"><span className={badge(a.module)}>{a.module}</span></td>
                  <td className="td text-xs text-slate-300">{a.action}</td>
                  <td className="td text-xs text-slate-500">{a.target_type ? `${a.target_type}${a.target_type === 'system' ? '' : ''}` : '—'}</td>
                  <td className="td max-w-[280px] truncate font-mono text-xs text-slate-500" title={a.details ?? ''}>{a.details ?? '—'}</td>
                  <td className="td text-xs text-slate-500" title={fmtDateTime(a.created_at)}>{timeAgo(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}

      {tab === 'security' && (
        <Card title="Security events" subtitle="Failed logins, suspicious IPs and unusual behavior">
          <TableShell>
            <thead className="bg-ink-850/80">
              <tr>
                <th className="th">Event</th>
                <th className="th">Severity</th>
                <th className="th">IP</th>
                <th className="th">User</th>
                <th className="th">Details</th>
                <th className="th">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {security.map((s) => (
                <tr key={s.id} className="hover:bg-ink-800/40">
                  <td className="td text-slate-200">{s.event}</td>
                  <td className="td"><span className={badge(s.severity)}>{s.severity}</span></td>
                  <td className="td font-mono text-xs">{s.ip ?? '—'}</td>
                  <td className="td text-xs">{s.username ?? '—'}</td>
                  <td className="td max-w-[280px] truncate text-xs text-slate-500" title={s.details ?? ''}>{s.details ?? '—'}</td>
                  <td className="td text-xs text-slate-500">{timeAgo(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((a) => (
            <Card key={a.id} title={a.title} subtitle={`${a.source} · ${timeAgo(a.created_at)}`} actions={
              <span className={badge(a.severity)}>{a.severity}</span>
            }>
              <p className="text-sm text-slate-400">{a.message}</p>
              {!a.dismissed && (
                <button onClick={() => dismiss(a.id)} className="mt-3 text-xs font-semibold text-neon-cyan hover:underline">Dismiss</button>
              )}
              {!!a.dismissed && <p className="mt-3 text-xs text-slate-600">Dismissed</p>}
            </Card>
          ))}
        </div>
      )}

      {tab === 'backups' && (
        <Card title="Backup points" subtitle="Snapshots and restore operations" actions={can('backups.manage') && (
          <button onClick={createBackup} disabled={busy} className="hcc-btn-cyan text-xs"><Download className="h-4 w-4" /> {busy ? 'Creating…' : 'Create backup'}</button>
        )}>
          <TableShell>
            <thead className="bg-ink-850/80">
              <tr>
                <th className="th">Name</th>
                <th className="th">Size</th>
                <th className="th">Status</th>
                <th className="th">Note</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-ink-800/40">
                  <td className="td font-mono text-xs text-slate-200">{b.name}</td>
                  <td className="td text-xs">{b.size}</td>
                  <td className="td"><span className={badge(b.status)}>{b.status}</span></td>
                  <td className="td text-xs text-slate-500">{b.note}</td>
                  <td className="td text-xs text-slate-500">{fmtDateTime(b.created_at)}</td>
                  <td className="td text-right">
                    {can('backups.manage') && (
                      <button onClick={() => restore(b.id)} className="hcc-btn-ghost !py-1 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      )}
    </div>
  );
}
