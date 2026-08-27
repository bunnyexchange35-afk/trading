import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMarkets } from './api';
import { ASSETS, FALLBACK_QUOTES, type MarketQuote } from './data';

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
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // Served by the backend or the Cloudflare worker — the browser never
        // calls a market provider directly. Warm-cache fallback happens
        // server-side when the provider is unreachable.
        const body = await getMarkets();
        if (!active) return;
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
        if (!active) return;
        setConnected(false);
        setStatus('unavailable');
        setSource('Backend unreachable');
        setMessage('Market data could not be refreshed. The last backend snapshot is shown.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 12_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

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
