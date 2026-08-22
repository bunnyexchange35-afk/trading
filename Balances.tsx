import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wallet, Plus, Minus } from 'lucide-react';
import { PageHeader, TableShell, Modal, Field, Input, Loading, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtMoney, initials } from '../lib/format';
import type { User } from '../lib/types';

export default function Balances() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<User | null>(null);
  const [bal, setBal] = useState({ type: 'add', amount: 100, reason: '' });
  const toast = useToast();
  const { can } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    api.get<{ data: User[] }>('/users?status=all')
      .then((r) => setUsers(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = users.filter((u) => {
    const s = q.toLowerCase();
    return u.full_name.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s);
  });

  const openAdjust = (u: User) => {
    setActive(u);
    setBal({ type: 'add', amount: 100, reason: '' });
  };

  const submit = async () => {
    if (!active) return;
    try {
      const r = await api.post<{ data: { balance: number } }>(`/balances/${active.id}/adjust`, { ...bal, amount: Number(bal.amount) });
      toast.push('success', `${active.full_name} balance → ${fmtMoney(r.data.balance)}`);
      setActive(null);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const total = users.reduce((a, u) => a + u.balance, 0);

  return (
    <div className="fade-up">
      <PageHeader
        title="Balances"
        subtitle={`Total platform balance ${fmtMoney(total)} · click a user to add or deduct funds`}
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="hcc-input pl-9" />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty label="No users found" />
      ) : (
        <TableShell>
          <thead className="bg-ink-850/80">
            <tr>
              <th className="th">User</th>
              <th className="th">Status</th>
              <th className="th">Country</th>
              <th className="th text-right">Balance</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {filtered.map((u) => (
              <tr key={u.id} className="transition hover:bg-ink-800/40">
                <td className="td">
                  <button className="flex items-center gap-3 text-left" onClick={() => navigate(`/users/${u.id}`)}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-[11px] font-bold text-neon-cyan">{initials(u.full_name)}</span>
                    <span>
                      <span className="block text-sm font-medium text-slate-100">{u.full_name}</span>
                      <span className="block text-xs text-slate-500">@{u.username}</span>
                    </span>
                  </button>
                </td>
                <td className="td"><span className={badge(u.status)}>{u.status}</span></td>
                <td className="td text-xs">{u.country ?? '—'}</td>
                <td className="td text-right font-mono text-sm text-neon-cyan">{fmtMoney(u.balance)}</td>
                <td className="td text-right">
                  {can('balances.manage') && (
                    <button onClick={() => openAdjust(u)} className="hcc-btn-ghost text-xs">
                      <Wallet className="h-4 w-4" /> Adjust
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={active ? `Adjust balance — ${active.full_name}` : 'Adjust balance'}>
        {active && (
          <div className="space-y-4">
            <div className="rounded-lg border border-ink-600 bg-ink-950/60 p-3 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-500">Current balance</p>
              <p className="font-display text-2xl font-bold text-neon-cyan">{fmtMoney(active.balance)}</p>
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
            <Field label="Reason"><Input value={bal.reason} onChange={(e) => setBal({ ...bal, reason: e.target.value })} placeholder="Reason for this change…" /></Field>
            <button onClick={submit} className={`w-full ${bal.type === 'add' ? 'hcc-btn-primary' : 'hcc-btn-danger'}`}>
              Confirm {bal.type === 'add' ? 'credit' : 'debit'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
