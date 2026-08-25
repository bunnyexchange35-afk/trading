import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMarkets } from './api';
import { ASSETS, FALLBACK_QUOTES, type MarketQuote } from './data';

type MarketState = {
  quotes: MarketQuote[];
  loading: boolean;
  connected: boolean;
  source: string;
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

export function MarketProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState('Connecting');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // Served by the backend or the Cloudflare worker — Coinbase live feed
        // with a warm-cache fallback when the provider is unreachable.
        const body = await getMarkets();
        if (!active) return;
        const live = Array.isArray(body.data) && body.data.length > 0 ? body.data : FALLBACK_QUOTES;
        setQuotes(mergeWithAssets(live));
        setConnected(body.source === 'coinbase');
        setSource(body.source === 'coinbase' ? 'Coinbase live' : 'Warm cache');
        setRefreshedAt(new Date());
      } catch {
        if (!active) return;
        setConnected(false);
        setSource('Demo fallback');
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

  const value = useMemo<MarketState>(() => ({
    quotes,
    loading,
    connected,
    source,
    refreshedAt,
    refresh,
    quote: (symbol) => quotes.find((item) => item.symbol === symbol) ?? quotes[0],
  }), [quotes, loading, connected, source, refreshedAt, refresh]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const value = useContext(MarketContext);
  if (!value) throw new Error('useMarket must be used within MarketProvider');
  return value;
}
