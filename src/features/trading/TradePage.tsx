/**
 * Trading terminal — built from scratch.
 *
 * Nothing here is carried over from the retired `InstantOrder.tsx`: different
 * layout, different markup, different class names, different component
 * structure. Only the *verified backend contract* is reused.
 *
 * Rules honoured:
 *  - every asset / currency / duration / payout / min / max comes from
 *    `GET /api/order/config`; nothing is hardcoded when the API provides it
 *  - the countdown is display-only. Settlement is LAZY: it advances when the
 *    order list is READ (audit F13), so we re-fetch to observe it and never
 *    flip a status locally
 *  - cancellation is `POST /api/wallet/frozen/release` — there is no cancel
 *    endpoint
 *  - synthetic candles are disclosed, never passed off as live
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  FlaskConical,
  Layers,
  Loader2,
  Lock,
  Search,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';
import {
  cancelOrder,
  createOrder,
  getKlines,
  getOrderConfig,
  isSyntheticKlines,
  KLINE_INTERVALS,
  listOrders,
  type KlineInterval,
  type OrderDeskConfig,
  type TradeOrder,
} from '../../api';
import { errorMessage } from '../../api/client';
import { useSession } from '../../app/session';
import { useAsync, useCountdown, useOrderPolling } from '../../hooks/useAsync';
import { PriceChart } from '../../components/PriceChart';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Tabs,
  statusTone,
} from '../../components/ui';
import { countdown, durationLabel, money, price as fmtPrice, whenLabel } from '../../utils/format';

/** Clamps verified in `POST /api/orders/create`, used only if config is missing. */
const FALLBACK = { minDuration: 5, maxDuration: 86400, minPayout: 1, maxPayout: 500 };

export default function TradePage() {
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const { wallet, refreshWallet } = useSession();

  const config = useAsync(() => getOrderConfig().then((r) => r.config), []);
  const [interval, setInterval_] = useState<KlineInterval>('1m');

  const assets = useMemo(
    () => (config.data?.assets ?? []).filter((a) => a.enabled !== false),
    [config.data],
  );

  const [symbol, setSymbol] = useState<string>(symbolParam ?? assets[0]?.symbol ?? 'BTC');
  const [assetQuery, setAssetQuery] = useState('');

  // Adopt /trade/:symbol when navigated from a market page.
  useEffect(() => {
    if (symbolParam) setSymbol(symbolParam.toUpperCase());
  }, [symbolParam]);

  useEffect(() => {
    if (!symbolParam && assets.length && !assets.some((a) => a.symbol === symbol)) {
      setSymbol(assets[0].symbol);
    }
  }, [assets, symbol, symbolParam]);

  const klines = useAsync(() => getKlines(symbol, interval), [symbol, interval], { intervalMs: 20_000 });

  /* ------------------------------------------------------- desk parameters */

  const currencies = useMemo(
    () => (config.data?.currencies ?? []).filter((c) => c.enabled !== false),
    [config.data],
  );
  const accountTypes = config.data?.accountTypes ?? ['real', 'demo'];
  const durations = config.data?.durations ?? [];
  const payoutPercents = config.data?.payoutPercents ?? [];

  const [accountType, setAccountType] = useState<'real' | 'demo'>('real');
  const [currency, setCurrency] = useState<'INR' | 'USDT'>('INR');
  const [amount, setAmount] = useState<string>('');
  const [duration, setDuration] = useState<number>(config.data?.defaultDuration ?? 60);
  const [payout, setPayout] = useState<number>(config.data?.defaultPayoutPercent ?? 5);
  const [side, setSide] = useState<'up' | 'down'>('up');

  // Seed defaults once config arrives.
  useEffect(() => {
    if (!config.data) return;
    setDuration(config.data.defaultDuration ?? config.data.durations[0] ?? 60);
    setPayout(config.data.defaultPayoutPercent ?? config.data.payoutPercents[0] ?? 5);
  }, [config.data]);

  useEffect(() => {
    if (!currencies.length) return;
    if (!currencies.some((c) => c.code === currency)) setCurrency(currencies[0].code as 'INR' | 'USDT');
  }, [currencies, currency]);

  const activeCurrency = currencies.find((c) => c.code === currency) ?? currencies[0];
  const isDemo = accountType === 'demo';

  const availableFor = useCallback(
    (code: string) => {
      if (isDemo) return wallet?.demoBalance ?? 0;
      if (code === 'USDT') return wallet?.realUsdtBalance ?? 0;
      return wallet?.realBalance ?? 0;
    },
    [isDemo, wallet],
  );

  const minAmount = activeCurrency?.minAmount ?? 1;
  const maxAmount = Math.min(
    activeCurrency?.maxAmount ?? Number.MAX_SAFE_INTEGER,
    availableFor(currency),
  );
  const numericAmount = Number(amount || 0);

  const amountError = useMemo(() => {
    if (!amount.trim()) return null;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Enter a positive amount.';
    if (activeCurrency && numericAmount < activeCurrency.minAmount)
      return `Minimum is ${money(activeCurrency.minAmount, currency)}.`;
    if (activeCurrency && numericAmount > activeCurrency.maxAmount)
      return `Maximum per order is ${money(activeCurrency.maxAmount, currency)}.`;
    if (!isDemo && numericAmount > availableFor(currency))
      return `Only ${money(availableFor(currency), currency)} is available.`;
    if (isDemo && numericAmount > (wallet?.demoBalance ?? 0))
      return `Only ${(wallet?.demoBalance ?? 0).toLocaleString('en-IN')} credits available.`;
    return null;
  }, [amount, numericAmount, activeCurrency, currency, isDemo, availableFor, wallet]);

  /* ------------------------------------------------------------- orders */

  const orders = useAsync(() => listOrders(), [], { enabled: true, intervalMs: 0 });
  const openCount = (orders.data?.orders ?? []).filter((o) => o.status === 'open').length;

  // F13: settlement only advances on a READ, so poll while orders are open and
  // stop entirely when none are. Never a substitute for backend settlement.
  useOrderPolling(openCount, orders.refresh, 2500);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; message: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const placeOrder = async () => {
    setFormError(null);
    setPlaced(null);
    if (amountError || !numericAmount) {
      setFormError(amountError ?? 'Enter an amount to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await createOrder({
        symbol,
        side,
        amount: numericAmount,
        currency,
        accountType,
        durationSeconds: duration,
        payoutPercent: payout,
      });
      setPlaced({ id: response.orderId, message: response.message });
      setAmount('');
      // Re-read so the board and the wallet reflect the new hold immediately.
      orders.refresh();
      await refreshWallet();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async (orderId: string) => {
    setCancelling(orderId);
    setFormError(null);
    try {
      await cancelOrder(orderId);
      orders.refresh();
      await refreshWallet();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setCancelling(null);
    }
  };

  const filteredAssets = assets.filter((a) => {
    const q = assetQuery.trim().toUpperCase();
    return !q || a.symbol.includes(q) || a.name.toUpperCase().includes(q);
  });

  const candles = klines.data?.data ?? [];
  const synthetic = isSyntheticKlines(klines.data as never);
  const lastPrice = candles.at(-1)?.close;

  return (
    <div className="page">
      <div className="terminal">
        {/* --------------------------------------------------------- head */}
        <div className="term-head">
          <Card pad={false}>
            <div className="card-body" style={{ paddingBottom: 'var(--sp-3)' }}>
              <div className="spread" style={{ flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <div className="row" style={{ gap: 'var(--sp-4)' }}>
                  <div>
                    <div className="row-tight">
                      <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>
                        {symbol}
                      </h1>
                      <Badge tone="brand">
                        <Layers size={11} /> Direction desk
                      </Badge>
                    </div>
                    <span className="xs faint">
                      {assets.find((a) => a.symbol === symbol)?.name ?? 'Market'} ·{' '}
                      {config.data?.settlement.mode === 'expiry'
                        ? 'settles at expiry against the live price'
                        : 'settlement controlled by the backend'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stat-value num" style={{ fontSize: 'var(--fs-2xl)' }}>
                      {lastPrice ? `$${fmtPrice(lastPrice)}` : <span className="faint">—</span>}
                    </div>
                    <span className="xs faint">{interval} · last candle</span>
                  </div>
                </div>

                <div className="row-tight">
                  <Tabs<KlineInterval>
                    label="Chart interval"
                    value={interval}
                    onChange={setInterval_}
                    tabs={KLINE_INTERVALS.map((i) => ({ id: i, label: i }))}
                  />
                  <Link to={`/markets/${symbol}`}>
                    <Button variant="ghost" size="sm">
                      <BarChart3 size={14} /> Analysis
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 var(--sp-5) var(--sp-4)' }}>
              <div className="row-tight" style={{ marginBottom: 'var(--sp-2)' }}>
                <Search size={14} className="faint" />
                <input
                  className="input"
                  style={{ height: 32, maxWidth: 220, fontSize: 'var(--fs-sm)' }}
                  placeholder="Filter markets"
                  value={assetQuery}
                  onChange={(e) => setAssetQuery(e.target.value)}
                  aria-label="Filter tradable markets"
                />
                <span className="xs faint">{filteredAssets.length} available</span>
              </div>
              <div className="symbol-picker" role="listbox" aria-label="Select market">
                {config.loading && !config.data && <Skeleton className="sk-line" style={{ width: 320 }} />}
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    role="option"
                    aria-selected={asset.symbol === symbol}
                    className={`symbol-chip ${asset.symbol === symbol ? 'symbol-chip-active' : ''}`}
                    onClick={() => setSymbol(asset.symbol)}
                  >
                    {asset.symbol}
                  </button>
                ))}
                {!config.loading && filteredAssets.length === 0 && (
                  <span className="xs faint">No market matches that filter.</span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------------- chart */}
        <div className="term-chart">
          <Card pad={false} style={{ height: '100%' }}>
            {synthetic && (
              <div style={{ padding: 'var(--sp-4) var(--sp-4) 0' }}>
                <Alert tone="warn" title="Synthetic candles">
                  <span className="row-tight" style={{ alignItems: 'flex-start' }}>
                    <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
                    <span>
                      The provider is unreachable and the backend generated this series
                      (<code className="mono">source: fallback</code>). Entry prices still come
                      from the backend, not from this chart.
                    </span>
                  </span>
                </Alert>
              </div>
            )}
            <div style={{ padding: 'var(--sp-3)' }}>
              {klines.loading && !klines.data && <Skeleton className="sk-block" style={{ height: 320 }} />}
              {klines.error && (
                <EmptyState icon={<BarChart3 size={20} />} title="Chart unavailable" body={klines.error.message} />
              )}
              {!klines.error && candles.length > 0 && <PriceChart data={candles} variant="candles" height={330} />}
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------- order panel */}
        <div className="term-order">
          <Card title={<span className="row-tight"><Layers size={16} className="gold" /> Place order</span>}>
            <div className="stack" style={{ gap: 'var(--sp-4)' }}>
              {formError && <Alert tone="error">{formError}</Alert>}
              {placed && (
                <Alert tone="success" title="Order placed">
                  {placed.message}
                  <div className="xs" style={{ marginTop: 4, opacity: 0.8 }}>
                    <code className="mono">{placed.id}</code> · held in frozen funds until settlement
                  </div>
                </Alert>
              )}

              <Field label="Account">
                {({ id }) => (
                  <div className="tabs" id={id} role="tablist" aria-label="Account type">
                    {accountTypes.map((type) => (
                      <button
                        key={type}
                        role="tab"
                        type="button"
                        aria-selected={accountType === type}
                        className={`tab ${accountType === type ? 'tab-active' : ''}`}
                        onClick={() => setAccountType(type as 'real' | 'demo')}
                      >
                        {type === 'demo' ? 'Credits' : 'Real balance'}
                      </button>
                    ))}
                  </div>
                )}
              </Field>

              {!isDemo && (
                <Field label="Currency">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'INR' | 'USDT')}
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code === 'INR' ? '₹ INR' : '₮ USDT'}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}

              <Field
                label={isDemo ? 'Credits' : `Amount (${currency})`}
                error={amountError}
                hint={
                  activeCurrency && !isDemo
                    ? `Min ${money(activeCurrency.minAmount, currency)} · max ${money(activeCurrency.maxAmount, currency)} · available ${money(availableFor(currency), currency)}`
                    : `Available ${(wallet?.demoBalance ?? 0).toLocaleString('en-IN')} credits`
                }
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid || Boolean(amountError)}
                    type="number"
                    inputMode="decimal"
                    min={minAmount}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={String(activeCurrency?.quickAmounts?.[0] ?? minAmount)}
                    prefix={isDemo ? '' : currency === 'USDT' ? '₮' : '₹'}
                  />
                )}
              </Field>

              {activeCurrency?.quickAmounts && (
                <div className="chips">
                  {activeCurrency.quickAmounts.map((quick) => (
                    <button key={quick} className="chip" type="button" onClick={() => setAmount(String(quick))}>
                      {isDemo ? quick.toLocaleString('en-IN') : money(quick, currency)}
                    </button>
                  ))}
                  <button
                    className="chip"
                    type="button"
                    onClick={() => setAmount(String(Math.floor(availableFor(isDemo ? 'CREDITS' : currency))))}
                  >
                    Max
                  </button>
                </div>
              )}

              <Field label="Duration" hint={config.data ? undefined : `Backend allows ${FALLBACK.minDuration}s – ${FALLBACK.maxDuration}s`}>
                {({ id }) => (
                  <div className="chips" id={id}>
                    {durations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`chip ${duration === d ? 'chip-active' : ''}`}
                        onClick={() => setDuration(d)}
                        aria-pressed={duration === d}
                      >
                        {durationLabel(d)}
                      </button>
                    ))}
                    {durations.length === 0 && <span className="xs faint">No durations published</span>}
                  </div>
                )}
              </Field>

              <Field label="Payout">
                {({ id }) => (
                  <div className="chips" id={id}>
                    {payoutPercents.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`chip ${payout === p ? 'chip-active' : ''}`}
                        onClick={() => setPayout(p)}
                        aria-pressed={payout === p}
                      >
                        {p}%
                      </button>
                    ))}
                    {payoutPercents.length === 0 && <span className="xs faint">No payout tiers published</span>}
                  </div>
                )}
              </Field>

              <div className="panel">
                <div className="kv">
                  <span className="kv-key">Direction</span>
                  <span className="kv-val">
                    {side === 'up' ? 'Price higher' : 'Price lower'} at expiry
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-key">Stake</span>
                  <span className="kv-val">{isDemo ? `${numericAmount || 0} credits` : money(numericAmount, currency)}</span>
                </div>
                <div className="kv">
                  <span className="kv-key">Potential payout</span>
                  <span className="kv-val up">
                    {isDemo
                      ? `${Math.round((numericAmount || 0) * (1 + payout / 100)).toLocaleString('en-IN')} credits`
                      : money((numericAmount || 0) * (1 + payout / 100), currency)}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-key">Entry price</span>
                  <span className="kv-val mono">set by backend</span>
                </div>
              </div>

              <div className="side-grid">
                <button
                  type="button"
                  className="side-btn side-btn-up"
                  aria-pressed={side === 'up'}
                  onClick={() => setSide('up')}
                >
                  <ArrowUpRight size={18} /> Up
                </button>
                <button
                  type="button"
                  className="side-btn side-btn-down"
                  aria-pressed={side === 'down'}
                  onClick={() => setSide('down')}
                >
                  <ArrowDownRight size={18} /> Down
                </button>
              </div>

              <Button
                variant={side === 'up' ? 'up' : 'down'}
                size="lg"
                block
                loading={submitting}
                disabled={Boolean(amountError) || !numericAmount}
                onClick={placeOrder}
              >
                {!submitting && <Layers size={16} />}
                Place {side} order
              </Button>

              <p className="xs faint" style={{ lineHeight: 'var(--lh-snug)' }}>
                {isDemo ? (
                  <>
                    <FlaskConical size={11} style={{ verticalAlign: -1 }} /> Credit orders use credit
                    funds and do not touch your real balance.
                  </>
                ) : (
                  <>
                    <Lock size={11} style={{ verticalAlign: -1 }} /> Your stake moves to frozen funds
                    and is released by the backend when the order settles. Payout figures are
                    indicative — the backend is authoritative.
                  </>
                )}
              </p>
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------------- board */}
        <div className="term-board">
          <Card
            title={
              <span className="row-tight">
                <WalletIcon size={16} className="gold" /> Order board
                {openCount > 0 && <Badge tone="open">{openCount} open</Badge>}
              </span>
            }
            action={
              <div className="row-tight">
                <Button variant="ghost" size="sm" onClick={orders.refresh} aria-label="Refresh orders">
                  <Loader2 size={14} className={orders.loading ? 'spin' : undefined} />
                </Button>
                <Link to="/orders">
                  <Button variant="ghost" size="sm">
                    Full history
                  </Button>
                </Link>
              </div>
            }
            pad={false}
          >
            {orders.loading && !orders.data && (
              <div style={{ padding: 'var(--sp-5)' }}>
                <Skeleton className="sk-block" />
              </div>
            )}
            {!orders.loading && (orders.data?.orders ?? []).length === 0 && (
              <EmptyState
                icon={<Layers size={20} />}
                title="No orders yet"
                body="Your placed orders appear here with a live countdown. Settlement is decided by the backend at expiry."
              />
            )}
            {(orders.data?.orders ?? []).slice(0, 8).map((order) => (
              <BoardRow
                key={order.id}
                order={order}
                onExpire={orders.refresh}
                onCancel={() => onCancel(order.id)}
                cancelling={cancelling === order.id}
              />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function BoardRow({
  order,
  onExpire,
  onCancel,
  cancelling,
}: {
  order: TradeOrder;
  onExpire: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const isOpen = order.status === 'open';
  const remaining = useCountdown(isOpen ? order.expiresAt : undefined, onExpire);
  const Icon = order.side === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-3)',
        alignItems: 'center',
        padding: 'var(--sp-3) var(--sp-5)',
        borderBottom: '1px solid var(--line-hair)',
        flexWrap: 'wrap',
      }}
    >
      <Icon size={16} className={order.side === 'up' ? 'up' : 'down'} aria-hidden="true" />
      <div style={{ flex: '1 1 120px', minWidth: 0 }}>
        <div className="row-tight">
          <strong className="small">{order.symbol}</strong>
          <span className="xs faint">{durationLabel(order.durationSeconds)}</span>
          {order.accountType === 'demo' && <Badge tone="neutral">credit</Badge>}
        </div>
        <div className="xs faint">
          {money(order.amount, order.accountType === 'demo' ? 'CREDITS' : order.currency)} · payout{' '}
          {order.settledPercent ?? order.payoutPercent}% · entry {fmtPrice(order.entryPrice)}
        </div>
      </div>

      {isOpen ? (
        <>
          {/* Display-only; the backend decides the outcome (F13). */}
          <span className="countdown" aria-live="polite" aria-atomic="true">
            {countdown(remaining)}
          </span>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={cancelling}>
            {cancelling ? <Loader2 size={13} className="spin" /> : <XCircle size={13} />} Cancel
          </Button>
        </>
      ) : (
        <div style={{ textAlign: 'right' }}>
          <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          {order.exitPrice !== undefined && (
            <div className="xs faint mono">exit {fmtPrice(order.exitPrice)}</div>
          )}
          {order.settledAt && <div className="xs faint">{whenLabel(order.settledAt)}</div>}
        </div>
      )}
    </div>
  );
}

