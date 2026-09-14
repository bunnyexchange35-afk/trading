/**
 * NOVA assistant.
 *
 * `GET /api/nova/status` reports `model: 'gemini'` only when the server has a
 * GEMINI_API_KEY; otherwise it is `'nova-rulepack'` — a grounded rule-based
 * responder. The UI reads that status and never presents NOVA as a general
 * LLM. Suggested prompts are limited to the `topics` the backend advertises.
 *
 * NOVA has no endpoint that mutates trading or wallet state, so it cannot place
 * orders or move funds — and this UI does not pretend otherwise.
 */

import { useEffect, useRef, useState } from 'react';
import { Bot, RefreshCw, Send, Sparkles, User } from 'lucide-react';
import { askNova, getNovaStatus } from '../../api';
import { errorMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, Textarea } from '../../components/ui';
import { whenLabel } from '../../utils/format';

type Message = { role: 'user' | 'nova'; text: string; sources?: string[]; at: number };

export default function NovaPage() {
  const status = useAsync(() => getNovaStatus().then((r) => r.nova), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const nova = status.data;
  const isRulepack = nova?.model === 'nova-rulepack';
  const topics = nova?.topics ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: message, at: Date.now() }]);
    setDraft('');
    try {
      const response = await askNova(message);
      setMessages((prev) => [
        ...prev,
        { role: 'nova', text: response.reply, sources: response.sources, at: Date.now() },
      ]);
    } catch (err) {
      // 422 on an empty message; anything else surfaces as an error.
      setError(errorMessage(err));
      setMessages((prev) => prev.slice(0, -1));
      setDraft(message);
    } finally {
      setBusy(false);
    }
  };

  if (status.unavailable) {
    return (
      <div className="page">
        <Head onRefresh={status.refresh} loading={status.loading} />
        <Card>
          <EmptyState icon={<Bot size={20} />} title="NOVA unavailable here" body="This deployment does not serve the NOVA API." />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <Head onRefresh={status.refresh} loading={status.loading} />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 290px' }}>
        <Card
          title={
            <span className="row-tight">
              <Sparkles size={16} className="gold" /> {nova?.assistant ?? 'NOVA'}
              {nova?.online ? <Badge tone="won">online</Badge> : <Badge tone="neutral">offline</Badge>}
            </span>
          }
          pad={false}
        >
          {isRulepack && (
            <div style={{ padding: 'var(--sp-4) var(--sp-5) 0' }}>
              <Alert tone="info" title="Rule-based assistant">
                The server has no AI key configured, so NOVA is answering from a grounded
                rule-pack built on your own account, market and order data. It is not a general
                chatbot and cannot place trades or move funds.
              </Alert>
            </div>
          )}

          <div ref={listRef} style={{ height: 460, overflowY: 'auto', padding: 'var(--sp-5)' }}>
            {messages.length === 0 && !busy && (
              <EmptyState
                icon={<Bot size={20} />}
                title="Ask NOVA about your desk"
                body={
                  topics.length
                    ? `Grounded in your account. Topics the backend advertises: ${topics.join(', ')}.`
                    : 'Grounded in your own account, markets and orders.'
                }
              />
            )}

            <div className="stack" style={{ gap: 'var(--sp-3)' }}>
              {messages.map((message, index) => (
                <div
                  key={`${message.at}-${index}`}
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-3)',
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                      background: message.role === 'user' ? 'var(--surface-raised)' : 'var(--brand-soft)',
                      border: `1px solid ${message.role === 'user' ? 'var(--line-soft)' : 'var(--brand-line)'}`,
                      color: message.role === 'user' ? 'var(--text-secondary)' : 'var(--gold-300)',
                    }}
                  >
                    {message.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                  </span>
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: 'var(--sp-3) var(--sp-4)',
                      borderRadius: 'var(--r-md)',
                      background: message.role === 'user' ? 'var(--surface-raised)' : 'var(--surface-sunken)',
                      border: '1px solid var(--line-hair)',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: 'var(--lh-body)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {message.text}
                    {message.sources && message.sources.length > 0 && (
                      <div className="xs faint" style={{ marginTop: 8 }}>
                        Sources: {message.sources.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="row-tight faint xs">
                  <Skeleton className="sk-line" style={{ width: 120, marginBottom: 0 }} />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ padding: '0 var(--sp-5) var(--sp-3)' }}>
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderTop: '1px solid var(--line-hair)' }}>
            {topics.length > 0 && messages.length === 0 && (
              <div className="chips" style={{ marginBottom: 'var(--sp-3)' }}>
                {topics.slice(0, 6).map((topic) => (
                  <button key={topic} type="button" className="chip" onClick={() => void send(topicPrompt(topic))}>
                    {topic}
                  </button>
                ))}
              </div>
            )}
            <form
              className="row"
              style={{ flexWrap: 'nowrap' }}
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              <Textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about your balance, orders, markets, tasks, documents or support…"
                aria-label="Message NOVA"
                style={{ minHeight: 42, resize: 'none' }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!draft.trim()}>
                {!busy && <Send size={15} />} Send
              </Button>
            </form>
          </div>
        </Card>

        <div className="stack">
          <Card title="Assistant status">
            {status.loading && !status.data ? (
              <Skeleton className="sk-block" />
            ) : nova ? (
              <div className="stack" style={{ gap: 'var(--sp-2)' }}>
                <div className="kv">
                  <span className="kv-key">Assistant</span>
                  <span className="kv-val">{nova.assistant}</span>
                </div>
                <div className="kv">
                  <span className="kv-key">Model</span>
                  <span className="kv-val mono xs">{nova.model}</span>
                </div>
                <div className="kv">
                  <span className="kv-key">Grounded</span>
                  <span className="kv-val">{nova.grounded ? 'yes' : 'no'}</span>
                </div>
                <div className="kv">
                  <span className="kv-key">Checked</span>
                  <span className="kv-val">{whenLabel(nova.at)}</span>
                </div>
                <div style={{ marginTop: 'var(--sp-2)' }}>
                  <span className="eyebrow">Allowed topics</span>
                  <div className="chips" style={{ marginTop: 6 }}>
                    {(nova.topics ?? []).map((topic) => (
                      <span key={topic} className="chip">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={<Bot size={18} />} title="Status unavailable" />
            )}
          </Card>

          <Card title="What NOVA cannot do">
            <ul className="stack" style={{ gap: 'var(--sp-2)' }}>
              {[
                'Place, cancel or settle an order',
                'Move funds, deposit or withdraw',
                'Override a credit score or account status',
                'Give investment advice or predict prices',
              ].map((line) => (
                <li key={line} className="xs muted" style={{ display: 'flex', gap: 6 }}>
                  <span className="down" aria-hidden="true">
                    ✕
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="xs faint" style={{ marginTop: 'var(--sp-3)' }}>
              Those actions have no NOVA endpoint. Use the relevant page — the backend is the only
              authority on your account.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Head({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Assistant</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          NOVA
        </h1>
        <p className="page-sub">
          A grounded assistant that answers from your own account, markets and orders.
        </p>
      </div>
      <Button variant="ghost" onClick={onRefresh}>
        <RefreshCw size={15} className={loading ? 'spin' : undefined} /> Recheck status
      </Button>
    </header>
  );
}

/** Turns an advertised topic into a question the rule-pack can answer. */
function topicPrompt(topic: string): string {
  const map: Record<string, string> = {
    markets: 'What are the markets doing right now?',
    'market analysis': 'Give me the technical analysis for BTC.',
    wallet: 'Summarise my wallet balances.',
    orders: 'How do my recent orders look?',
    tasks: 'Which tasks are still open for me?',
    documents: 'What documents can I download?',
    support: 'How do I contact support about a withdrawal?',
    account: 'What is my account status and credit score?',
  };
  return map[topic] ?? `Tell me about ${topic}.`;
}
