/**
 * Market detail: live candles + the backend's own technical analysis.
 *
 * Integrity rules enforced here:
 *  - only the four intervals the backend allows (1m, 5m, 15m, 1h)
 *  - when `source === 'fallback'` the candles are SYNTHESISED by the backend,
 *    and the page says so loudly instead of passing them off as live
 *  - `/analysis` and `/ohlcv` can legitimately fail while the provider is
 *    unreachable; those render honest empty states, never invented numbers
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Layers,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  getMarketAnalysis,
  getMarketDetail,
  getKlines,
  isSyntheticKlines,
  KLINE_INTERVALS,
  type KlineInterval,
} from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { PriceChart } from '../../components/PriceChart';
import { Alert, Badge, Button, Card, EmptyState, KeyValue, Skeleton, Stat, Tabs } from '../../components/ui';
import { compactNumber, price, signedPercent, whenLabel } from '../../utils/format';

export default function MarketDetailPage() {
  const { symbol = 'BTC' } = useParams();
  const navigate = useNavigate();
  const [interval, setInterval_] = useState<KlineInterval>('1m');

  const detail = useAsync(() => getMarketDetail(symbol).then((r) => r.market), [symbol]);
  const klines = useAsync(() => getKlines(symbol, interval), [symbol, interval], { intervalMs: 30_000 });
  const analysis = useAsync(() => getMarketAnalysis(symbol).then((r) => r.analysis), [symbol]);

  // Keep the URL in sync when the symbol changes via the picker.
  useEffect(() => {
    document.title = `${symbol} · Mudrexx Earn`;
  }, [symbol]);

  const market = detail.data;
  const synthetic = isSyntheticKlines(klines.data as never);
  const candles = klines.data?.data ?? [];
  const rising = (market?.change ?? 0) >= 0;

  return (
    <div className="page">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back
      </Button>

      {/* --------------------------------------------------------- header */}
      <header className="page-head">
        <div className="row" style={{ gap: 'var(--sp-4)' }}>
          <span
            aria-hidden="true"
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: market?.soft || 'var(--surface-raised)',
              color: market?.color || 'var(--brand)',
              fontWeight: 800,
              fontSize: 19,
            }}
          >
            {market?.mark || symbol[0]}
          </span>
          <div>
            <div className="row-tight">
              <h1 className="page-title">{symbol}</h1>
              {market?.status === 'unavailable' && <Badge tone="warn">provider degraded</Badge>}
              {market?.rank && <Badge tone="neutral">rank {market.rank}</Badge>}
            </div>
            <p className="page-sub" style={{ marginTop: 2 }}>
              {market?.name ?? 'Market detail'}
              {market?.lastUpdated && ` · updated ${whenLabel(market.lastUpdated)}`}
            </p>
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-value num" style={{ fontSize: 'var(--fs-3xl)' }}>
              ${market ? price(market.price) : '—'}
            </div>
            {market && (
              <div className={`small strong ${rising ? 'up' : 'down'}`}>
                {rising ? <TrendingUp size={13} style={{ verticalAlign: -2 }} /> : <TrendingDown size={13} style={{ verticalAlign: -2 }} />}{' '}
                {signedPercent(market.change)} · 24h
              </div>
            )}
          </div>
          <Link to={`/trade/${symbol}`}>
            <Button variant="primary" size="lg">
              <Layers size={16} /> Trade {symbol}
            </Button>
          </Link>
        </div>
      </header>

      {market?.providerMessage && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <Alert tone="warn" title="Market provider message">
            {market.providerMessage}
            {market.source ? ` (source: ${market.source})` : ''}
          </Alert>
        </div>
      )}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 'var(--sp-4)' }}
      >
        <Stat label="24h high" value={market ? `$${price(market.high)}` : '—'} small />
        <Stat label="24h low" value={market ? `$${price(market.low)}` : '—'} small />
        <Stat label="24h volume" value={market ? compactNumber(market.volume) : '—'} small />
        <Stat
          label="Indicative vault APY"
          value={market ? `${market.stakingApy}%` : '—'}
          foot="Not automatically credited"
          small
        />
      </div>

      {/* ---------------------------------------------------------- chart */}
      <Card
        title={
          <span className="row-tight">
            <BarChart3 size={16} className="gold" /> Price chart
          </span>
        }
        action={
          <div className="row-tight">
            <Tabs<KlineInterval>
              label="Chart interval"
              value={interval}
              onChange={setInterval_}
              tabs={KLINE_INTERVALS.map((i) => ({ id: i, label: i }))}
            />
            <Button variant="ghost" size="sm" onClick={klines.refresh} aria-label="Refresh chart">
              <RefreshCw size={14} className={klines.loading ? 'spin' : undefined} />
            </Button>
          </div>
        }
        pad={false}
      >
        {synthetic && (
          <div style={{ padding: 'var(--sp-4) var(--sp-5) 0' }}>
            <Alert tone="warn" title="These candles are synthetic">
              <span className="row-tight" style={{ alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ flex: 'none', marginTop: 2 }} />
                <span>
                  The market provider is unreachable, so the backend generated this series
                  locally (<code className="mono">source: fallback</code>). It is not live
                  price history — do not trade against it.
                </span>
              </span>
            </Alert>
          </div>
        )}

        <div style={{ padding: 'var(--sp-4)' }}>
          {klines.loading && !klines.data && <Skeleton className="sk-block" style={{ height: 320 }} />}
          {klines.error && (
            <EmptyState
              icon={<BarChart3 size={20} />}
              title="Chart unavailable"
              body={klines.error.message}
              action={
                <Button variant="outline" size="sm" onClick={klines.refresh}>
                  Try again
                </Button>
              }
            />
          )}
          {!klines.error && candles.length > 0 && <PriceChart data={candles} variant="candles" height={340} />}
          {!klines.error && !klines.loading && candles.length === 0 && (
            <EmptyState icon={<BarChart3 size={20} />} title="No candles returned" body="The backend returned an empty series for this interval." />
          )}
        </div>

        <div className="card-foot xs faint">
          {candles.length} candles · {interval} interval ·{' '}
          {klines.data?.source ? `source: ${klines.data.source}` : 'source unknown'}
          {klines.data?.pair ? ` · pair ${klines.data.pair}` : ''}
        </div>
      </Card>

      {/* ------------------------------------------------------- analysis */}
      <Card
        title={
          <span className="row-tight">
            <Activity size={16} className="gold" /> Technical analysis
          </span>
        }
        action={
          <Button variant="ghost" size="sm" onClick={analysis.refresh}>
            <RefreshCw size={14} className={analysis.loading ? 'spin' : undefined} /> Recalculate
          </Button>
        }
        style={{ marginTop: 'var(--sp-4)' }}
      >
        {analysis.loading && !analysis.data && <Skeleton className="sk-block" />}

        {analysis.unavailable && (
          <EmptyState
            icon={<Activity size={20} />}
            title="Analysis unavailable"
            body={
              analysis.error?.message ??
              'Technical analysis is computed from live provider candles and is unavailable while the provider is unreachable.'
            }
            action={
              <Button variant="outline" size="sm" onClick={analysis.refresh}>
                Try again
              </Button>
            }
          />
        )}

        {analysis.data && (
          <>
            <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
              <Badge tone={analysis.data.trend?.toLowerCase().includes('down') ? 'lost' : analysis.data.trend?.toLowerCase().includes('up') ? 'won' : 'neutral'}>
                Trend: {analysis.data.trend}
              </Badge>
              {analysis.data.rsi14 !== null && (
                <Badge tone={analysis.data.rsi14 >= 70 ? 'warn' : analysis.data.rsi14 <= 30 ? 'open' : 'neutral'}>
                  RSI(14) {analysis.data.rsi14.toFixed(1)}
                </Badge>
              )}
              {analysis.data.volatilityPercent !== null && (
                <Badge tone="neutral">Volatility {analysis.data.volatilityPercent.toFixed(2)}%</Badge>
              )}
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
              <div className="panel">
                <span className="eyebrow">Momentum</span>
                <KeyValue k="Price" v={`$${price(analysis.data.price)}`} />
                <KeyValue
                  k="Momentum"
                  v={
                    analysis.data.momentumPercent !== null ? (
                      <span className={analysis.data.momentumPercent >= 0 ? 'up' : 'down'}>
                        {signedPercent(analysis.data.momentumPercent)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <KeyValue k="Support" v={analysis.data.support ? `$${price(analysis.data.support)}` : '—'} />
                <KeyValue k="Resistance" v={analysis.data.resistance ? `$${price(analysis.data.resistance)}` : '—'} />
              </div>

              <div className="panel">
                <span className="eyebrow">Moving averages</span>
                <KeyValue k="SMA 20" v={fmt(analysis.data.sma20)} />
                <KeyValue k="SMA 50" v={fmt(analysis.data.sma50)} />
                <KeyValue k="EMA 12" v={fmt(analysis.data.ema12)} />
                <KeyValue k="EMA 26" v={fmt(analysis.data.ema26)} />
              </div>

              <div className="panel">
                <span className="eyebrow">MACD</span>
                <KeyValue k="MACD" v={fmt(analysis.data.macd)} />
                <KeyValue k="Signal" v={fmt(analysis.data.macdSignal)} />
                <KeyValue
                  k="Histogram"
                  v={
                    analysis.data.macdHistogram !== null ? (
                      <span className={analysis.data.macdHistogram >= 0 ? 'up' : 'down'}>
                        {fmt(analysis.data.macdHistogram)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <KeyValue k="Volatility" v={analysis.data.volatilityPercent !== null ? `${analysis.data.volatilityPercent.toFixed(2)}%` : '—'} />
              </div>
            </div>

            <p className="xs faint" style={{ marginTop: 'var(--sp-4)' }}>
              Every value above is computed by the backend from live candles. The frontend does
              not recalculate indicators, and this is not investment advice.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

const fmt = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : <span className="mono">{price(value)}</span>;
