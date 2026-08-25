export interface Env {
  ASSETS: Fetcher;
  KV: KVNamespace;
  BACKEND_ORIGIN?: string;
}

/**
 * Mudrexx Earn — Cloudflare Worker
 *
 * 1. Native, serverless market endpoints backed by Coinbase Exchange public
 *    data (no backend origin needed for /api/markets, /api/market/klines and
 *    /api/health — this keeps the market page live on Cloudflare alone).
 * 2. Everything else under /api/, /a/, /s/ proxies to the Earn backend.
 * 3. The static frontend is served from the ASSETS binding (SPA fallback).
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=5',
    },
  });

const SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC', 'LINK',
  'AVAX', 'DOT', 'POL', 'UNI', 'AAVE', 'ATOM', 'XLM', 'SHIB',
  'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'PEPE', 'BONK', 'FIL',
  'TON', 'INJ', 'RENDER', 'SEI', 'ONDO', 'ENA', 'HBAR', 'FET',
];
const QUOTES = ['USDT', 'USD', 'USDC'];
const GRANULARITY = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
const SEED = {
  BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], SOL: [184.76, 4.92], XRP: [2.18, -1.23],
  DOGE: [0.2184, -0.42], ADA: [0.728, 3.16], LTC: [92.4, 1.05], LINK: [17.85, 2.3],
  AVAX: [26.3, 5.4], DOT: [6.42, -0.85], POL: [0.51, 1.7], UNI: [9.85, -1.4],
  AAVE: [178.4, 2.9], ATOM: [6.85, 0.64], XLM: [0.372, 1.3], SHIB: [0.0000218, -2.1],
  NEAR: [5.6, 3.4], APT: [8.9, -0.75], ARB: [0.94, 2.2], OP: [1.72, 1.1],
  SUI: [2.85, 4.6], PEPE: [0.0000124, -3.2], BONK: [0.000021, 2.8], FIL: [4.85, -0.9],
  TON: [5.3, 0.45], INJ: [18.2, 6.1], RENDER: [7.6, 3.9], SEI: [0.42, -1.8],
  ONDO: [0.98, 2.5], ENA: [0.62, 4.1], HBAR: [0.182, 1.9], FET: [1.26, 5.2],
};
const NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin',
  ADA: 'Cardano', LTC: 'Litecoin', LINK: 'Chainlink', AVAX: 'Avalanche', DOT: 'Polkadot',
  POL: 'Polygon', UNI: 'Uniswap', AAVE: 'Aave', ATOM: 'Cosmos', XLM: 'Stellar',
  SHIB: 'Shiba Inu', NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  SUI: 'Sui', PEPE: 'Pepe', BONK: 'Bonk', FIL: 'Filecoin', TON: 'Toncoin',
  INJ: 'Injective', RENDER: 'Render', SEI: 'Sei', ONDO: 'Ondo', ENA: 'Ethena',
  HBAR: 'Hedera', FET: 'Fetch.ai',
};
const APY = {
  BTC: 2.8, ETH: 4.7, SOL: 6.9, XRP: 2.2, DOGE: 1.8, ADA: 5.1, LTC: 2.4, LINK: 4.3,
  AVAX: 7.1, DOT: 8.4, POL: 4.9, UNI: 3.7, AAVE: 4.1, ATOM: 9.6, XLM: 2.6, SHIB: 3.2,
  NEAR: 8.7, APT: 6.4, ARB: 3.4, OP: 3.9, SUI: 5.3, PEPE: 2.1, BONK: 2.9, FIL: 4.4,
  TON: 3.6, INJ: 10.8, RENDER: 4.2, SEI: 5.8, ONDO: 5.5, ENA: 6.1, HBAR: 3.3, FET: 5.2,
};
const APY_LOCKED = {
  BTC: 3.6, ETH: 6.2, SOL: 8.4, XRP: 3.1, DOGE: 2.6, ADA: 6.4, LTC: 3.2, LINK: 5.7,
  AVAX: 9.2, DOT: 11.6, POL: 6.3, UNI: 4.9, AAVE: 5.4, ATOM: 12.4, XLM: 3.5, SHIB: 4.4,
  NEAR: 11.2, APT: 8.1, ARB: 4.6, OP: 5.1, SUI: 6.9, PEPE: 3.0, BONK: 4.0, FIL: 5.8,
  TON: 4.8, INJ: 14.2, RENDER: 5.6, SEI: 7.5, ONDO: 7.1, ENA: 8.0, HBAR: 4.4, FET: 6.8,
};

function seededChange(symbol) {
  let hash = 0;
  for (const char of symbol) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return Number(((hash % 800) / 100 - 3.5).toFixed(2));
}

function fallbackMarkets() {
  return SYMBOLS.map((symbol) => {
    const [price, change] = SEED[symbol] ?? [1, seededChange(symbol)];
    return {
      symbol,
      name: NAMES[symbol],
      color: '#9A5BFF',
      soft: 'rgba(154,91,255,0.16)',
      mark: symbol.slice(0, 1),
      stakingApy: APY[symbol],
      stakingApyLocked: APY_LOCKED[symbol],
      price,
      change,
      high: price * 1.035,
      low: price * 0.968,
      volume: price * 28435,
      pair: `${symbol}-USDT`,
    };
  });
}

async function fetchCoinbase(route) {
  const hosts = ['https://api.exchange.coinbase.com', 'https://api.coinbase.com'];
  let lastError;
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${route}`, {
        headers: { 'User-Agent': 'MudrexxEarn/2.0' },
        cf: { cacheTtl: 30, cacheEverything: true },
      });
      if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Coinbase market provider unavailable');
}

async function loadStats() {
  const rows = await fetchCoinbase('/products/stats');
  const byId = new Map();
  for (const row of rows) {
    if (row && row.id) byId.set(row.id, row);
  }
  return byId;
}

function resolvePair(byId, symbol) {
  for (const quote of QUOTES) {
    const id = `${symbol}-${quote}`;
    if (byId.has(id)) return id;
  }
  return null;
}

/** GET /api/markets — Coinbase live quotes with a warm seed fallback. */
async function handleMarkets(request, env, ctx) {
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let body;
  try {
    const stats = await loadStats();
    const data = SYMBOLS.map((symbol) => {
      const pair = resolvePair(stats, symbol);
      const item = pair ? stats.get(pair) : null;
      const last = Number(item?.last || SEED[symbol]?.[0] || 1);
      const open = Number(item?.open || last);
      const change = open > 0 ? ((last - open) / open) * 100 : SEED[symbol]?.[1] || 0;
      return {
        symbol,
        name: NAMES[symbol],
        color: '#9A5BFF',
        soft: 'rgba(154,91,255,0.16)',
        mark: symbol.slice(0, 1),
        stakingApy: APY[symbol],
        stakingApyLocked: APY_LOCKED[symbol],
        price: last,
        change,
        high: Number(item?.high || last * 1.03),
        low: Number(item?.low || last * 0.97),
        volume: Number(item?.volume || last * 28435),
        pair: pair ?? `${symbol}-USDT`,
      };
    });
    body = json({ data, source: 'coinbase', cached: false });
  } catch (error) {
    body = json(
      {
        data: fallbackMarkets(),
        source: 'fallback',
        message: error instanceof Error ? error.message : 'Coinbase provider unavailable',
      },
      200
    );
  }
  ctx.waitUntil(caches.default.put(cacheKey, body.clone()));
  return body;
}

/** GET /api/market/klines?symbol=BTC&interval=1m — Coinbase candles. */
async function handleKlines(request, ctx) {
  const url = new URL(request.url);
  const symbol = String(url.searchParams.get('symbol') || 'BTC').toUpperCase();
  const interval = String(url.searchParams.get('interval') || '1m');
  const granularity = GRANULARITY[interval];
  if (!SYMBOLS.includes(symbol) || !granularity) {
    return json({ error: 'Unsupported market request' }, 400);
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.search = `?symbol=${symbol}&interval=${interval}`;
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let body;
  try {
    let pair = `${symbol}-USDT`;
    try {
      const stats = await loadStats();
      pair = resolvePair(stats, symbol) || `${symbol}-USD`;
    } catch {
      /* fall through to the default pair */
    }
    const rows = await fetchCoinbase(`/products/${pair}/candles?granularity=${granularity}`);
    const data = rows
      .map((row) => ({
        time: Number(row[0]) * 1000,
        low: Number(row[1]),
        high: Number(row[2]),
        open: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }))
      .reverse()
      .slice(-80);
    body = json({ data, source: 'coinbase', pair });
  } catch {
    const [start] = SEED[symbol] ?? [1, 0];
    const step = granularity * 1000;
    let price = start * 0.975;
    const data = Array.from({ length: 80 }, (_, index) => {
      const open = price;
      price = Math.max(0.0001, price * (1 + (Math.sin(index * 1.7) + Math.random() - 0.45) * 0.0028));
      return {
        time: Date.now() - (79 - index) * step,
        open,
        high: Math.max(open, price) * 1.002,
        low: Math.min(open, price) * 0.998,
        close: price,
        volume: 100 + Math.random() * 900,
      };
    });
    body = json({ data, source: 'fallback' });
  }
  ctx.waitUntil(caches.default.put(cacheKey, body.clone()));
  return body;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Native serverless market endpoints (Coinbase live, no backend needed).
    if (url.pathname === '/api/markets') return handleMarkets(request, env, ctx);
    if (url.pathname === '/api/market/klines') return handleKlines(request, ctx);
    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'mudrexx-earn-worker',
        status: 'healthy',
        source: 'cloudflare',
        timestamp: new Date().toISOString(),
      });
    }

    // Proxy backend API calls
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/a/') || url.pathname.startsWith('/s/')) {
      let backend;

      // Check KV first (change URL without redeploy)
      try {
        const kvValue = await env.KV?.get('config:backend-url');
        if (kvValue && kvValue.trim()) {
          backend = kvValue.trim();
        }
      } catch {}

      // Fall back to env var
      if (!backend) {
        backend = env.BACKEND_ORIGIN?.trim();
      }

      if (!backend) {
        return json(
          { error: 'Backend URL not configured. Set config:backend-url in mudrexx KV or BACKEND_ORIGIN var.' },
          503
        );
      }

      const target = new URL(backend);
      target.pathname = url.pathname;
      target.search = url.search;

      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('content-length');

      return fetch(target.toString(), {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
      });
    }

    // Serve the frontend
    return env.ASSETS.fetch(request);
  },
};
