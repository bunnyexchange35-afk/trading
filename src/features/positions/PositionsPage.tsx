/**
 * Positions — an explicitly DERIVED view.
 *
 * Audit F5: there is no positions API in either backend. `grep positions`
 * across `server.mjs` and `trading-worker/src/index.ts` returns nothing.
 * This page composes open orders from `/api/orders/list` with order-category
 * holds from `/api/wallet/frozen` and says so plainly. No authoritative
 * position state, margin or liquidation level is invented; the indicative
 * figure is labelled as non-authoritative and comes from live market prices.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Layers, Lock, XCircle } from 'lucide-react';
import { cancelOrder, getFrozen, getMarkets, listOrders } from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync, useOrderPolling } from '../../hooks/useAsync';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, Stat } from '../../components/ui';
import { countdown, durationLabel, money, price as fmtPrice, signedPercent } from '../../utils/format';

export default function PositionsPage() {
  const { refreshWallet } = useSession();
  const orders = useAsync(() => listOrders(), []);
  const frozen = useAsync(() => getFrozen().then((r) => r.items), []);
  const markets = useAsync(() => getMarkets().then((r) => r.data), [], { intervalMs: 30_000 });
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = (orders.data?.orders ?? []).filter((o) => o.status === 'open');
  useOrderPolling(open.length, () => {
    orders.refresh();
    frozen.refresh();
  }, 3000);

  const priceOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of markets.data ?? []) map.set(m.symbol, m.price);
    return map;
  }, [markets.data]);

  const orderHolds = (frozen.data ?? []).filter((f) => f.category === 'order');

  const totals = useMemo(() => {
    const inr = open.filter((o) => o.currency === 'INR' && o.accountType === 'real');
    const usdt = open.filter((o) => o.currency === 'USDT' && o.accountType === 'real');
    const demo = open.filter((o) => o.accountType === 'demo');
    return {
      inr: inr.reduce((s, o) => s + o.amount, 0),
      usdt: usdt.reduce((s, o) => s + o.amount, 0),
      demo: demo.reduce((s, o) => s + o.amount, 0),
      count: open.length,
    };
  }, [open]);

  const onClose = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await cancelOrder(id);
      orders.refresh();
      frozen.refresh();
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
          <span className="eyebrow">Positions</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Open exposure
          </h1>
          <p className="page-sub">
            Your stake is held in frozen funds until the backend settles each order at expiry.
          </p>
        </div>
        <Link to="/trade">
          <Button variant="primary">
            <Layers size={15} /> New order
          </Button>
        </Link>
      </header>

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Alert tone="info" title="Derived view — there is no positions API">
          <span className="row-tight" style={{ alignItems: 'flex-start' }}>
            <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              This page is composed from your open orders (<code className="mono">/api/orders/list</code>)
              and order-category holds (<code className="mono">/api/wallet/frozen</code>). The
              backend does not expose positions, margin, liquidation levels or realised PnL as
              position state, so none are shown. Unrealised figures below are indicative only.
            </span>
          </span>
        </Alert>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Open positions" value={totals.count} small />
        <Stat label="Held (INR)" value={money(totals.inr)} foot="Frozen until settlement" small />
        <Stat label="Held (USDT)" value={`₮${totals.usdt.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} small />
        <Stat label="Credit exposure" value={`${totals.demo.toLocaleString('en-IN')} credits`} small />
      </div>

      <Card title="Open positions" pad={false}>
        {orders.loading && !orders.data && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <Skeleton className="sk-block" />
          </div>
        )}
        {!orders.loading && open.length === 0 && (
          <EmptyState
            icon={<Layers size={20} />}
            title="No open positions"
            body="When you place an order its stake is held here until the backend settles it at expiry."
            action={
              <Link to="/trade">
                <Button variant="outline" size="sm">
                  Open trade desk
                </Button>
              </Link>
            }
          />
        )}
        {open.map((order) => {
          const live = priceOf.get(order.symbol);
          const moved = live !== undefined && order.entryPrice ? ((live - order.entryPrice) / order.entryPrice) * 100 : null;
          const favours = moved === null ? null : order.side === 'up' ? moved >= 0 : moved <= 0;
          const remaining = Math.max(0, order.expiresAt - Date.now());

          return (
            <div
              key={order.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-4)',
                alignItems: 'center',
                padding: 'var(--sp-4) var(--sp-5)',
                borderBottom: '1px solid var(--line-hair)',
                flexWrap: 'wrap',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: order.side === 'up' ? 'var(--up-soft)' : 'var(--down-soft)',
                  color: order.side === 'up' ? 'var(--up)' : 'var(--down)',
                  flex: 'none',
                }}
              >
                {order.side === 'up' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
              </div>

              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <div className="row-tight">
                  <strong>{order.symbol}</strong>
                  <span className={`small ${order.side === 'up' ? 'up' : 'down'}`}>
                    {order.side === 'up' ? 'Up' : 'Down'}
                  </span>
                  {order.accountType === 'demo' && <Badge tone="neutral">credit</Badge>}
                  <Badge tone="open">{durationLabel(order.durationSeconds)}</Badge>
                </div>
                <div className="xs faint mono">
                  {order.id} · entry {fmtPrice(order.entryPrice)}
                  {live !== undefined && ` · live ${fmtPrice(live)}`}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="small strong num">
                  {money(order.amount, order.accountType === 'demo' ? 'CREDITS' : order.currency)}
                </div>
                <div className="xs faint">
                  <Lock size={10} style={{ verticalAlign: -1 }} /> held · payout {order.payoutPercent}%
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 96 }}>
                {moved !== null ? (
                  <>
                    <div className={`small strong mono ${favours ? 'up' : 'down'}`}>
                      {signedPercent(moved)}
                    </div>
                    <div className="xs faint">indicative {favours ? '· in your favour' : '· against you'}</div>
                  </>
                ) : (
                  <span className="xs faint">live price unavailable</span>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: 84 }}>
                <div className="countdown" style={{ fontSize: 'var(--fs-md)' }} aria-live="polite">
                  {countdown(remaining)}
                </div>
                <div className="xs faint">to expiry</div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => onClose(order.id)} disabled={busyId === order.id}>
                <XCircle size={13} /> Close
              </Button>
            </div>
          );
        })}
      </Card>

      {orderHolds.length > 0 && (
        <Card title="Order holds in frozen funds" style={{ marginTop: 'var(--sp-4)' }} pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Hold</th>
                  <th>Reason</th>
                  <th className="table-numeric">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orderHolds.map((hold) => (
                  <tr key={hold.id}>
                    <td className="mono xs">{hold.id}</td>
                    <td className="small muted">{hold.reason || hold.title}</td>
                    <td className="table-numeric mono">{money(hold.amount, hold.currency)}</td>
                    <td>
                      <Badge tone={hold.canRelease ? 'processing' : 'neutral'}>{hold.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot xs faint">
            Releasing an order hold cancels that order and refunds the stake — the backend links
            the two. Manage these from <Link to="/wallet" className="gold">Wallet</Link>.
          </div>
        </Card>
      )}
    </div>
  );
}
