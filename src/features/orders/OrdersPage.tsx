/**
 * Order history and the active board.
 *
 * F13: re-fetching this list is what makes the backend settle expired orders,
 * so a refresh here is meaningful — but the status shown always comes from the
 * response, never from a local guess. Cancellation routes through
 * `POST /api/wallet/frozen/release`, because no cancel endpoint exists.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Layers, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { cancelOrder, listOrders, type TradeOrder } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync, useOrderPolling } from '../../hooks/useAsync';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, Stat, Tabs, statusTone } from '../../components/ui';
import { clockLabel, countdown, dateLabel, durationLabel, money, price as fmtPrice, whenLabel } from '../../utils/format';

type Filter = 'open' | 'won' | 'lost' | 'cancelled' | 'all';

export default function OrdersPage() {
  const { refreshWallet } = useSession();
  const orders = useAsync(() => listOrders(), [], { intervalMs: 0 });
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = orders.data?.orders ?? [];
  const openCount = all.filter((o) => o.status === 'open').length;
  useOrderPolling(openCount, orders.refresh, 2500);

  const counts = useMemo(
    () => ({
      open: all.filter((o) => o.status === 'open').length,
      won: all.filter((o) => o.status === 'won').length,
      lost: all.filter((o) => o.status === 'lost').length,
      cancelled: all.filter((o) => o.status === 'cancelled').length,
      all: all.length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    return all.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (q && !o.symbol.toUpperCase().includes(q) && !o.id.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [all, filter, query]);

  const settled = all.filter((o) => o.status === 'won' || o.status === 'lost');
  const wins = settled.filter((o) => o.status === 'won').length;
  const realised = settled.reduce((sum, o) => sum + (Number(o.profit) || 0), 0);

  const onCancel = async (orderId: string) => {
    setBusyId(orderId);
    setError(null);
    try {
      await cancelOrder(orderId);
      orders.refresh();
      await refreshWallet();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Orders</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Order history
          </h1>
          <p className="page-sub">
            Every order you have placed. Open orders settle automatically at expiry against the
            live price — refreshing this list is what lets the backend settle them.
          </p>
        </div>
        <div className="row">
          <Button variant="ghost" onClick={orders.refresh}>
            <RefreshCw size={15} className={orders.loading ? 'spin' : undefined} /> Refresh
          </Button>
          <Link to="/trade">
            <Button variant="primary">
              <Layers size={15} /> New order
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Open" value={counts.open} small />
        <Stat label="Settled" value={settled.length} foot={settled.length ? `${wins} won · ${settled.length - wins} lost` : undefined} small />
        <Stat
          label="Realised result"
          value={<span className={realised >= 0 ? 'up' : 'down'}>{realised >= 0 ? '+' : ''}{money(realised)}</span>}
          foot="Sum of backend-settled profit"
          small
        />
        <Stat label="Win rate" value={settled.length ? `${Math.round((wins / settled.length) * 100)}%` : '—'} foot="Feeds your credit score" small />
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <Card pad={false}>
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          <Tabs<Filter>
            label="Filter orders"
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: 'open', label: 'Active', count: counts.open },
              { id: 'won', label: 'Won', count: counts.won },
              { id: 'lost', label: 'Lost', count: counts.lost },
              { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
              { id: 'all', label: 'All', count: counts.all },
            ]}
          />
          <div style={{ position: 'relative', flex: '0 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 9, color: 'var(--text-faint)' }} aria-hidden="true" />
            <input
              className="input"
              style={{ height: 34, paddingLeft: 32, fontSize: 'var(--fs-sm)' }}
              placeholder="Search symbol or id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search orders"
            />
          </div>
        </div>

        {orders.loading && !orders.data && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <Skeleton className="sk-block" style={{ height: 240 }} />
          </div>
        )}

        {orders.unavailable && (
          <EmptyState icon={<History size={20} />} title="Orders unavailable here" body="This deployment does not serve the order API." />
        )}

        {!orders.loading && !orders.unavailable && rows.length === 0 && (
          <EmptyState
            icon={<Layers size={20} />}
            title={filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
            body="Place a directional order from the trade desk and it will appear here."
            action={
              <Link to="/trade">
                <Button variant="outline" size="sm">
                  Open trade desk
                </Button>
              </Link>
            }
          />
        )}

        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Market</th>
                  <th>Direction</th>
                  <th className="table-numeric">Stake</th>
                  <th className="table-numeric">Payout</th>
                  <th className="table-numeric">Entry</th>
                  <th className="table-numeric">Exit</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((order: TradeOrder) => (
                  <OrderRow key={order.id} order={order} busy={busyId === order.id} onCancel={() => onCancel(order.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-foot xs faint">
          Showing {rows.length} of {all.length} · the backend paginates nothing, so this is your
          full order list · {orders.data?.wallet ? 'balances refreshed with this list' : ''}
        </div>
      </Card>
    </div>
  );
}

function OrderRow({ order, busy, onCancel }: { order: TradeOrder; busy: boolean; onCancel: () => void }) {
  const isOpen = order.status === 'open';
  const remaining = isOpen ? Math.max(0, order.expiresAt - Date.now()) : 0;
  const stakeCurrency = order.accountType === 'demo' ? 'CREDITS' : order.currency;

  return (
    <tr>
      <td>
        <div className="mono xs">{order.id}</div>
        <div className="xs faint">
          {dateLabel(order.createdAt)} {clockLabel(order.createdAt)} · {durationLabel(order.durationSeconds)}
        </div>
      </td>
      <td>
        <Link to={`/markets/${order.symbol}`}>
          <strong>{order.symbol}</strong>
        </Link>
        {order.accountType === 'demo' && (
          <Badge tone="neutral">
            <span style={{ marginLeft: 4 }}>credit</span>
          </Badge>
        )}
      </td>
      <td className={order.side === 'up' ? 'up' : 'down'}>{order.side === 'up' ? '▲ Up' : '▼ Down'}</td>
      <td className="table-numeric mono">{money(order.amount, stakeCurrency)}</td>
      <td className="table-numeric mono">
        {order.settledPercent ?? order.payoutPercent}%
        {order.payout !== undefined && (
          <div className="xs faint">{money(order.payout, stakeCurrency)}</div>
        )}
      </td>
      <td className="table-numeric mono muted">{fmtPrice(order.entryPrice)}</td>
      <td className="table-numeric mono">{order.exitPrice !== undefined ? fmtPrice(order.exitPrice) : <span className="faint">—</span>}</td>
      <td>
        {isOpen ? (
          <span className="row-tight">
            <Badge tone="open">
              <Loader2 size={10} className="spin" /> open
            </Badge>
            <span className="mono xs muted">{countdown(remaining)}</span>
          </span>
        ) : (
          <div>
            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
            {order.settledAt && (
              <div className="xs faint">{whenLabel(order.settledAt)} · {order.settledBy}</div>
            )}
          </div>
        )}
      </td>
      <td className="table-numeric">
        {isOpen && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <XCircle size={13} />} Cancel
          </Button>
        )}
      </td>
    </tr>
  );
}
