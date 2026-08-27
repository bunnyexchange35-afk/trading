import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getMarkets } from './api';
import { ASSETS, FALLBACK_QUOTES, type MarketQuote } from './data';
import { useSmartPolling } from './perf';

/** Data freshness exactly as the backend reports it — never inferred client-side. */
export type MarketDataStatus = 'connecting' | 'live' | 'delayed' | 'cached' | 'unavailable';

type MarketState = {
  quotes: MarketQuote[];
  loading: boolean;
  connected: boolean;
  source: string;
  status: MarketDataStatus;
  message: string;
  refreshedAt: Date | null;
  refresh: () => void;
  quote: (symbol: string) => MarketQuote;
};

const MarketContext = createContext<MarketState | null>(null);

/**
 * Cadence for the live feed. 15 s is the battery/thermal-friendly end of the
 * 10–15 s "live desk" range: one request per interval, never per second.
 */
const MARKET_POLL_MS = 15_000;

/** Routes that render a live feed — the loop runs only on these. */
const MARKET_ROUTES = new Set(['/', '/dashboard', '/market', '/trading', '/instant-order']);
/** Routes that merely display quotes (wallet valuations): refreshed once on
 *  entry, then idle — no background loop. */
const MARKET_ENTRY_ROUTES = new Set(['/wallet']);

/**
 * Merge live feed rows with the local asset registry so colors, marks,
 * categories and vault APYs always come from the frontend bundle — the feed
 * only supplies numbers (price, change, high, low, volume).
 */
function mergeWithAssets(data: Partial<MarketQuote>[]): MarketQuote[] {
  return data.map((item) => {
    const local = ASSETS.find((asset) => asset.symbol === item.symbol);
    return { ...(local ?? {}), ...item } as MarketQuote;
  });
}

/** Map the backend's source/cached flags onto the honest freshness label. */
function statusFromBody(body: { source?: string; cached?: boolean }): MarketDataStatus {
  if (body.source === 'coinbase') {
    if (body.cached === true) return 'cached';
    return body.cached === false ? 'live' : 'delayed';
  }
  if (body.source === 'fallback') return 'unavailable';
  return 'delayed';
}

const statusLabel: Record<MarketDataStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  delayed: 'Delayed',
  cached: 'Cached',
  unavailable: 'Unavailable',
};

export function marketStatusLabel(status: MarketDataStatus): string {
  return statusLabel[status];
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState('Connecting');
  const [status, setStatus] = useState<MarketDataStatus>('connecting');
  const [message, setMessage] = useState('');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const location = useLocation();

  // Poll only while a route showing market data is mounted. Wallet, tasks,
  // support, profile… pages never keep the feed looping.
  const onMarketRoute = MARKET_ROUTES.has(location.pathname);
  const mountedRef = useRef(false);
  const enabled = onMarketRoute || !mountedRef.current;

  const load = useCallback(async () => {
    // One request at a time: a newer load always supersedes the in-flight one
    // (no stale-response pile-ups when routes/tabs change quickly).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Served by the backend or the Cloudflare worker — the browser never
      // calls a market provider directly. Warm-cache fallback happens
      // server-side when the provider is unreachable.
      const body = await getMarkets({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (Array.isArray(body.data) && body.data.length > 0) {
        setQuotes(mergeWithAssets(body.data));
      }
      const nextStatus = statusFromBody(body);
      setStatus(nextStatus);
      setConnected(nextStatus === 'live' || nextStatus === 'cached' || nextStatus === 'delayed');
      setSource(body.source === 'coinbase' ? `Coinbase · ${statusLabel[nextStatus]}` : 'Backend warm cache');
      setMessage(typeof body.message === 'string' ? body.message : '');
      setRefreshedAt(new Date());
    } catch {
      if (controller.signal.aborted) return;
      setConnected(false);
      setStatus('unavailable');
      setSource('Backend unreachable');
      setMessage('Market data could not be refreshed. The last backend snapshot is shown.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useSmartPolling(load, { intervalMs: MARKET_POLL_MS, enabled });

  // Entry-only pages (wallet valuation strip): one fresh read per arrival,
  // never a background loop.
  useEffect(() => {
    if (!onMarketRoute && MARKET_ENTRY_ROUTES.has(location.pathname)) void load();
  }, [onMarketRoute, location.pathname, load]);

  // Leaving a market route must not leave an orphaned request running.
  useEffect(() => {
    if (onMarketRoute) return;
    abortRef.current?.abort();
    abortRef.current = null;
  }, [onMarketRoute]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const value = useMemo<MarketState>(
    () => ({
      quotes,
      loading,
      connected,
      source,
      status,
      message,
      refreshedAt,
      refresh,
      quote: (symbol) => quotes.find((item) => item.symbol === symbol) ?? quotes[0],
    }),
    [quotes, loading, connected, source, status, message, refreshedAt, refresh]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const value = useContext(MarketContext);
  if (!value) throw new Error('useMarket must be used within MarketProvider');
  return value;
}
