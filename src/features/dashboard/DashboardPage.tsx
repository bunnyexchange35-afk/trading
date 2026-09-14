/**
 * Dashboard.
 *
 * Primary source is `GET /api/user/account` (auth-gated, Node-only), with the
 * wallet snapshot, order board, credit score and tasks alongside. Several of
 * these routes do not exist on the Worker deployment (audit F1), so each panel
 * degrades honestly instead of spinning forever or inventing numbers.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Coins,
  Layers,
  ListOrdered,
  Lock,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  getAccount,
  getCreditScore,
  getMarkets,
  getTasks,
  listOrders,
} from '../../api';
import { useSession } from '../../app/session';
import { useAsync, useCountdown } from '../../hooks/useAsync';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Meter,
  Skeleton,
  Stat,
  statusTone,
} from '../../components/ui';
import {
  countdown,
  dateLabel,
  durationLabel,
  money,
  price,
  signedPercent,
  whenLabel,
} from '../../utils/format';

export default function DashboardPage() {
  const { email, wallet, refreshWallet, user } = useSession();
  const ready = Boolean(email);

  const account = useAsync(() => getAccount().then((r) => r.account), [], { enabled: ready });
  const orders = useAsync(() => listOrders().then((r) => r.orders), [], {
    enabled: ready,
    intervalMs: 5000,
  });
  const credit = useAsync(() => getCreditScore().then((r) => r.creditScore), [], { enabled: ready });
  const tasks = useAsync(() => getTasks().then((r) => ({ tasks: r.tasks, summary: r.summary })), [], {
    enabled: ready,
  });
  const markets = useAsync(() => getMarkets().then((r) => r.data), []);

  // Fetching the order list is what triggers lazy settlement (F13); the response
  // also carries a wallet snapshot, so one poll refreshes both.
  const open = (orders.data ?? []).filter((o) => o.status === 'open');
  const recent = (orders.data ?? []).slice(0, 5);
  const account2 = account.data;
  const creditScore = credit.data?.score ?? account2?.creditScore?.score ?? null;
  const creditStatus = credit.data?.status ?? account2?.creditScore?.status ?? null;
  const category = credit.data?.category ?? account2?.category ?? null;
  const openTasks = tasks.data?.tasks.filter((t) => t.status !== 'completed') ?? [];

  const available = wallet?.realBalance ?? 0;
  const frozen = wallet?.frozenBalance ?? 0;
  const usdt = wallet?.realUsdtBalance ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {account2?.name ? `Hello, ${account2.name.split(' ')[0]}` : 'Your desk'}
          </h1>
          <p className="page-sub">
            {account2 ? (
              <>
                Account <strong className="mono">{account2.id}</strong> ·{' '}
                {account2.status} · member since {dateLabel(account2.createdAt)}
              </>
            ) : (
              'Live balances, orders and progress from your account.'
            )}
          </p>
        </div>
        <div className="row">
          {category && <Badge tone="brand">{category}</Badge>}
          <Link to="/trade">
            <Button variant="primary">
              <Layers size={15} /> Open trade desk
            </Button>
          </Link>
        </div>
      </header>

      {/* -------------------------------------------------------- balances */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
        <Stat
          label="Available (INR)"
          value={wallet ? money(available) : <Skeleton className="sk-line" style={{ width: 110 }} />}
          foot={`${wallet?.openOrders ?? 0} open order(s)`}
        />
        <Stat
          label="Frozen / locked"
          value={wallet ? money(frozen) : <Skeleton className="sk-line" style={{ width: 110 }} />}
          foot={`${wallet?.frozenItemsCount ?? 0} held item(s)`}
        />
        <Stat
          label="Available (USDT)"
          value={wallet ? `₮${usdt.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : <Skeleton className="sk-line" style={{ width: 90 }} />}
          foot={`Frozen ₮${(wallet?.frozenUsdtBalance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        />
        <Stat
          label="Demo credits"
          value={wallet ? wallet.demoBalance.toLocaleString('en-IN') : <Skeleton className="sk-line" style={{ width: 90 }} />}
          foot={wallet ? `${wallet.conversionRate} credit → INR rate` : undefined}
        />
      </div>

      {(wallet?.pendingAmount ?? 0) > 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Alert tone="warn" title="Deposit awaiting verification">
            {money(wallet!.pendingAmount)} is held in frozen funds pending manual review. It is
            not available to trade yet.
          </Alert>
        </div>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', marginTop: 'var(--sp-4)' }}
      >
        {/* ------------------------------------------------ active orders */}
        <Card
          title={
            <span className="row-tight">
              <ListOrdered size={16} className="gold" /> Active orders
            </span>
          }
          action={
            <Link to="/orders">
              <Button variant="ghost" size="sm">
                All orders <ArrowRight size={13} />
              </Button>
            </Link>
          }
        >
          {orders.loading && !orders.data && <Skeleton className="sk-block" />}
          {orders.unavailable && (
            <EmptyState
              icon={<ListOrdered size={20} />}
              title="Orders unavailable here"
              body="This deployment does not serve the order API."
            />
          )}
          {!orders.loading && !orders.unavailable && open.length === 0 && (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="No open orders"
              body="Place a directional order and it will settle automatically at expiry against the live price."
              action={
                <Link to="/trade">
                  <Button variant="outline" size="sm">
                    Go to trade desk
                  </Button>
                </Link>
              }
            />
          )}
          {open.slice(0, 4).map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </Card>

        {/* --------------------------------------------------- credit score */}
        <Card
          title={
            <span className="row-tight">
              <Star size={16} className="gold" /> Credit profile
            </span>
          }
          action={
            <Link to="/credit">
              <Button variant="ghost" size="sm">
                Details <ArrowRight size={13} />
              </Button>
            </Link>
          }
        >
          {credit.loading && !credit.data && <Skeleton className="sk-block" />}
          {credit.unavailable && (
            <EmptyState
              icon={<Star size={20} />}
              title="Not available here"
              body="Credit scoring is served by the primary backend only."
            />
          )}
          {creditScore !== null && (
            <>
              <div className="spread" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="stat-label">Score</div>
                  <div className="stat-value num" style={{ fontSize: 'var(--fs-4xl)' }}>
                    {creditScore}
                  </div>
                </div>
                <Badge tone={statusTone(creditStatus ?? '')}>{creditStatus ?? '—'}</Badge>
              </div>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                {/* 300–900 is the backend's clamp; the bar maps onto it. */}
                <Meter pct={((creditScore - 300) / 600) * 100} />
                <div className="spread xs faint" style={{ marginTop: 6 }}>
                  <span>300</span>
                  <span>600 fair</span>
                  <span>800 excellent</span>
                  <span>900</span>
                </div>
              </div>
              <p className="xs faint" style={{ marginTop: 'var(--sp-4)' }}>
                Computed by the backend from your settled orders, win rate, completed tasks,
                account age and verified deposits. It is never calculated in your browser.
              </p>
            </>
          )}
        </Card>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', marginTop: 'var(--sp-4)' }}
      >
        {/* ------------------------------------------------------ recent orders */}
        <Card title="Recent activity" pad={false}>
          {recent.length === 0 && !orders.loading && (
            <EmptyState icon={<ListOrdered size={20} />} title="No orders yet" />
          )}
          {recent.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Direction</th>
                    <th className="table-numeric">Stake</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.symbol}</strong>
                        <span className="faint xs" style={{ marginLeft: 6 }}>
                          {durationLabel(order.durationSeconds)}
                        </span>
                      </td>
                      <td>
                        <span className={order.side === 'up' ? 'up' : 'down'}>
                          {order.side === 'up' ? '▲ Up' : '▼ Down'}
                        </span>
                      </td>
                      <td className="table-numeric mono">
                        {money(order.amount, order.accountType === 'demo' ? 'CREDITS' : order.currency)}
                      </td>
                      <td>
                        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------------- tasks */}
        <Card
          title={
            <span className="row-tight">
              <Star size={16} className="gold" /> Tasks
            </span>
          }
          action={
            <Link to="/tasks">
              <Button variant="ghost" size="sm">
                All tasks <ArrowRight size={13} />
              </Button>
            </Link>
          }
        >
          {tasks.loading && !tasks.data && <Skeleton className="sk-block" />}
          {tasks.unavailable && (
            <EmptyState icon={<Star size={20} />} title="Not available here" body="Tasks are served by the primary backend only." />
          )}
          {tasks.data && (
            <>
              <div className="spread small" style={{ marginBottom: 'var(--sp-3)' }}>
                <span className="muted">
                  {tasks.data.summary.completed} of {tasks.data.summary.total} completed
                </span>
                <span className="faint xs">{tasks.data.summary.pending} pending</span>
              </div>
              <Meter
                pct={(tasks.data.summary.completed / Math.max(1, tasks.data.summary.total)) * 100}
                tone="up"
              />
              <div className="stack" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
                {openTasks.slice(0, 3).map((task) => (
                  <div className="panel" key={task.id} style={{ padding: 'var(--sp-3)' }}>
                    <div className="spread">
                      <strong className="small">{task.title}</strong>
                      <Badge tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="xs faint" style={{ marginTop: 4 }}>
                      {task.category} · due {dateLabel(task.dueDate)}
                    </div>
                  </div>
                ))}
                {openTasks.length === 0 && (
                  <p className="small muted">Every task is complete. Nice work.</p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------- markets strip */}
      <Card
        title={
          <span className="row-tight">
            <WalletIcon size={16} className="gold" /> Markets
          </span>
        }
        action={
          <Link to="/markets">
            <Button variant="ghost" size="sm">
              All markets <ArrowRight size={13} />
            </Button>
          </Link>
        }
        style={{ marginTop: 'var(--sp-4)' }}
        pad={false}
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Market</th>
                <th className="table-numeric">Price</th>
                <th className="table-numeric">24h</th>
                <th className="table-numeric">Volume</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {markets.loading && !markets.data && (
                <tr>
                  <td colSpan={5}>
                    <Skeleton className="sk-block" />
                  </td>
                </tr>
              )}
              {(markets.data ?? []).slice(0, 6).map((m) => (
                <tr key={m.symbol}>
                  <td>
                    <strong>{m.symbol}</strong>
                    <span className="faint xs" style={{ marginLeft: 6 }}>
                      {m.name}
                    </span>
                  </td>
                  <td className="table-numeric mono">${price(m.price)}</td>
                  <td className={`table-numeric mono ${m.change >= 0 ? 'up' : 'down'}`}>
                    {signedPercent(m.change)}
                  </td>
                  <td className="table-numeric mono muted">{m.volume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="table-numeric">
                    <Link to={`/trade/${m.symbol}`}>
                      <Button variant="ghost" size="sm">
                        Trade
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {user && (
        <div className="row" style={{ marginTop: 'var(--sp-5)', justifyContent: 'flex-end' }}>
          <span className="xs faint">Last activity {whenLabel(user.lastActivityAt)}</span>
          <Button variant="ghost" size="sm" onClick={() => void refreshWallet()}>
            <Coins size={14} /> Refresh balances
          </Button>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: { id: string; symbol: string; side: 'up' | 'down'; amount: number; currency: string; accountType: string; expiresAt: number; payoutPercent: number } }) {
  // Display-only countdown. The backend decides the outcome (F13); this never
  // flips a status locally — it only re-renders the time left.
  const ms = useCountdown(order.expiresAt);
  const Icon = order.side === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="panel" style={{ marginBottom: 'var(--sp-2)' }}>
      <div className="spread">
        <span className="row-tight">
          <Icon size={15} className={order.side === 'up' ? 'up' : 'down'} />
          <strong>{order.symbol}</strong>
          <span className={order.side === 'up' ? 'up small' : 'down small'}>
            {order.side === 'up' ? 'Up' : 'Down'}
          </span>
          {order.accountType === 'demo' && <Badge tone="neutral">demo</Badge>}
        </span>
        <span className="countdown" style={{ fontSize: 'var(--fs-lg)' }}>
          {countdown(ms)}
        </span>
      </div>
      <div className="spread xs faint" style={{ marginTop: 6 }}>
        <span>
          Stake {money(order.amount, order.accountType === 'demo' ? 'CREDITS' : order.currency)} · payout{' '}
          {order.payoutPercent}%
        </span>
        <span>
          <Lock size={11} style={{ verticalAlign: -1 }} /> held until settlement
        </span>
      </div>
    </div>
  );
}
