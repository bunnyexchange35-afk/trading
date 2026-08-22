import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, UserPlus, Snowflake, Lock, Ban, CheckCircle2, XCircle, Search } from 'lucide-react';
import { PageHeader, TableShell, Modal, Field, Input, Loading, Empty, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtMoney, initials } from '../lib/format';
import type { User, UserStatus } from '../lib/types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState<Array<{ status: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState('all');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', username: '', email: '', country: '', status: 'active' });
  const toast = useToast();
  const { can } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ status, q }).toString();
    api.get<{ data: User[]; meta: { counts: Array<{ status: string; count: number }> } }>(`/users?${qs}`)
      .then((r) => {
        setUsers(r.data);
        setCounts(r.meta.counts);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [status, q]);

  const setStatusFilter = (s: string) => {
    setStatus(s);
  };

  const changeStatus = async (id: number, to: UserStatus) => {
    setBusyId(id);
    try {
      await api.post(`/users/${id}/status`, { status: to, reason: `Set by admin from panel` });
      toast.push('success', `User set to ${to}`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/users/${id}/approve`);
      toast.push('success', 'User approved');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const createUser = async () => {
    try {
      await api.post('/users', form);
      toast.push('success', 'User created');
      setCreateOpen(false);
      setForm({ full_name: '', username: '', email: '', country: '', status: 'active' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <div className="fade-up">
      <PageHeader
        title="Users & Profile Control"
        subtitle={`${total} platform members · manage profiles, statuses, balances and history`}
        actions={can('users.manage') && (
          <button className="hcc-btn-primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> New user
          </button>
        )}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, email, country…" className="hcc-input w-72 pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['all', 'active', 'cold', 'locked', 'blocked', 'pending'].map((s) => {
            const c = s === 'all' ? total : counts.find((x) => x.status === s)?.count ?? 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  status === s ? 'bg-neon-green/15 text-neon-green ring-1 ring-inset ring-neon-green/40' : 'bg-ink-800 text-slate-400 hover:text-white'
                }`}
              >
                {s} <span className="opacity-60">({c})</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <Empty label="No users match" hint="Try a different filter or search term" />
      ) : (
        <TableShell>
          <thead className="bg-ink-850/80">
            <tr>
              <th className="th">Name</th>
              <th className="th">Status</th>
              <th className="th">Device / Browser</th>
              <th className="th">Phone</th>
              <th className="th">IP · Location</th>
              <th className="th text-right">Balance</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-ink-800/40">
                <td className="td">
                  <button className="flex items-center gap-3 text-left" onClick={() => navigate(`/users/${u.id}`)}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-xs font-bold text-neon-cyan">
                      {initials(u.full_name)}
                    </span>
                    <span>
                      <span className="block font-medium text-slate-100">{u.full_name}</span>
                      <span className="block text-xs text-slate-500">@{u.username}</span>
                    </span>
                  </button>
                </td>
                <td className="td"><span className={badge(u.status)}>{u.status}</span></td>
                <td className="td">
                  <span className="block text-xs">{u.device ?? '—'}</span>
                  <span className="block text-xs text-slate-500">{u.browser ?? ''}</span>
                </td>
                <td className="td text-xs">{u.phone ?? '—'}</td>
                <td className="td">
                  <span className="block font-mono text-xs">{u.ip ?? '—'}</span>
                  <span className="block text-xs text-slate-500">{u.location ?? u.country ?? ''}</span>
                </td>
                <td className="td text-right font-mono text-sm text-neon-cyan">{fmtMoney(u.balance)}</td>
                <td className="td">
                  <div className="flex items-center justify-end gap-1">
                    <button title="View profile" onClick={() => navigate(`/users/${u.id}`)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-ink-700 hover:text-neon-cyan">
                      <Eye className="h-4 w-4" />
                    </button>
                    {u.status === 'pending' && can('users.manage') && (
                      <>
                        <button title="Approve" onClick={() => approve(u.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-green/10 hover:text-neon-green">
                          {busyId === u.id ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                        <button title="Reject" onClick={() => changeStatus(u.id, 'blocked')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-red/10 hover:text-neon-red">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {can('users.status') && (
                      <>
                        <button title="Set cold" onClick={() => changeStatus(u.id, 'cold')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-cyan/10 hover:text-neon-cyan">
                          <Snowflake className="h-4 w-4" />
                        </button>
                        <button title="Lock" onClick={() => changeStatus(u.id, 'locked')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-amber/10 hover:text-neon-amber">
                          <Lock className="h-4 w-4" />
                        </button>
                        <button title="Block" onClick={() => changeStatus(u.id, 'blocked')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-red/10 hover:text-neon-red">
                          <Ban className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New user">
        <div className="space-y-4">
          <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. US" /></Field>
          <button onClick={createUser} className="hcc-btn-primary w-full"><UserPlus className="h-4 w-4" /> Create user</button>
        </div>
      </Modal>
    </div>
  );
}
