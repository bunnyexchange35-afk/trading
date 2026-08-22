import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Wallet, StickyNote, Snowflake, Lock, Ban, CheckCircle2, XCircle, Plus, Minus } from 'lucide-react';
import { Card, Modal, Field, Input, Textarea, Loading, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtMoney, fmtDateTime, initials, timeAgo } from '../lib/format';
import type { UserStatus } from '../lib/types';

interface Detail {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  device: string | null;
  browser: string | null;
  ip: string | null;
  location: string | null;
  country: string | null;
  status: UserStatus;
  balance: number;
  limits: Record<string, number>;
  tags: string[];
  created_at: string;
  notes: Array<{ id: number; note: string; admin_id: number; created_at: string }>;
  transactions: any[];
  orders: any[];
  statusHistory: any[];
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [u, setU] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [balOpen, setBalOpen] = useState(false);
  const [edit, setEdit] = useState({ full_name: '', email: '', phone: '', country: '', limits: {} as Record<string, number> });
  const [bal, setBal] = useState({ type: 'add', amount: 100, reason: '' });
  const [note, setNote] = useState('');

  const load = () => {
    api.get<{ data: Detail }>(`/users/${id}`)
      .then((r) => {
        setU(r.data);
        setEdit({ full_name: r.data.full_name, email: r.data.email, phone: r.data.phone ?? '', country: r.data.country ?? '', limits: r.data.limits });
      })
      .catch((e) => toast.push('error', e.message));
  };
  useEffect(load, [id]);

  if (!u) return <Loading />;

  const setStatus = async (to: UserStatus) => {
    setBusy(true);
    try {
      await api.post(`/users/${u.id}/status`, { status: to, reason: 'Manual admin action' });
      toast.push('success', `Status → ${to}`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/users/${u.id}`, { ...edit, phone: edit.phone || null, limits: edit.limits });
      toast.push('success', 'Profile updated');
      setEditOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const adjustBalance = async () => {
    try {
      const r = await api.post<{ data: { balance: number } }>(`/balances/${u.id}/adjust`, { ...bal, amount: Number(bal.amount) });
      toast.push('success', `Balance ${bal.type === 'add' ? 'credited' : 'deducted'} → ${fmtMoney(r.data.balance)}`);
      setBalOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      await api.post(`/users/${u.id}/notes`, { note });
      toast.push('success', 'Note added');
      setNote('');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const statusBtn = (label: string, to: UserStatus, cls: string, icon: React.ReactNode) => (
    <button disabled={busy || u.status === to} onClick={() => setStatus(to)} className={`${cls} disabled:opacity-40`}>
      {busy ? <Spinner className="h-4 w-4" /> : icon} {label}
    </button>
  );

  return (
    <div className="fade-up">
      <button onClick={() => navigate('/users')} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-neon-cyan">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </button>

      {/* Header */}
      <div className="glass mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-lg font-bold text-neon-cyan">
            {initials(u.full_name)}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-50">{u.full_name}</h1>
            <p className="text-sm text-slate-500">@{u.username} · {u.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={badge(u.status)}>{u.status}</span>
              {u.tags.map((t) => (
                <span key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] text-slate-300">#{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('users.manage') && (
            <button className="hcc-btn-ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit profile
            </button>
          )}
          {can('balances.manage') && (
            <button className="hcc-btn-cyan" onClick={() => setBalOpen(true)}>
              <Wallet className="h-4 w-4" /> Adjust balance
            </button>
          )}
          {u.status === 'pending' && can('users.manage') && (
            <button className="hcc-btn-primary" onClick={() => setStatus('active')}><CheckCircle2 className="h-4 w-4" /> Approve</button>
          )}
          {can('users.status') && (
            <>
              {statusBtn('Cold', 'cold', 'hcc-btn-ghost text-neon-cyan', <Snowflake className="h-4 w-4" />)}
              {statusBtn('Lock', 'locked', 'hcc-btn-ghost text-neon-amber', <Lock className="h-4 w-4" />)}
              {statusBtn('Block', 'blocked', 'hcc-btn-danger', <Ban className="h-4 w-4" />)}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Profile info */}
          <Card title="Profile" subtitle={`Joined ${fmtDateTime(u.created_at)}`}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ['Phone', u.phone ?? '—'],
                ['Device', u.device ?? '—'],
                ['Browser', u.browser ?? '—'],
                ['IP address', u.ip ?? '—'],
                ['Location', u.location ?? '—'],
                ['Country', u.country ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-ink-950/60 p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt>
                  <dd className="mt-1 truncate text-sm text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <p className="hcc-label">Limits</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(u.limits).map(([k, v]) => (
                  <span key={k} className="rounded-lg bg-ink-950/60 px-3 py-1.5 text-xs">
                    <span className="text-slate-500">{k}:</span> <span className="font-mono text-neon-cyan">{fmtMoney(Number(v), 0)}</span>
                  </span>
                ))}
                {Object.keys(u.limits).length === 0 && <span className="text-xs text-slate-500">No limits set</span>}
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card title="Activity history" subtitle="Transactions, orders & status changes">
            <div className="divide-y divide-ink-700/70">
              {[...u.transactions.map((t) => ({ kind: 'transaction', ...t })), ...u.orders.map((o) => ({ kind: 'order', ...o })), ...u.statusHistory.map((s) => ({ kind: 'status', ...s }))]
                .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
                .slice(0, 20)
                .map((row, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${row.kind === 'transaction' ? 'bg-neon-cyan/10 text-neon-cyan' : row.kind === 'order' ? 'bg-neon-purple/10 text-neon-purple' : 'bg-neon-amber/10 text-neon-amber'}`}>
                      {row.kind}
                    </span>
                    <span className="flex-1 text-slate-300">
                      {row.kind === 'transaction' && `${row.type === 'add' ? 'Deposit' : 'Debit'} ${fmtMoney(Number(row.amount))} — ${String(row.reason ?? '')}`}
                      {row.kind === 'order' && `${String(row.asset)} ${String(row.side)} ${fmtMoney(Number(row.amount))} → ${String(row.result)}`}
                      {row.kind === 'status' && `${String(row.from_status)} → ${String(row.to_status)}${row.reason ? ` (${String(row.reason)})` : ''}`}
                    </span>
                    <span className="text-xs text-slate-500">{timeAgo(String(row.created_at))}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        {/* Right rail: balance + notes + status history */}
        <div className="space-y-4">
          <Card title="Balance" actions={<button className="hcc-btn-ghost text-xs" onClick={() => setBalOpen(true)}>+ Adjust</button>}>
            <p className="font-display text-3xl font-bold text-neon-cyan neon-text-cyan">{fmtMoney(u.balance)}</p>
            <p className="mt-1 text-xs text-slate-500">USD available</p>
          </Card>

          <Card title="Internal notes" subtitle={`${u.notes.length} note(s)`}>
            <div className="space-y-2">
              {u.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-ink-950/60 p-2.5 text-sm text-slate-300">
                  {n.note}
                  <p className="mt-1 text-[11px] text-slate-600">{timeAgo(n.created_at)}</p>
                </div>
              ))}
              {can('users.notes') && (
                <div className="flex gap-2 pt-1">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
                  <button onClick={addNote} className="hcc-btn-cyan shrink-0"><StickyNote className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </Card>

          <Card title="Status history">
            <ul className="space-y-2">
              {u.statusHistory.map((s, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{String(s.from_status)} → <strong>{String(s.to_status)}</strong></span>
                  <span className="text-xs text-slate-500">{timeAgo(String(s.created_at))}</span>
                </li>
              ))}
              {u.statusHistory.length === 0 && <li className="text-xs text-slate-500">No changes recorded</li>}
            </ul>
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <div className="space-y-4">
          <Field label="Full name"><Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
          </div>
          <Field label="Country"><Input value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
          <Field label="Max order (limit)">
            <Input type="number" value={edit.limits.maxOrder ?? ''} onChange={(e) => setEdit({ ...edit, limits: { ...edit.limits, maxOrder: Number(e.target.value) } })} />
          </Field>
          <Field label="Max withdraw (limit)">
            <Input type="number" value={edit.limits.maxWithdraw ?? ''} onChange={(e) => setEdit({ ...edit, limits: { ...edit.limits, maxWithdraw: Number(e.target.value) } })} />
          </Field>
          <button onClick={saveEdit} className="hcc-btn-primary w-full">Save changes</button>
        </div>
      </Modal>

      {/* Balance modal */}
      <Modal open={balOpen} onClose={() => setBalOpen(false)} title="Adjust balance">
        <div className="space-y-4">
          <div className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500">Current balance</p>
            <p className="font-display text-2xl font-bold text-neon-cyan">{fmtMoney(u.balance)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setBal({ ...bal, type: 'add' })} className={`hcc-btn ${bal.type === 'add' ? 'bg-neon-green/20 text-neon-green ring-1 ring-inset ring-neon-green/40' : 'hcc-btn-ghost'}`}>
              <Plus className="h-4 w-4" /> Add
            </button>
            <button onClick={() => setBal({ ...bal, type: 'deduct' })} className={`hcc-btn ${bal.type === 'deduct' ? 'bg-neon-red/20 text-neon-red ring-1 ring-inset ring-neon-red/40' : 'hcc-btn-ghost'}`}>
              <Minus className="h-4 w-4" /> Deduct
            </button>
          </div>
          <Field label="Amount (USD)"><Input type="number" min={1} value={bal.amount} onChange={(e) => setBal({ ...bal, amount: Number(e.target.value) })} /></Field>
          <Field label="Reason"><Input value={bal.reason} onChange={(e) => setBal({ ...bal, reason: e.target.value })} placeholder="e.g. Manual credit, risk adjustment…" /></Field>
          <button onClick={adjustBalance} className={`w-full ${bal.type === 'add' ? 'hcc-btn-primary' : 'hcc-btn-danger'}`}>
            {bal.type === 'add' ? 'Add funds' : 'Deduct funds'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
