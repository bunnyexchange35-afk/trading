import { useEffect, useState } from 'react';
import { Plus, Trash2, BellRing, AlertTriangle, Info, Gift } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Input, Select, Textarea, Loading, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Toggle } from '../components/ui';

interface Popup { id: number; title: string; body: string; type: string; target: string; target_id: number | null; pages: string[]; frequency: string; enabled: number; created_at: string }

const TYPE_ICON: Record<string, React.ReactNode> = {
  warning: <AlertTriangle className="h-4 w-4 text-neon-amber" />,
  info: <Info className="h-4 w-4 text-neon-cyan" />,
  promo: <Gift className="h-4 w-4 text-neon-purple" />,
};

export default function Popups() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', type: 'info', target: 'all', frequency: 'once', pages: 'home,dashboard', enabled: false });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Popup[] }>('/popups')
      .then((r) => setPopups(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async (p: Popup) => {
    try {
      await api.post(`/popups/${p.id}/toggle`);
      toast.push('success', `Pop-up ${p.enabled ? 'disabled' : 'enabled'}`);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/popups/${id}`);
      toast.push('success', 'Pop-up deleted');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const create = async () => {
    try {
      await api.post('/popups', { ...form, pages: form.pages.split(',').map((p) => p.trim()).filter(Boolean), enabled: form.enabled });
      toast.push('success', 'Pop-up created');
      setOpen(false);
      setForm({ title: '', body: '', type: 'info', target: 'all', frequency: 'once', pages: 'home,dashboard', enabled: false });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Pop-up Manager"
        subtitle="Warning, info and promo pop-ups targeted to users, segments or everyone"
        actions={can('popups.manage') && (
          <button className="hcc-btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New pop-up</button>
        )}
      />

      {popups.length === 0 ? (
        <Empty label="No pop-ups yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {popups.map((p) => (
            <Card key={p.id} title={p.title} subtitle={`${p.type} · ${p.target} · ${p.frequency.replace('_', ' ')}`} actions={
              <div className="flex items-center gap-2">
                {TYPE_ICON[p.type]}
                {can('popups.manage') && <Toggle checked={!!p.enabled} onChange={() => toggle(p)} />}
                {can('popups.manage') && <button onClick={() => remove(p.id)} className="text-slate-600 hover:text-neon-red"><Trash2 className="h-4 w-4" /></button>}
              </div>
            }>
              <p className="text-sm text-slate-400">{p.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.pages.map((pg) => (
                  <span key={pg} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] text-slate-300">/{pg}</span>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs">
                <BellRing className="h-3.5 w-3.5 text-slate-500" />
                <span className={p.enabled ? 'text-neon-green' : 'text-slate-500'}>{p.enabled ? 'Live' : 'Disabled'}</span>
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New pop-up">
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Message"><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="promo">Promo</option>
              </Select>
            </Field>
            <Field label="Target">
              <Select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                <option value="all">All users</option>
                <option value="segment">Segment</option>
                <option value="single">Single user</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="once">Once</option>
                <option value="every_login">Every login</option>
                <option value="every_session">Every session</option>
              </Select>
            </Field>
            <Field label="Pages (comma separated)"><Input value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} /></Field>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-950/50 px-3 py-2">
            <span className="text-sm text-slate-300">Enabled on create</span>
            <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
          </label>
          <button onClick={create} className="hcc-btn-primary w-full">Create pop-up</button>
        </div>
      </Modal>
    </div>
  );
}
