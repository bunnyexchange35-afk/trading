import { useEffect, useState } from 'react';
import { Send, Sparkles, Bot, UserRound, Headset } from 'lucide-react';
import { PageHeader, Loading, Empty, Select } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { badge, timeAgo } from '../lib/format';

interface ChatRow { id: number; user_id: number; user_name: string; username: string; country: string; status: string; mode: string; last_message: string | null }
interface Msg { id: number; sender: string; body: string; created_at: string }
interface ChatDetail extends ChatRow { messages: Msg[] }

export default function Chat() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [active, setActive] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { can } = useAuth();

  const loadChats = () => {
    api.get<{ data: ChatRow[] }>('/chats')
      .then((r) => setChats(r.data))
      .catch((e) => toast.push('error', e.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadChats, []);

  const openChat = (id: number) => {
    api.get<{ data: ChatDetail }>(`/chats/${id}`)
      .then((r) => setActive(r.data))
      .catch((e) => toast.push('error', e.message));
  };

  const send = async () => {
    if (!active || !draft.trim()) return;
    setBusy(true);
    try {
      await api.post(`/chats/${active.id}/messages`, { body: draft });
      setDraft('');
      await openChat(active.id);
      loadChats();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const aiDraft = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/chats/${active.id}/ai`);
      await openChat(active.id);
      toast.push('success', 'AI reply generated');
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const setMode = async (mode: string) => {
    if (!active) return;
    try {
      await api.post(`/chats/${active.id}/mode`, { mode });
      await openChat(active.id);
      toast.push('success', `Mode → ${mode}`);
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    try {
      await api.post(`/chats/${active.id}/status`, { status });
      await openChat(active.id);
      loadChats();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="fade-up">
      <PageHeader title="Chat Support" subtitle="Live support with Manual, AI and Hybrid modes" />

      <div className="glass grid grid-cols-1 overflow-hidden lg:grid-cols-3" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
        {/* Chat list */}
        <div className="border-r border-ink-600/70 lg:col-span-1">
          <div className="border-b border-ink-600/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{chats.length} conversations</p>
          </div>
          <div className="h-full overflow-y-auto">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                className={`block w-full border-b border-ink-700/50 px-4 py-3 text-left transition hover:bg-ink-800/50 ${active?.id === c.id ? 'bg-ink-800/70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">{c.user_name ?? c.username}</span>
                  <span className={badge(c.status)}>{c.status}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-500">{c.last_message ?? 'No messages'}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                  <span className={c.mode === 'ai' ? 'text-neon-purple' : c.mode === 'hybrid' ? 'text-neon-cyan' : 'text-slate-500'}>
                    {c.mode.toUpperCase()}
                  </span>
                  {c.country && <span>· {c.country}</span>}
                </div>
              </button>
            ))}
            {chats.length === 0 && <Empty label="No chats" />}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex flex-col lg:col-span-2">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Select a conversation</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-ink-600/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Headset className="h-4 w-4 text-neon-cyan" />
                  <span className="text-sm font-semibold text-slate-100">{active.user_name ?? active.username}</span>
                  <span className="text-xs text-slate-500">@{active.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={active.mode} onChange={(e) => setMode(e.target.value)} className="!w-auto !py-1 text-xs">
                    <option value="manual">Manual</option>
                    <option value="ai">AI</option>
                    <option value="hybrid">Hybrid</option>
                  </Select>
                  {active.status !== 'closed' ? (
                    <button onClick={() => setStatus('closed')} className="hcc-btn-ghost !py-1 text-xs">Close</button>
                  ) : (
                    <button onClick={() => setStatus('active')} className="hcc-btn-ghost !py-1 text-xs">Reopen</button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.messages.map((m) => {
                  const mine = m.sender === 'admin';
                  const isAi = m.sender === 'ai';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${mine ? 'bg-neon-green/15 text-slate-100' : isAi ? 'bg-neon-purple/15 text-slate-100 ring-1 ring-inset ring-neon-purple/30' : 'bg-ink-800 text-slate-200'}`}>
                        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                          {isAi ? <><Bot className="h-3 w-3" /> AI</> : mine ? <Headset className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                          {mine ? 'You' : isAi ? '' : active.user_name}
                        </p>
                        {m.body}
                        <p className="mt-1 text-right text-[10px] opacity-50">{timeAgo(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-ink-600/70 p-3">
                <div className="flex items-center gap-2">
                  <button onClick={aiDraft} disabled={busy} title="Generate AI reply" className="hcc-btn-ghost shrink-0 !px-3">
                    <Sparkles className="h-4 w-4 text-neon-purple" />
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder={can('chats.manage') ? 'Type a reply…' : 'Read only (no permission)'}
                    className="hcc-input flex-1"
                  />
                  <button onClick={send} disabled={busy || !can('chats.manage')} className="hcc-btn-primary shrink-0 !px-3">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
