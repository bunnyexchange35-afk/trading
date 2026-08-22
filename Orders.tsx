import { useEffect, useState } from 'react';
import { Pencil, Trophy, XCircle, Circle, Radio } from 'lucide-react';
import { PageHeader, TableShell, Modal, Field, Input, Select, Loading, Empty, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtMoney, fmtDateTime, timeAgo } from '../lib/format';
import type { Order } from '../lib/types';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState({ asset: '', amount: 0, side: 'buy' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Order[] }>('/orders')
      .then((r) => setOrders(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const liveCount = orders.filter((o) => o.live).length;

  const setResult = async (id: number, result: string) => {
    setBusyId(id);
    try {
      await api.post(`/orders/${id}/result`, { result });
      toast.push('success', `Order result → ${result}`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (o: Order) => {
    setEditing(o);
    setForm({ asset: o.asset, amount: Number(o.amount), side: o.side });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.patch(`/orders/${editing.id}`, form);
      toast.push('success', 'Order updated');
      setEditOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        title="Orders Control"
        subtitle="Monitor, edit and settle orders · live orders pulse green"
        actions={
          <span className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-1.5 text-sm">
            <Radio className={`h-4 w-4 ${liveCount ? 'text-neon-green live-dot' : 'text-slate-500'}`} />
            <span className="text-slate-300">{liveCount} live</span>
          </span>
        }
      />

      {loading ? (
        <Loading />
      ) : orders.length === 0 ? (
        <Empty label="No orders yet" />
      ) : (
        <TableShell>
          <thead className="bg-ink-850/80">
            <tr>
              <th className="th">Order ID</th>
              <th className="th">User</th>
              <th className="th">Asset</th>
              <th className="th text-right">Amount</th>
              <th className="th">Side</th>
              <th className="th">Result</th>
              <th className="th">Time</th>
              <th className="th text-center">Live</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {orders.map((o) => (
              <tr key={o.id} className="transition hover:bg-ink-800/40">
                <td className="td font-mono text-xs text-slate-500">#{String(o.id).padStart(5, '0')}</td>
                <td className="td text-sm text-slate-200">{o.user_name ?? o.username ?? '—'}</td>
                <td className="td font-mono text-sm text-neon-purple">{o.asset}</td>
                <td className="td text-right font-mono text-sm">{fmtMoney(o.amount)}</td>
                <td className="td"><span className={`text-xs font-bold uppercase ${o.side === 'buy' ? 'text-neon-green' : 'text-neon-red'}`}>{o.side}</span></td>
                <td className="td"><span className={badge(o.result)}>{o.result}</span></td>
                <td className="td text-xs text-slate-500" title={fmtDateTime(o.created_at)}>{timeAgo(o.created_at)}</td>
                <td className="td text-center">
                  {o.live ? (
                    <span className="inline-block h-3 w-3 rounded-full bg-neon-green live-dot" title="Live order" />
                  ) : (
                    <Circle className="mx-auto h-3 w-3 text-slate-500" aria-label="No live order" />
                  )}
                </td>
                <td className="td">
                  <div className="flex items-center justify-end gap-1">
                    {can('orders.manage') && (
                      <>
                        <button title="Edit" onClick={() => openEdit(o)} className="rounded-md p-1.5 text-slate-400 hover:bg-ink-700 hover:text-neon-cyan">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button title="Mark won" onClick={() => setResult(o.id, 'win')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-green/10 hover:text-neon-green">
                          {busyId === o.id ? <Spinner className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                        </button>
                        <button title="Mark lost" onClick={() => setResult(o.id, 'lose')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-red/10 hover:text-neon-red">
                          <XCircle className="h-4 w-4" />
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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit order #${editing?.id}`}>
        <div className="space-y-4">
          <Field label="Asset"><Input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} /></Field>
          <Field label="Amount (USD)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Side">
            <Select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </Select>
          </Field>
          <button onClick={saveEdit} className="hcc-btn-primary w-full">Save order</button>
        </div>
      </Modal>
    </div>
  );
}
