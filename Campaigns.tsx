import { useEffect, useState } from 'react';
import { Plus, Play, Pause, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, TableShell, Modal, Field, Input, Select, StatCard, Loading, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtMoney, fmtNum, fmtPct } from '../lib/format';
import type { Campaign } from '../lib/types';

export default function Campaigns() {
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [totals, setTotals] = useState<{ spent: number; clicks: number; conv: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'email', status: 'draft', budget: 1000 });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Campaign[]; meta: { spent: number; clicks: number; conv: number } }>('/campaigns')
      .then((r) => {
        setCamps(r.data);
        setTotals(r.meta);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/campaigns/${id}`, { status });
      toast.push('success', `Campaign → ${status}`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/campaigns/${id}`);
      toast.push('success', 'Campaign deleted');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const create = async () => {
    try {
      await api.post('/campaigns', { ...form, budget: Number(form.budget) });
      toast.push('success', 'Campaign created');
      setOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Campaigns"
        subtitle="Create and track email, social and promo campaigns"
        actions={can('campaigns.manage') && (
          <button className="hcc-btn-primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </button>
        )}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Total spend" value={fmtMoney(totals?.spent ?? 0, 0)} tone="purple" />
        <StatCard label="Total clicks" value={fmtNum(totals?.clicks ?? 0)} tone="cyan" />
        <StatCard label="Conversions" value={fmtNum(totals?.conv ?? 0)} tone="green" />
      </div>

      {camps.length === 0 ? (
        <Empty label="No campaigns yet" />
      ) : (
        <TableShell>
          <thead className="bg-ink-850/80">
            <tr>
              <th className="th">Campaign</th>
              <th className="th">Type</th>
              <th className="th">Status</th>
              <th className="th text-right">Budget</th>
              <th className="th text-right">Spent</th>
              <th className="th text-right">Clicks</th>
              <th className="th text-right">Conv.</th>
              <th className="th text-right">ROI</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700/70">
            {camps.map((c) => (
              <tr key={c.id} className="transition hover:bg-ink-800/40">
                <td className="td font-medium text-slate-100">{c.name}</td>
                <td className="td text-xs uppercase text-slate-400">{c.type}</td>
                <td className="td"><span className={badge(c.status === 'active' ? 'active_campaign' : c.status)}>{c.status}</span></td>
                <td className="td text-right font-mono text-xs">{fmtMoney(c.budget, 0)}</td>
                <td className="td text-right font-mono text-xs text-neon-amber">{fmtMoney(c.spent, 0)}</td>
                <td className="td text-right font-mono text-xs">{fmtNum(c.clicks)}</td>
                <td className="td text-right font-mono text-xs">{fmtNum(c.conversions)}</td>
                <td className="td text-right font-mono text-xs text-neon-green">{fmtPct(c.roi)}</td>
                <td className="td">
                  {can('campaigns.manage') && (
                    <div className="flex items-center justify-end gap-1">
                      {c.status !== 'active' && (
                        <button title="Activate" onClick={() => setStatus(c.id, 'active')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-green/10 hover:text-neon-green"><Play className="h-4 w-4" /></button>
                      )}
                      {c.status === 'active' && (
                        <button title="Pause" onClick={() => setStatus(c.id, 'paused')} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-amber/10 hover:text-neon-amber"><Pause className="h-4 w-4" /></button>
                      )}
                      <button title="Delete" onClick={() => remove(c.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-red/10 hover:text-neon-red"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New campaign">
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="email">Email</option>
                <option value="social">Social</option>
                <option value="promo">Promo</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </Field>
          </div>
          <Field label="Budget (USD)"><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} /></Field>
          <button onClick={create} className="hcc-btn-primary w-full">Create campaign</button>
        </div>
      </Modal>
    </div>
  );
}
