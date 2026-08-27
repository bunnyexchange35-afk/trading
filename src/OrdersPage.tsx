import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, Ban, CheckCircle2, Loader2, RefreshCcw, Trophy, XCircle,
} from 'lucide-react';
import { EmptyState, PageHero } from './components';
import { useApp } from './app-context';
import { apiMessage, listOrders, type WalletState } from './api';
import type { TradeOrder } from './types';

const sign = (currency: string) => (currency === 'USDT' ? '₮' : '₹');

function formatPrice(value?: number) {
  if (value == null) return '—';
  return value >= 1 ? value.toFixed(2) : value.toPrecision(4);
}

function formatDateTime(value?: string | number | null) {
  if (value == null) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const statusMeta: Record<string, { label: string; className: string; icon: JSX.Element }> = {
  open: { label: 'Open', className: 'oh-status-open', icon: <Activity size={13} /> },
  won: { label: 'Won', className: 'oh-status-won', icon: <Trophy size={13} /> },
  lost: { label: 'Lost', className: 'oh-status-lost', icon: <XCircle size={13} /> },
  cancelled: { label: 'Cancelled', className: 'oh-status-cancelled', icon: <Ban size={13} /> },
};

type Filter = 'all' | 'open' | 'won' | 'lost' | 'cancelled';

export default function OrdersPage() {
  const { user, openAuth } = useApp();
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await listOrders(user.email);
      if (!response.success || !response.orders) {
        throw new Error(response.error || 'Order history is not available right now.');
      }
      setOrders(response.orders);
      setWalletState(response.wallet ?? null);
    } catch (loadError) {
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  if (!user) {
    return (
      <main>
        <PageHero
          eyebrow="Your desk"
          title="Order history"
          copy="Every order you place settles into your history — entry, settlement and payout."
        />
        <section className="container account-layout">
          <div className="settings-content">
            <EmptyState
              title="Sign in to view your orders"
              copy="Your complete order history is stored on the backend and tied to your account."
              action={
                <button className="btn btn-purple" onClick={() => openAuth('signin')}>
                  Sign in <ArrowRight />
                </button>
              }
            />
          </div>
        </section>
      </main>
    );
  }

  const filtered = filter === 'all' ? orders : orders.filter((order) => order.status === filter);
  const wonCount = orders.filter((order) => order.status === 'won').length;
  const lostCount = orders.filter((order) => order.status === 'lost').length;
  const openCount = orders.filter((order) => order.status === 'open').length;
  const settled = wonCount + lostCount;
  const winRate = settled > 0 ? Math.round((wonCount / settled) * 100) : null;

  return (
    <main>
      <PageHero
        eyebrow="Your desk"
        title="Order history"
        copy="Complete WIN / LOSE record for every order — quantity, time, payout %, entry and settlement price."
      />
      <section className="container orders-page">
        <div className="orders-stats">
          <div><span>Total orders</span><strong>{orders.length}</strong></div>
          <div><span>Active</span><strong>{openCount}</strong></div>
          <div className="stat-won"><span>Won</span><strong>{wonCount}</strong></div>
          <div className="stat-lost"><span>Lost</span><strong>{lostCount}</strong></div>
          <div><span>Win rate</span><strong>{winRate == null ? '—' : `${winRate}%`}</strong></div>
          <div>
            <span>Frozen in orders</span>
            <strong>
              {walletState ? `${sign('INR')}${Math.floor(walletState.frozenBalance).toLocaleString('en-IN')}` : '—'}
            </strong>
          </div>
        </div>

        <div className="orders-toolbar">
          <div className="orders-filter-pills">
            {(['all', 'open', 'won', 'lost', 'cancelled'] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'All' : statusMeta[value].label}
              </button>
            ))}
          </div>
          <button className="btn btn-soft" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />} Refresh
          </button>
        </div>

        {error && <div className="orders-error"><XCircle size={16} /> {error}</div>}

        {loading && orders.length === 0 && (
          <div className="orders-empty"><Loader2 size={26} className="spin" /><p>Loading orders from the backend…</p></div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="orders-empty">
            <Activity size={26} />
            <p>No orders in this view yet. Place an order from the Instant Order desk.</p>
            <Link to="/instant-order" className="btn btn-purple btn-sm">Open Instant Order <ArrowRight size={14} /></Link>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="oh-table">
            <div className="oh-row oh-head">
              <span>Order</span>
              <span>Direction</span>
              <span>Amount</span>
              <span>%</span>
              <span>Duration</span>
              <span>Entry → Settlement</span>
              <span>Profit / Loss</span>
              <span>Status</span>
              <span>Settled at</span>
            </div>
            {filtered.map((order) => {
              const meta = statusMeta[order.status] ?? statusMeta.open;
              const isReal = order.accountType === 'real';
              const currencySign = isReal ? sign(order.currency) : '';
              const profit = order.status === 'won' ? (order.profit ?? 0) : order.status === 'lost' ? -order.amount : 0;
              return (
                <div className={`oh-row oh-${order.status}`} key={order.id}>
                  <span className="oh-order-cell">
                    <strong>{order.symbol}</strong>
                    <small>{isReal ? `Real · ${order.currency}` : 'Demo credits'}</small>
                    <small className="oh-id">#{order.id.slice(0, 12)}</small>
                  </span>
                  <span className={`oh-direction ${order.side}`}>
                    {order.side === 'up' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    {order.side === 'up' ? 'BUY UP' : 'BUY DOWN'}
                  </span>
                  <span>
                    {isReal
                      ? `${currencySign}${order.amount.toLocaleString('en-IN')}`
                      : `${order.amount.toLocaleString()} cr`}
                  </span>
                  <span>{order.settledPercent ?? order.payoutPercent}%</span>
                  <span>{order.durationSeconds < 60 ? `${order.durationSeconds}s` : `${order.durationSeconds / 60}m`}</span>
                  <span className="oh-price-cell">
                    {formatPrice(order.entryPrice)} → {formatPrice(order.exitPrice)}
                  </span>
                  <span className={profit > 0 ? 'up' : profit < 0 ? 'down' : ''}>
                    {order.status === 'open'
                      ? '—'
                      : order.status === 'cancelled'
                        ? `${currencySign}${order.amount.toLocaleString('en-IN')} refunded`
                        : `${profit > 0 ? '+' : ''}${currencySign}${Math.abs(profit).toLocaleString('en-IN')}${isReal ? '' : ' cr'}`}
                  </span>
                  <span className={`oh-status-badge ${meta.className}`}>
                    {meta.icon} {meta.label}
                    {order.status === 'won' && isReal
                      ? ` +${currencySign}${Math.floor(order.payout || 0).toLocaleString('en-IN')}`
                      : ''}
                  </span>
                  <span className="oh-settled">
                    {order.status === 'open'
                      ? <span className="oh-pending"><Activity size={12} /> in play</span>
                      : formatDateTime(order.settledAt)}
                    {order.settledBy && order.settledBy !== 'market' && (
                      <small>by {order.settledBy}</small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="orders-note">
          <CheckCircle2 size={13} /> Order outcomes, payout %, settlement prices and times are decided by the
          backend — WIN / LOSE control belongs to the desk, never to this website.
        </p>
      </section>
    </main>
  );
}
