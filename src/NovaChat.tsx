import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { useApp } from './app-context';
import { apiMessage, getNovaStatus, sendNovaMessage, type NovaStatusResponse } from './api';
import type { NovaStatus } from './types';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
};

let messageId = 0;

const SUGGESTIONS = [
  'How is BTC doing right now?',
  'What is my frozen amount?',
  'Show my credit score',
  'Any open tasks for me?',
];

/**
 * NOVA copilot — floating assistant. Every answer is produced by the backend
 * (GET /api/nova/status, POST /api/nova/chat) from authoritative account and
 * market data; the frontend never invents values.
 */
export function NovaChat() {
  const { user, openAuth } = useApp();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<NovaStatus | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || statusChecked) return;
    let active = true;
    (async () => {
      try {
        const body: NovaStatusResponse = await getNovaStatus();
        if (active && body.nova) setStatus(body.nova);
      } catch {
        if (active) setStatus({ online: false, assistant: 'NOVA', model: 'unavailable' });
      } finally {
        if (active) setStatusChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, statusChecked]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;
      if (!user) {
        openAuth('signin');
        return;
      }
      setInput('');
      setMessages((current) => [...current, { id: ++messageId, role: 'user', content: question }]);
      setSending(true);
      try {
        const body = await sendNovaMessage({
          message: question,
          history: messages.slice(-6).map((message) => ({ role: message.role, content: message.content })),
        });
        if (!body?.success || !body.reply) throw new Error(body?.error || 'NOVA could not answer right now.');
        setMessages((current) => [
          ...current,
          { id: ++messageId, role: 'assistant', content: body.reply!, sources: body.sources },
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          { id: ++messageId, role: 'assistant', content: apiMessage(error) },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, user, openAuth]
  );

  return (
    <>
      <button
        type="button"
        className={`nova-launcher ${open ? 'nova-hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Open NOVA copilot"
      >
        <Sparkles size={18} />
        <span>NOVA</span>
        {status && (
          <i className={`nova-dot ${status.online ? 'nova-online' : 'nova-offline'}`} title={status.online ? 'NOVA online' : 'NOVA unavailable'} />
        )}
      </button>

      {open && (
        <section className="nova-panel" aria-label="NOVA copilot">
          <header className="nova-header">
            <div>
              <strong>NOVA</strong>
              <small>
                {status == null
                  ? 'Connecting to backend…'
                  : status.online
                    ? `Online · ${status.model} · grounded on your backend data`
                    : 'Backend unavailable'}
              </small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close NOVA">
              <X size={16} />
            </button>
          </header>

          <div className="nova-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="nova-intro">
                <Sparkles size={20} />
                <p>
                  Hi{user ? ` ${user.name.split(' ')[0]}` : ''} — I&apos;m NOVA, your desk copilot. I answer from
                  your live backend data: markets &amp; analysis, wallet, orders, tasks, documents, support and
                  account details.
                </p>
                <div className="nova-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`nova-msg nova-${message.role}`}>
                <p>{message.content}</p>
                {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                  <small>source: {message.sources.join(', ')}</small>
                )}
              </div>
            ))}
            {sending && (
              <div className="nova-msg nova-assistant nova-typing">
                <Loader2 size={14} className="spin" /> NOVA is checking your backend data…
              </div>
            )}
          </div>

          <form
            className="nova-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={user ? 'Ask about markets, wallet, orders…' : 'Sign in to chat with NOVA'}
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send">
              <Send size={15} />
            </button>
          </form>
          <footer className="nova-footer">
            Answers are generated from backend data only — NOVA never quotes unconfirmed prices.
          </footer>
        </section>
      )}
    </>
  );
}
