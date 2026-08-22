import { useEffect, useState } from 'react';
import { Plus, Sparkles, Save, Send, FileText, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Input, Select, Textarea, Loading, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, fmtDateTime, timeAgo } from '../lib/format';

interface Agreement { id: number; title: string; type: string; status: string; generated_by_ai: number; send_count: number; accepted_count: number; updated_at: string }
interface AgreementDetail extends Agreement { body: string; sends: Array<{ id: number; user_name: string; channel: string; status: string; sent_at: string; accepted_at: string | null }> }

export default function Agreements() {
  const [list, setList] = useState<Agreement[]>([]);
  const [active, setActive] = useState<AgreementDetail | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ title: '', type: 'terms' });
  const [sendOpen, setSendOpen] = useState(false);
  const [send, setSend] = useState({ channel: 'email', audience: 'all' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Agreement[] }>('/agreements')
      .then((r) => {
        setList(r.data);
        if (r.data[0]) openDetail(r.data[0].id);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = (id: number) => {
    api.get<{ data: AgreementDetail }>(`/agreements/${id}`)
      .then((r) => {
        setActive(r.data);
        setBody(r.data.body);
      })
      .catch((e) => toast.push('error', e.message));
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await api.patch(`/agreements/${active.id}`, { body });
      toast.push('success', 'Agreement saved');
      openDetail(active.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ data: { id: number } }>('/agreements/generate', gen);
      toast.push('success', 'AI draft generated');
      setGenOpen(false);
      load();
      openDetail(r.data.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const doSend = async () => {
    if (!active) return;
    try {
      const r = await api.post<{ data: { recipients: number } }>(`/agreements/${active.id}/send`, send);
      toast.push('success', `Sent to ${r.data.recipients} recipient(s) via ${send.channel}`);
      setSendOpen(false);
      openDetail(active.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const accept = async (sendId: number) => {
    try {
      await api.post(`/agreements/sends/${sendId}/accept`);
      toast.push('success', 'Marked accepted');
      if (active) openDetail(active.id);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading && !active) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Agreements & Document Automation"
        subtitle="AI-generated terms, contracts and disclaimers · track who accepted"
        actions={can('agreements.manage') && (
          <button className="hcc-btn-primary" onClick={() => setGenOpen(true)}><Sparkles className="h-4 w-4" /> Generate with AI</button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* List */}
        <Card title="Documents" className="xl:col-span-1">
          <div className="space-y-1.5">
            {list.map((a) => (
              <button key={a.id} onClick={() => openDetail(a.id)} className={`w-full rounded-lg px-3 py-2.5 text-left transition ${active?.id === a.id ? 'bg-neon-green/10 ring-1 ring-inset ring-neon-green/30' : 'hover:bg-ink-800'}`}>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-neon-cyan" />
                  <span className="flex-1 truncate text-sm text-slate-100">{a.title}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className={badge(a.type)}>{a.type}</span>
                  <span className={badge(a.status)}>{a.status}</span>
                  <span className="ml-auto text-slate-500">{a.accepted_count}/{a.send_count} accepted</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Editor */}
        <div className="space-y-4 xl:col-span-3">
          {active ? (
            <>
              <Card
                title={active.title}
                subtitle={`${active.type} · ${active.generated_by_ai ? 'AI generated' : 'manual'} · updated ${timeAgo(active.updated_at)}`}
                actions={can('agreements.manage') && (
                  <>
                    <button className="hcc-btn-ghost text-xs" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Save</button>
                    <button className="hcc-btn-cyan text-xs" onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Send</button>
                  </>
                )}
              >
                {can('agreements.manage') ? (
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} className="hcc-input min-h-[280px] font-mono text-sm leading-relaxed" />
                ) : (
                  <pre className="min-h-[280px] whitespace-pre-wrap rounded-lg border border-ink-600 bg-ink-950/60 p-4 font-mono text-sm text-slate-300">{body}</pre>
                )}
              </Card>

              <Card title="Distribution & acceptance" subtitle="Who received and accepted this document">
                <div className="divide-y divide-ink-700/70">
                  {active.sends.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="flex-1 text-slate-200">{s.user_name}</span>
                      <span className={badge(s.channel)}>{s.channel}</span>
                      <span className={badge(s.status)}>{s.status}</span>
                      <span className="text-xs text-slate-500">{fmtDateTime(s.sent_at)}</span>
                      {s.status !== 'accepted' && can('agreements.manage') && (
                        <button onClick={() => accept(s.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-neon-green/10 hover:text-neon-green"><CheckCircle2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                  {active.sends.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Not sent to anyone yet</p>}
                </div>
              </Card>
            </>
          ) : (
            <Card title="Select a document">
              <p className="py-10 text-center text-sm text-slate-500">Choose a document from the list to edit it.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Generate modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate with AI">
        <div className="space-y-4">
          <Field label="Title"><Input value={gen.title} onChange={(e) => setGen({ ...gen, title: e.target.value })} placeholder="e.g. Terms of Service (2026)" /></Field>
          <Field label="Type">
            <Select value={gen.type} onChange={(e) => setGen({ ...gen, type: e.target.value })}>
              <option value="terms">Terms</option>
              <option value="contract">Contract</option>
              <option value="disclaimer">Disclaimer</option>
            </Select>
          </Field>
          <button onClick={generate} disabled={saving} className="hcc-btn-purple w-full"><Sparkles className="h-4 w-4" /> {saving ? 'Generating…' : 'Generate draft'}</button>
        </div>
      </Modal>

      {/* Send modal */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Send agreement">
        <div className="space-y-4">
          <Field label="Channel">
            <Select value={send.channel} onChange={(e) => setSend({ ...send, channel: e.target.value })}>
              <option value="email">Email</option>
              <option value="chat">Chat</option>
              <option value="social">Social</option>
            </Select>
          </Field>
          <Field label="Audience">
            <Select value={send.audience} onChange={(e) => setSend({ ...send, audience: e.target.value })}>
              <option value="all">All users</option>
              <option value="segment">Segment</option>
            </Select>
          </Field>
          <button onClick={doSend} className="hcc-btn-cyan w-full"><Send className="h-4 w-4" /> Send now</button>
        </div>
      </Modal>
    </div>
  );
}
