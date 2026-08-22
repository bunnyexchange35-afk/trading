import { useEffect, useState } from 'react';
import { Send, Mail, Plus } from 'lucide-react';
import { PageHeader, Card, Field, Input, Select, Textarea, TableShell, Loading, StatCard, Modal } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtNum, fmtDateTime, badge } from '../lib/format';

interface Template { id: number; name: string; category: string; subject: string; body: string }
interface Email { id: number; subject: string; template: string | null; audience: string; recipient_count: number; opens: number; clicks: number; sent_at: string; status: string }

export default function EmailCenter() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [totals, setTotals] = useState<{ sent: number; opens: number; clicks: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tplOpen, setTplOpen] = useState(false);
  const [tpl, setTpl] = useState({ name: '', category: 'promo', subject: '', body: '' });
  const [compose, setCompose] = useState({ subject: '', body: '', template: '', audience: 'all' });
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: Email[]; templates: Template[]; meta: { sent: number; opens: number; clicks: number } }>('/emails')
      .then((r) => {
        setEmails(r.data);
        setTemplates(r.templates);
        setTotals(r.meta);
      })
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => String(x.id) === id);
    if (t) setCompose((c) => ({ ...c, template: id, subject: t.subject, body: t.body }));
    else setCompose((c) => ({ ...c, template: id }));
  };

  const send = async () => {
    try {
      const r = await api.post<{ data: { recipients: number; simulated: boolean } }>('/emails/send', compose);
      toast.push('success', `Email sent to ${fmtNum(r.data.recipients)} recipient(s) ${r.data.simulated ? '(simulated)' : ''}`);
      setCompose({ subject: '', body: '', template: '', audience: 'all' });
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveTpl = async () => {
    try {
      await api.post('/emails/templates', tpl);
      toast.push('success', 'Template saved');
      setTplOpen(false);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Email Center"
        subtitle="Send to users, segments or everyone · track opens and clicks"
        actions={can('emails.send') && (
          <button className="hcc-btn-ghost" onClick={() => setTplOpen(true)}><Plus className="h-4 w-4" /> Template</button>
        )}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Emails sent" value={fmtNum(totals?.sent ?? 0)} tone="cyan" />
        <StatCard label="Opens" value={fmtNum(totals?.opens ?? 0)} tone="green" />
        <StatCard label="Clicks" value={fmtNum(totals?.clicks ?? 0)} tone="purple" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Compose */}
        <Card title="Compose" subtitle="Broadcast or targeted send">
          <div className="space-y-3">
            <Field label="Template">
              <Select value={compose.template} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Blank</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}
              </Select>
            </Field>
            <Field label="Subject"><Input value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /></Field>
            <Field label="Body"><Textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} /></Field>
            <Field label="Audience">
              <Select value={compose.audience} onChange={(e) => setCompose({ ...compose, audience: e.target.value })}>
                <option value="all">All users</option>
                <option value="segment">Target segment</option>
                <option value="single">Single user</option>
              </Select>
            </Field>
            {can('emails.send') ? (
              <button onClick={send} className="hcc-btn-primary w-full"><Send className="h-4 w-4" /> Send email</button>
            ) : (
              <p className="text-center text-xs text-slate-500">You don't have permission to send emails.</p>
            )}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          {/* Sent */}
          <Card title="Sent emails" subtitle="Delivery & engagement metrics">
            <TableShell>
              <thead className="bg-ink-850/80">
                <tr>
                  <th className="th">Subject</th>
                  <th className="th">Audience</th>
                  <th className="th text-right">Recipients</th>
                  <th className="th text-right">Opens</th>
                  <th className="th text-right">Clicks</th>
                  <th className="th">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-ink-800/40">
                    <td className="td flex items-center gap-2 text-slate-200"><Mail className="h-3.5 w-3.5 text-neon-cyan" /> {e.subject}</td>
                    <td className="td"><span className={badge(e.audience)}>{e.audience}</span></td>
                    <td className="td text-right font-mono text-xs">{fmtNum(e.recipient_count)}</td>
                    <td className="td text-right font-mono text-xs text-neon-green">{fmtNum(e.opens)}</td>
                    <td className="td text-right font-mono text-xs text-neon-purple">{fmtNum(e.clicks)}</td>
                    <td className="td text-xs text-slate-500">{fmtDateTime(e.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Card>

          {/* Templates */}
          <Card title="Templates" subtitle="Welcome, warning, promo & agreement">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <div key={t.id} className="rounded-lg border border-ink-600/70 bg-ink-950/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-100">{t.name}</p>
                    <span className={badge(t.category)}>{t.category}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.subject}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-slate-400">{t.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title="New template">
        <div className="space-y-4">
          <Field label="Name"><Input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={tpl.category} onChange={(e) => setTpl({ ...tpl, category: e.target.value })}>
              <option value="welcome">Welcome</option>
              <option value="warning">Warning</option>
              <option value="promo">Promo</option>
              <option value="agreement">Agreement</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Subject"><Input value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} /></Field>
          <Field label="Body"><Textarea value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} /></Field>
          <button onClick={saveTpl} className="hcc-btn-primary w-full">Save template</button>
        </div>
      </Modal>
    </div>
  );
}
