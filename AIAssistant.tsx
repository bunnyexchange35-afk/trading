import { useEffect, useState } from 'react';
import { Bot, Send, CheckCircle2, Play, XCircle, Terminal, Sparkles } from 'lucide-react';
import { PageHeader, Card, Loading, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, timeAgo } from '../lib/format';

interface Action { module: string; action: string; target?: string; description: string; confidence: number }
interface Parsed { id: number; intent: string; summary: string; actions: Action[] }
interface HistoryRow { id: number; command: string; intent: string; status: string; result: string | null; created_at: string; suggested_actions: Action[] }

const EXAMPLES = [
  'Update homepage hero text',
  'Send warning email to users with negative balance',
  'Lock all users from country RU',
  'Create a global promo pop-up',
  'Generate a terms of service agreement',
];

export default function AIAssistant() {
  const [command, setCommand] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ description: string; ok: boolean; result: string }> | null>(null);
  const toast = useToast();
  const { can } = useAuth();

  const load = () => {
    api.get<{ data: HistoryRow[] }>('/ai')
      .then((r) => setHistory(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const parse = async () => {
    if (!command.trim()) return;
    setBusy(true);
    setResults(null);
    try {
      const r = await api.post<{ data: Parsed }>('/ai/command', { command });
      setParsed(r.data);
      toast.push('info', 'Command parsed — review before executing');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const r = await api.post<{ data: { results: Array<{ description: string; ok: boolean; result: string }> } }>(`/ai/${parsed.id}/execute`);
      setResults(r.data.results);
      toast.push('success', 'AI command executed');
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!parsed) return;
    try {
      await api.post(`/ai/${parsed.id}/cancel`);
      setParsed(null);
      setResults(null);
      load();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader title="AI Command Center" subtitle="Describe an action in plain English — the assistant parses, you confirm, it executes" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Command input */}
        <Card title="Command input" subtitle="Try one of the examples below">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Terminal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    parse();
                  }
                }}
                placeholder="e.g. Lock all users from country X"
                className="hcc-input min-h-[76px] pl-9"
              />
            </div>
            <button onClick={parse} disabled={busy || !can('ai.use')} className="hcc-btn-primary shrink-0 self-end !px-4">
              {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setCommand(ex)} className="rounded-full border border-ink-600 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-neon-purple/50 hover:text-neon-purple">
                {ex}
              </button>
            ))}
          </div>

          {parsed && (
            <div className="mt-4 rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-4 fade-up">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Sparkles className="h-4 w-4 text-neon-purple" /> {parsed.summary}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">intent: <span className="font-mono text-neon-cyan">{parsed.intent}</span></p>

              <div className="mt-3 space-y-2">
                {parsed.actions.map((a, i) => (
                  <div key={i} className="rounded-lg border border-ink-600 bg-ink-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-200">{a.description}</span>
                      <span className="ml-2 shrink-0 rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-bold text-neon-cyan">{Math.round(a.confidence * 100)}%</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{a.module}.{a.action}{a.target ? ` → ${a.target}` : ''}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                {can('ai.use') && (
                  <button onClick={execute} disabled={busy} className="hcc-btn-primary flex-1">
                    {busy ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />} Confirm & execute
                  </button>
                )}
                <button onClick={cancel} className="hcc-btn-danger"><XCircle className="h-4 w-4" /> Cancel</button>
              </div>

              {results && (
                <div className="mt-3 space-y-1.5">
                  {results.map((r, i) => (
                    <p key={i} className={`flex items-start gap-2 text-xs ${r.ok ? 'text-neon-green' : 'text-neon-red'}`}>
                      {r.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      <span>{r.result}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* History */}
        <Card title="Command history" subtitle={`${history.length} logged`}>
          <div className="divide-y divide-ink-700/70">
            {history.map((h) => (
              <div key={h.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 shrink-0 text-neon-purple" />
                  <p className="flex-1 text-sm text-slate-200">“{h.command}”</p>
                  <span className={badge(h.status)}>{h.status}</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-slate-500">
                  {h.intent} · {timeAgo(h.created_at)}
                  {h.result ? <span className="text-neon-green"> · executed ✓</span> : ''}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
