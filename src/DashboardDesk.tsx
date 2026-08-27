import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, ArrowUpRight, ArrowDownRight, Bell, Coins, CreditCard, FileText,
  Gauge, Headphones, LayoutGrid, ListChecks, Loader2, Lock, RefreshCcw, Wallet as WalletIcon,
} from 'lucide-react';
import { useApp } from './app-context';
import { useMarket } from './market-context';
import {
  getCreditScoreHistory,
  getDocumentsCatalog,
  getNotifications,
  getSupportTickets,
  getTasks,
  listOrders,
  apiMessage,
} from './api';
import type { CreditHistoryPoint, StudentNotification, SupportTicket, TradeOrder } from './types';
import { money } from './data';

/** Personal money-flow chart built purely from backend transaction records. */
function MoneyFlowChart({ transactions }: { transactions: { id: string; title: string; amount: number; type: string; tone: string }[] }) {
  const rows = useMemo(() => transactions.slice(0, 12).reverse(), [transactions]);
  if (rows.length === 0) {
    return <div className="dash-flow-empty">No account movements yet — deposits and orders will chart here.</div>;
  }
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.amount)));
  const flowType = (type: string, tone: string) => {
    if (type === 'deposit') return 'flow-deposit';
    if (type === 'release') return 'flow-refund';
    if (type === 'withdrawal') return 'flow-debit';
    if (type === 'conversion' || type === 'reward') return 'flow-credit';
    if (type === 'trade') return tone === 'up' ? 'flow-credit' : 'flow-debit';
    return 'flow-neutral';
  };
  return (
    <div className="dash-flow" role="img" aria-label="Personal money flow from your recent backend transactions">
      {rows.map((row) => (
        <div className="dash-flow-col" key={row.id} title={`${row.title} — ${row.amount.toLocaleString('en-IN')}`}>
          <div className="dash-flow-bar-area">
            <i
              className={flowType(row.type, row.tone)}
              style={{ height: `${Math.max(6, (Math.abs(row.amount) / max) * 100)}%` }}
            />
          </div>
          <small>{row.title.split(' ').slice(0, 2).join(' ')}</small>
        </div>
      ))}
      <div className="dash-flow-legend">
        <span><i className="flow-deposit" /> Deposits</span>
        <span><i className="flow-credit" /> Credits / wins</span>
        <span><i className="flow-debit" /> Debits / losses</span>
        <span><i className="flow-refund" /> Refunds</span>
      </div>
    </div>
  );
}

/** Credit score history sparkline from /api/credit-score/history. */
function CreditSparkline({ history }: { history: CreditHistoryPoint[] }) {
  if (history.length < 2) return null;
  const points = [...history].reverse();
  const min = Math.min(...points.map((point) => point.score));
  const max = Math.max(...points.map((point) => point.score));
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 30 - ((point.score - min) / range) * 26;
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="credit-sparkline" aria-label="Credit score history">
      <path d={path} />
    </svg>
  );
}

export default function DashboardDesk() {
  const { user, refreshUser } = useApp();
  const { quotes, status: marketStatus } = useMarket();
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditHistoryPoint[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; type: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const results = await Promise.allSettled([
      listOrders(user.email),
      getNotifications(),
      getSupportTickets(),
      getCreditScoreHistory(),
      getDocumentsCatalog(),
    ]);
    if (results[0].status === 'fulfilled' && results[0].value.success && results[0].value.orders) {
      setOrders(results[0].value.orders);
    }
    if (results[1].status === 'fulfilled' && results[1].value.notifications) {
      setNotifications(results[1].value.notifications);
    }
    if (results[2].status === 'fulfilled' && results[2].value.tickets) {
      setTickets(results[2].value.tickets);
    }
    if (results[3].status === 'fulfilled' && results[3].value.history) {
      setCreditHistory(results[3].value.history);
    }
    if (results[4].status === 'fulfilled' && results[4].value.documents) {
      setDocuments(results[4].value.documents.slice(0, 4));
    }
    setRefreshing(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  if (!user) return null;

  const wallet = user.wallet;
  const openOrders = orders.filter((order) => order.status === 'open');
  const recentOrders = orders.filter((order) => order.status !== 'open').slice(0, 4);
  const credit = user.creditScore;
  const topMovers = [...quotes].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4);
  const openTickets = tickets.filter((ticket) => ticket.status !== 'closed' && ticket.status !== 'resolved');
  const fmtDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <section className="dash-desk section-pad">
      <div className="container">
        <div className="dash-heading">
          <div>
            <span className="eyebrow">Your desk</span>
            <h2>Welcome back, {user.name.split(' ')[0]} 👋</h2>
            <p>
              Everything below is your personal account data straight from the backend — balances, orders,
              tasks, credit and support.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-soft"
            onClick={async () => {
              setRefreshing(true);
              await Promise.allSettled([refreshUser(user.email), load()]);
              setRefreshing(false);
            }}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />} Refresh desk
          </button>
        </div>

        <div className="dash-grid">
          {/* Wallet summary */}
          <article className="dash-card dash-wallet">
            <header>
              <h3><WalletIcon size={15} /> Wallet summary</h3>
              <Link to="/wallet">Open wallet <ArrowRight size={12} /></Link>
            </header>
            <div className="dash-wallet-figures">
              <div>
                <small>Available</small>
                <strong>₹{wallet.realBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                {wallet.realUsdtBalance > 0 && <small>+₮{wallet.realUsdtBalance.toLocaleString('en-IN')}</small>}
              </div>
              <div>
                <small>Frozen</small>
                <strong className="text-amber">₹{wallet.frozenBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                {wallet.frozenUsdtBalance > 0 && <small>+₮{wallet.frozenUsdtBalance.toLocaleString('en-IN')}</small>}
              </div>
              <div>
                <small>Demo credits</small>
                <strong className="text-purple">{wallet.demoBalance.toLocaleString()}</strong>
              </div>
            </div>
          </article>

          {/* Credit score */}
          <article className="dash-card dash-credit">
            <header>
              <h3><Gauge size={15} /> Credit score</h3>
              <Link to="/profile">Details <ArrowRight size={12} /></Link>
            </header>
            {credit ? (
              <>
                <div className="dash-credit-figure">
                  <strong className={
                    credit.status === 'excellent' || credit.status === 'good' ? 'up'
                      : credit.status === 'fair' ? 'text-amber' : 'down'
                  }>{credit.score}</strong>
                  <span className={`credit-status credit-${credit.status}`}>{credit.status}</span>
                </div>
                <CreditSparkline history={creditHistory} />
                {credit.updatedAt && (
                  <small className="dash-muted">Updated {new Date(credit.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small>
                )}
              </>
            ) : (
              <p className="dash-muted">Credit score is provided by the backend and will appear here once available.</p>
            )}
          </article>

          {/* Active orders */}
          <article className="dash-card dash-orders">
            <header>
              <h3><Activity size={15} /> Active orders ({openOrders.length})</h3>
              <Link to="/orders">Order history <ArrowRight size={12} /></Link>
            </header>
            {openOrders.length === 0 ? (
              <p className="dash-muted">No active orders. <Link to="/instant-order">Place an order</Link>.</p>
            ) : (
              <ul className="dash-order-list">
                {openOrders.slice(0, 4).map((order) => (
                  <li key={order.id}>
                    <span className={`dash-side ${order.side}`}>
                      {order.side === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {order.symbol}
                    </span>
                    <b>{order.accountType === 'real' ? (order.currency === 'INR' ? '₹' : '₮') : ''}{order.amount.toLocaleString('en-IN')}</b>
                    <small>{order.settledPercent ?? order.payoutPercent}% · {order.durationSeconds}s</small>
                  </li>
                ))}
              </ul>
            )}
            {recentOrders.length > 0 && (
              <div className="dash-recent-orders">
                <small>Recent results</small>
                {recentOrders.map((order) => (
                  <span key={order.id} className={`dash-result ${order.status}`}>
                    {order.symbol} {order.status === 'won' ? 'WIN' : order.status === 'lost' ? 'LOSE' : 'CANCELLED'}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* Market overview */}
          <article className="dash-card dash-market">
            <header>
              <h3><LayoutGrid size={15} /> Market overview</h3>
              <span className={`data-status status-${marketStatus}`}>{marketStatus}</span>
            </header>
            <ul className="dash-market-list">
              {topMovers.map((quote) => (
                <li key={quote.symbol}>
                  <Link to={`/instant-order?asset=${quote.symbol}`}>
                    <b>{quote.symbol}</b>
                    <span>{money(quote.price)}</span>
                    <em className={quote.change >= 0 ? 'up' : 'down'}>
                      {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%
                    </em>
                  </Link>
                </li>
              ))}
            </ul>
            <small className="dash-muted">Quotes served by the backend feed — status shown exactly as reported.</small>
          </article>

          {/* Money flow */}
          <article className="dash-card dash-flow-card">
            <header>
              <h3><Coins size={15} /> Your money flow</h3>
              <Link to="/wallet#activity">Full activity <ArrowRight size={12} /></Link>
            </header>
            <MoneyFlowChart transactions={wallet.transactions} />
          </article>

          {/* Tasks */}
          <article className="dash-card dash-tasks">
            <header>
              <h3><ListChecks size={15} /> Tasks</h3>
              <Link to="/tasks">All tasks <ArrowRight size={12} /></Link>
            </header>
            <TaskSummaryInline />
          </article>

          {/* Notifications */}
          <article className="dash-card dash-notifications">
            <header>
              <h3><Bell size={15} /> Notifications</h3>
            </header>
            {notifications.length === 0 ? (
              <p className="dash-muted">Nothing new — order results and support replies land here.</p>
            ) : (
              <ul className="dash-notice-list">
                {notifications.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <b>{item.title}</b>
                    <small>{item.message}</small>
                    <em>{fmtDate(item.at)}</em>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* Support activity */}
          <article className="dash-card dash-support">
            <header>
              <h3><Headphones size={15} /> Support</h3>
              <Link to="/support">Open support <ArrowRight size={12} /></Link>
            </header>
            {tickets.length === 0 ? (
              <p className="dash-muted">No tickets yet. Withdrawal requests are handled here too.</p>
            ) : (
              <ul className="dash-ticket-list">
                {tickets.slice(0, 3).map((ticket) => (
                  <li key={ticket.id}>
                    <b>{ticket.subject}</b>
                    <span className={`ticket-status ts-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                    <small>{fmtDate(ticket.createdAt)}</small>
                  </li>
                ))}
              </ul>
            )}
            {openTickets.length > 0 && <small className="dash-muted">{openTickets.length} open request(s)</small>}
          </article>

          {/* Documents */}
          <article className="dash-card dash-documents">
            <header>
              <h3><FileText size={15} /> Documents</h3>
              <Link to="/profile#documents">All documents <ArrowRight size={12} /></Link>
            </header>
            {loading ? (
              <p className="dash-muted"><Loader2 size={13} className="spin" /> Loading document catalog…</p>
            ) : documents.length === 0 ? (
              <p className="dash-muted">The backend document catalog is not available yet.</p>
            ) : (
              <ul className="dash-doc-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <CreditCard size={13} /> {doc.title}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

/** Small inline task summary tile (fetches its own data from /api/tasks). */
function TaskSummaryInline() {
  const { user } = useApp();
  const [summary, setSummary] = useState<{ pending: number; inProgress: number; completed: number; overdue: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const body = await getTasks();
        if (active && body.summary) setSummary(body.summary);
      } catch (loadError) {
        if (active) setError(apiMessage(loadError));
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (error) return <p className="dash-muted">{error}</p>;
  if (!summary) return <p className="dash-muted"><Loader2 size={13} className="spin" /> Loading tasks…</p>;
  return (
    <div className="dash-task-pills">
      <span className="pill-pending">Pending <b>{summary.pending}</b></span>
      <span className="pill-progress">In progress <b>{summary.inProgress}</b></span>
      <span className="pill-completed">Completed <b>{summary.completed}</b></span>
      {summary.overdue > 0 && <span className="pill-overdue">Overdue <b>{summary.overdue}</b></span>}
    </div>
  );
}
