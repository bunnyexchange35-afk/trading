import { useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { PageHeader, Modal, Field, Input, Select, Textarea, Loading } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtMoney, timeAgo } from '../lib/format';
import type { Lead } from '../lib/types';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const STAGE_COLORS = ['#22ff9a', '#00e5ff', '#a855f7', '#ffb020', '#22ff9a', '#ff4d5e'];

interface StaffOpt { id: number; full_name: string; role: string }

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'organic', interest: '', region: '', value: 0, assigned_to: '' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Lead[] }>('/leads')
      .then((r) => setLeads(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    api.get<{ data: StaffOpt[] }>('/system/staff/options').then((r) => setStaff(r.data)).catch(() => undefined);
  }, []);

  const moveStage = async (id: number, stage: string) => {
    if (!can('leads.manage')) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      await api.patch(`/leads/${id}`, { stage });
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
      load();
    }
  };

  const assign = async (id: number, assigned_to: number | null) => {
    try {
      await api.patch(`/leads/${id}`, { assigned_to });
      load();
      toast.push('success', 'Lead assigned');
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const create = async () => {
    try {
      await api.post('/leads', { ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null, value: Number(form.value) });
      toast.push('success', 'Lead created');
      setOpen(false);
      setForm({ name: '', email: '', phone: '', source: 'organic', interest: '', region: '', value: 0, assigned_to: '' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/leads/${id}`);
      toast.push('success', 'Lead deleted');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Leads & Pipeline"
        subtitle="Drag-free pipeline — click a lead to advance its stage"
        actions={can('leads.manage') && (
          <button className="hcc-btn-primary" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> New lead
          </button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage, si) => {
          const items = leads.filter((l) => l.stage === stage);
          const total = items.reduce((a, l) => a + l.value, 0);
          return (
            <div key={stage} className="rounded-xl border border-ink-600/70 bg-ink-850/40 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: STAGE_COLORS[si] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[si] }} /> {stage}
                </span>
                <span className="text-[11px] text-slate-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <div key={l.id} className="group rounded-lg border border-ink-600/60 bg-ink-800/70 p-2.5 transition hover:border-ink-500">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-100">{l.name}</p>
                      {can('leads.manage') && (
                        <button onClick={() => remove(l.id)} className="text-slate-600 opacity-0 transition hover:text-neon-red group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{l.email ?? '—'} {l.region ? `· ${l.region}` : ''}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-xs text-neon-cyan">{fmtMoney(l.value, 0)}</span>
                      <span className="text-[10px] uppercase text-slate-500">{l.source}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Select
                        value={l.assigned_to ?? ''}
                        onChange={(e) => assign(l.id, e.target.value ? Number(e.target.value) : null)}
                        className="hcc-input !px-2 !py-1 text-[11px]"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </Select>
                    </div>
                    {can('leads.manage') && (
                      <div className="mt-2 flex gap-1">
                        {STAGES.filter((s) => s !== stage).map((s) => (
                          <button key={s} onClick={() => moveStage(l.id, s)} className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-slate-400 hover:border-neon-cyan/50 hover:text-neon-cyan" title={`Move to ${s}`}>
                            {s.slice(0, 1)}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 text-[10px] text-slate-600">updated {timeAgo(l.updated_at)}</p>
                  </div>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-[11px] text-slate-600">Empty</p>}
              </div>
              <p className="mt-2 px-1 text-[11px] text-slate-500">Σ {fmtMoney(total, 0)}</p>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New lead">
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="organic">Organic</option>
                <option value="ads">Ads</option>
                <option value="referral">Referral</option>
                <option value="social">Social</option>
              </Select>
            </Field>
            <Field label="Interest"><Input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="Crypto trading" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Region"><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="UK" /></Field>
            <Field label="Value (USD)"><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Assign to">
            <Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </Select>
          </Field>
          <button onClick={create} className="hcc-btn-primary w-full">Create lead</button>
        </div>
      </Modal>
    </div>
  );
}
