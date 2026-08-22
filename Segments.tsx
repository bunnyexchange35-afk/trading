import { useEffect, useState } from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Input, Textarea, Loading, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';

interface Segment { id: number; name: string; description: string | null; criteria: Record<string, unknown> }

export default function Segments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', criteriaText: '{}' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Segment[] }>('/segments')
      .then((r) => setSegments(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    try {
      let criteria: unknown = {};
      try {
        criteria = JSON.parse(form.criteriaText);
      } catch {
        toast.push('error', 'Criteria must be valid JSON');
        return;
      }
      await api.post('/segments', { name: form.name, description: form.description, criteria });
      toast.push('success', 'Segment created');
      setOpen(false);
      setForm({ name: '', description: '', criteriaText: '{}' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/segments/${id}`);
      toast.push('success', 'Segment deleted');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Segmentation"
        subtitle="Tag leads and users by source, interest, region and activity for targeted campaigns"
        actions={can('segments.manage') && (
          <button className="hcc-btn-primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New segment
          </button>
        )}
      />

      {segments.length === 0 ? (
        <Empty label="No segments yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((s) => (
            <Card key={s.id} title={s.name} subtitle={s.description ?? undefined} actions={can('segments.manage') && (
              <button onClick={() => remove(s.id)} className="text-slate-600 hover:text-neon-red"><Trash2 className="h-4 w-4" /></button>
            )}>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" /> Criteria
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-neon-cyan">
                {JSON.stringify(s.criteria, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New segment">
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EU high-value traders" /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Criteria (JSON)">
            <Textarea value={form.criteriaText} onChange={(e) => setForm({ ...form, criteriaText: e.target.value })} className="font-mono text-xs" placeholder='{"region":{"in":["DE","FR"]}}' />
          </Field>
          <button onClick={create} className="hcc-btn-primary w-full">Create segment</button>
        </div>
      </Modal>
    </div>
  );
}
