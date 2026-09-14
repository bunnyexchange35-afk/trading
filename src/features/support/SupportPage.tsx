/**
 * Support.
 *
 * Audit F7: `POST /api/support/tickets` creates a ticket with
 * `status: 'open'`, `response: null`, and NO endpoint ever writes a reply or
 * changes the status. There is no reply API. So this page:
 *   - builds the category picker from the backend's own `categories` allowlist
 *     (an invalid category is rejected with 422)
 *   - renders `response` when it is present, and otherwise shows an honest
 *     "awaiting the support team" state
 *   - offers NO reply composer and NO status changer, because either would be
 *     fiction
 *
 * Withdrawal escalation goes through `/api/withdrawal/support`, which files a
 * `Withdrawal` ticket — surfaced here as a shortcut and handled in Wallet.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Hourglass, LifeBuoy, Loader2, Plus, RefreshCw, Ticket } from 'lucide-react';
import { createSupportTicket, getSupportTickets, requestWithdrawal } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync } from '../../hooks/useAsync';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Stat,
  Textarea,
  statusTone,
} from '../../components/ui';
import { whenLabel } from '../../utils/format';

export default function SupportPage() {
  const { wallet } = useSession();
  const tickets = useAsync(() => getSupportTickets(), []);
  const [composerOpen, setComposerOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const list = tickets.data?.tickets ?? [];
  const categories = tickets.data?.categories ?? [];

  const stats = useMemo(
    () => ({
      total: list.length,
      open: list.filter((t) => t.status === 'open').length,
      answered: list.filter((t) => Boolean(t.response)).length,
    }),
    [list],
  );

  const active = list.find((t) => t.id === selected) ?? null;

  if (tickets.unavailable) {
    return (
      <div className="page">
        <Head onRefresh={tickets.refresh} loading={tickets.loading} onNew={() => setComposerOpen(true)} />
        <Card>
          <EmptyState
            icon={<LifeBuoy size={20} />}
            title="Support unavailable here"
            body="This deployment does not serve the support API."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <Head onRefresh={tickets.refresh} loading={tickets.loading} onNew={() => setComposerOpen(true)} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Tickets" value={stats.total} small />
        <Stat label="Open" value={stats.open} small />
        <Stat label="Answered" value={stats.answered} foot="Backend has not replied to the rest" small />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)' }}>
        <Card
          title={<span className="row-tight"><Ticket size={16} className="gold" /> Your tickets</span>}
          pad={false}
        >
          {tickets.loading && !tickets.data && (
            <div style={{ padding: 'var(--sp-5)' }}>
              <Skeleton className="sk-block" />
            </div>
          )}
          {!tickets.loading && list.length === 0 && (
            <EmptyState
              icon={<LifeBuoy size={20} />}
              title="No tickets yet"
              body="Raise a request and the support team will pick it up. Withdrawal requests also land here."
              action={
                <Button variant="outline" size="sm" onClick={() => setComposerOpen(true)}>
                  <Plus size={13} /> New ticket
                </Button>
              }
            />
          )}
          {list.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelected(ticket.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-4) var(--sp-5)',
                borderBottom: '1px solid var(--line-hair)',
                background: selected === ticket.id ? 'rgba(255,255,255,.03)' : 'transparent',
              }}
            >
              <div className="row-tight spread">
                <strong className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ticket.subject}
                </strong>
                <Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge>
              </div>
              <div className="xs faint" style={{ marginTop: 4 }}>
                <code className="mono">{ticket.id}</code> · {ticket.category} · {whenLabel(ticket.createdAt)}
                {ticket.response ? ' · replied' : ' · awaiting reply'}
              </div>
            </button>
          ))}
        </Card>

        <Card title="Ticket detail">
          {!active && (
            <EmptyState icon={<Ticket size={20} />} title="Select a ticket" body="Choose a ticket from the list to read its full request and any support response." />
          )}
          {active && (
            <div className="stack">
              <div className="row-tight spread">
                <div>
                  <h3 className="card-title">{active.subject}</h3>
                  <div className="xs faint" style={{ marginTop: 4 }}>
                    <code className="mono">{active.id}</code> · raised {whenLabel(active.createdAt)} ·
                    updated {whenLabel(active.updatedAt)}
                  </div>
                </div>
                <Badge tone={statusTone(active.status)}>{active.status}</Badge>
              </div>

              <div className="panel">
                <span className="eyebrow">Category</span>
                <p className="small" style={{ marginTop: 4 }}>
                  {active.category}
                </p>
              </div>

              <div className="panel">
                <span className="eyebrow">Your request</span>
                <p className="small muted" style={{ marginTop: 6, lineHeight: 'var(--lh-body)', whiteSpace: 'pre-wrap' }}>
                  {active.message}
                </p>
              </div>

              {active.request && (
                <div className="panel">
                  <span className="eyebrow">Withdrawal details</span>
                  {active.request.currency && (
                    <div className="kv">
                      <span className="kv-key">Currency</span>
                      <span className="kv-val">{active.request.currency}</span>
                    </div>
                  )}
                  {typeof active.request.amount === 'number' && (
                    <div className="kv">
                      <span className="kv-key">Amount</span>
                      <span className="kv-val num">
                        {active.request.currency === 'USDT'
                          ? `₮${active.request.amount.toLocaleString('en-US')}`
                          : `₹${active.request.amount.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {active.response ? (
                <div className="panel" style={{ borderColor: 'var(--up-line)', background: 'var(--up-soft)' }}>
                  <span className="eyebrow up">Support response</span>
                  <p className="small" style={{ marginTop: 6, lineHeight: 'var(--lh-body)', whiteSpace: 'pre-wrap' }}>
                    {active.response}
                  </p>
                </div>
              ) : (
                <Alert tone="info" title="Awaiting the support team">
                  <span className="row-tight" style={{ alignItems: 'flex-start' }}>
                    <Hourglass size={14} style={{ flex: 'none', marginTop: 2 }} />
                    <span>
                      No reply has been recorded on this ticket yet. This app cannot send follow-up
                      messages on a ticket — the backend exposes no reply endpoint — so please
                      include everything the team needs in a new ticket if this one is incomplete.
                    </span>
                  </span>
                </Alert>
              )}

              <div className="row">
                <Button variant="ghost" size="sm" onClick={() => setComposerOpen(true)}>
                  <Plus size={13} /> Raise another
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWithdrawOpen(true)}>
                  <LifeBuoy size={13} /> Withdrawal request
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <TicketComposer
        open={composerOpen}
        categories={categories}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          tickets.refresh();
          setSelected(null);
        }}
      />

      <WithdrawComposer
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onCreated={() => tickets.refresh()}
        availableInr={wallet?.realBalance ?? 0}
        availableUsdt={wallet?.realUsdtBalance ?? 0}
      />
    </div>
  );
}

function Head({
  onRefresh,
  loading,
  onNew,
}: {
  onRefresh: () => void;
  loading: boolean;
  onNew: () => void;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">Support</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          Support tickets
        </h1>
        <p className="page-sub">
          Raise a request by category. Withdrawal reviews are handled here rather than paid out
          automatically.
        </p>
      </div>
      <div className="row">
        <Button variant="ghost" onClick={onRefresh}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} /> Refresh
        </Button>
        <Button variant="primary" onClick={onNew}>
          <Plus size={15} /> New ticket
        </Button>
      </div>
    </header>
  );
}

function TicketComposer({
  open,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the first category the backend allows.
  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0]);
  }, [categories, category]);

  const submit = async () => {
    setError(null);
    if (!category) {
      setError('Choose a category.');
      return;
    }
    if (!message.trim()) {
      setError('Describe your request so support can help.');
      return;
    }
    setBusy(true);
    try {
      await createSupportTicket({ category, subject: subject.trim(), message: message.trim() });
      setMessage('');
      setSubject('');
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="New support ticket">
      <div className="stack">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Category" required hint="Only categories the backend accepts are listed.">
          {({ id }) => (
            <div className="chips" id={id}>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${category === c ? 'chip-active' : ''}`}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                >
                  {c}
                </button>
              ))}
              {categories.length === 0 && <span className="xs faint">Categories unavailable</span>}
            </div>
          )}
        </Field>

        <Field label="Subject" hint="Optional — defaults to the category.">
          {({ id }) => (
            <Input
              id={id}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Short summary"
            />
          )}
        </Field>

        <Field label="How can we help?" required hint="Up to 2000 characters.">
          {({ id }) => (
            <Textarea
              id={id}
              rows={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include order ids, amounts and dates so the team can act on it."
            />
          )}
        </Field>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {!busy && <CheckCircle2 size={15} />} Create ticket
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function WithdrawComposer({
  open,
  onClose,
  onCreated,
  availableInr,
  availableUsdt,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableInr: number;
  availableUsdt: number;
}) {
  const [currency, setCurrency] = useState<'INR' | 'USDT'>('INR');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const available = currency === 'USDT' ? availableUsdt : availableInr;
  const numeric = Number(amount || 0);

  const submit = async () => {
    setError(null);
    setDone(null);
    if (amount.trim() && (!Number.isFinite(numeric) || numeric <= 0)) {
      setError('Enter a positive amount, or leave it blank for a general review request.');
      return;
    }
    if (amount.trim() && numeric > available) {
      setError(`That exceeds your available ${currency} balance.`);
      return;
    }
    setBusy(true);
    try {
      const response = await requestWithdrawal({
        currency,
        ...(amount.trim() ? { amount: numeric } : {}),
        note: note.trim() || undefined,
      });
      setDone(`${response.ticket.id} created.`);
      setAmount('');
      setNote('');
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Withdrawal review request">
      <div className="stack">
        {error && <Alert tone="error">{error}</Alert>}
        {done && <Alert tone="success" title="Sent to support">{done}</Alert>}

        <Alert tone="info" title="This does not move your balance">
          A withdrawal request is reviewed by a person. The platform does not execute payouts
          automatically, and nothing is debited when you send this. You can also raise it from{' '}
          <Link to="/wallet" className="gold strong">
            Wallet → Withdraw
          </Link>
          .
        </Alert>

        <Field label="Currency">
          {({ id }) => (
            <div className="tabs" id={id} role="tablist" aria-label="Withdrawal currency">
              {(['INR', 'USDT'] as const).map((code) => (
                <button
                  key={code}
                  role="tab"
                  type="button"
                  aria-selected={currency === code}
                  className={`tab ${currency === code ? 'tab-active' : ''}`}
                  onClick={() => setCurrency(code)}
                >
                  {code === 'INR' ? `₹ INR · ${availableInr.toLocaleString('en-IN')}` : `₮ USDT · ${availableUsdt.toLocaleString('en-US')}`}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={`Amount (${currency})`} hint="Optional — leave blank to ask for a review first.">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={1}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              prefix={currency === 'USDT' ? '₮' : '₹'}
            />
          )}
        </Field>

        <Field label="Destination / note" hint="Bank account, UPI ID or wallet address.">
          {({ id }) => (
            <Textarea id={id} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {!busy ? <LifeBuoy size={15} /> : <Loader2 size={15} className="spin" />} Send request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
