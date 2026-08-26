export interface Env {
  ASSETS: Fetcher;
  /** KV namespace for persistent user/order storage. Optional — falls back to
   *  in-memory storage (state resets on redeploy) when not bound. */
  STORE?: KVNamespace;
  /** Optional: backend passthrough for paths this worker does not implement. */
  BACKEND?: Fetcher;
  BACKEND_ORIGIN?: string;
  /** Institute invitation codes (comma separated). Override the code defaults. */
  ADMIN_CODES?: string;
  SUPER_ADMIN_CODES?: string;
}

/**
 * Mudrexx Earn — Cloudflare Worker (full stack)
 *
 * 1. Serves the built SPA (../dist) with single-page-application fallback.
 * 2. Native market endpoints backed by Coinbase Exchange public data.
 * 3. The complete backend: invitation-only registration, bearer-token sign-in,
 *    wallet & frozen-funds control, the order engine (every order lands on the
 *    Instant Order page), and the admin / super admin control commands.
 * 4. Storage: the `STORE` KV namespace when bound; in-memory fallback otherwise.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=5',
    },
  });

const badRequest = (error: string) => json({ error }, 400);
const forbidden = (error: string) => json({ error }, 403);
const unauthorized = (error: string) => json({ error }, 401);
const notFound = (error: string) => json({ error }, 404);

const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `mx_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function randomInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) suffix += chars[byte % chars.length];
  return `MUD-${suffix}`;
}

// ---------------------------------------------------------------------------
// roles (institute invitation codes)
// ---------------------------------------------------------------------------
const DEFAULT_ADMIN_CODES = 'MUDREXX-ADMIN,ADMIN-2024,ADMIN777,MEDRIX888,ADMIN';
const DEFAULT_SUPER_CODES = 'MUDREXX-SUPER,SUPER-2024';

function parseCodes(raw: string | undefined, fallback: string): string[] {
  return String(raw || fallback)
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
}

function resolveRole(env: Env, code: unknown): 'super' | 'admin' | null {
  const normalized = String(code || '').trim().toLowerCase();
  if (!normalized) return null;
  if (parseCodes(env.SUPER_ADMIN_CODES, DEFAULT_SUPER_CODES).includes(normalized)) return 'super';
  if (parseCodes(env.ADMIN_CODES, DEFAULT_ADMIN_CODES).includes(normalized)) return 'admin';
  return null;
}

// ---------------------------------------------------------------------------
// user store (KV with in-memory fallback)
// ---------------------------------------------------------------------------
type OrderSide = 'up' | 'down';
type OrderCurrency = 'INR' | 'USDT';

interface TradeOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  amount: number;
  currency: OrderCurrency;
  accountType: 'real' | 'demo';
  status: 'open' | 'won' | 'lost' | 'cancelled';
  payoutPercent: number;
  durationSeconds: number;
  createdAt: number;
  expiresAt: number;
  entryPrice: number;
  exitPrice?: number;
  payout?: number;
  profit?: number;
  settledPercent?: number;
  settledAt?: string;
  settledBy?: string;
  userEmail?: string;
  userName?: string;
}

interface WalletTx {
  id: string;
  title: string;
  description: string;
  time: string;
  amount: number;
  currency: string;
  type: string;
  tone: string;
  status: string;
}

interface FrozenItem {
  id: string;
  title: string;
  category: 'order' | 'deposit' | 'staking' | 'withdrawal';
  reason: string;
  amount: number;
  currency: OrderCurrency;
  asset?: string;
  date: string;
  status: string;
  canRelease?: boolean;
  canApprove?: boolean;
  apy?: number;
}

interface UserRecord {
  name: string;
  email: string;
  phone?: string;
  preferredCurrency?: OrderCurrency;
  registeredAt: string;
  inviteCode: string;
  invitedBy?: string;
  invitedByType?: string;
  auth?: { token: string; createdAt: string };
  orders: TradeOrder[];
  wallet: {
    realBalance: number;
    realUsdtBalance: number;
    frozenBalance: number;
    frozenUsdtBalance: number;
    demoBalance: number;
    demoLinked: boolean;
    conversionRate: number;
    totalConverted: number;
    assetHoldings: Record<string, number>;
    frozenItems: FrozenItem[];
    transactions: WalletTx[];
    depositCreditedTotal?: number;
    depositCreditedTotalUsdt?: number;
  };
}

const memoryStore = new Map<string, UserRecord>();
let storageMode = 'memory';

const userKey = (email: string) => `u:${email}`;

async function getUser(email: string): Promise<UserRecord | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (STORE_KV) {
    const raw = await STORE_KV.get(userKey(normalized));
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  }
  return memoryStore.get(normalized) ?? null;
}

let STORE_KV: KVNamespace | null = null;

async function saveUser(user: UserRecord): Promise<void> {
  if (STORE_KV) await STORE_KV.put(userKey(user.email), JSON.stringify(user));
  else memoryStore.set(user.email, user);
}

async function listUsers(): Promise<UserRecord[]> {
  if (STORE_KV) {
    const users: UserRecord[] = [];
    let cursor: string | undefined;
    do {
      const page = await STORE_KV.list({ prefix: 'u:', cursor });
      for (const key of page.keys) {
        const raw = await STORE_KV.get(key.name);
        if (raw) {
          try {
            users.push(JSON.parse(raw) as UserRecord);
          } catch {
            /* skip corrupt record */
          }
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return users;
  }
  return [...memoryStore.values()];
}

function newWallet(): UserRecord['wallet'] {
  return {
    realBalance: 0,
    realUsdtBalance: 0,
    frozenBalance: 0,
    frozenUsdtBalance: 0,
    demoBalance: 10000,
    demoLinked: true,
    conversionRate: 0.1,
    totalConverted: 0,
    assetHoldings: { BTC: 0, ETH: 0, BNB: 0, SOL: 0, XRP: 0, ETC: 0, ADA: 0, DOGE: 0 },
    frozenItems: [],
    transactions: [],
  };
}

async function getOrCreateUser(email: string, name = ''): Promise<UserRecord> {
  const normalized = String(email || '').trim().toLowerCase();
  let user = await getUser(normalized);
  if (!user) {
    user = {
      name: name || normalized.split('@')[0],
      email: normalized,
      registeredAt: new Date().toISOString(),
      inviteCode: randomInviteCode(),
      orders: [],
      wallet: newWallet(),
    };
    await saveUser(user);
  }
  return user;
}

function issueToken(user: UserRecord): string {
  const token = randomToken();
  user.auth = { token, createdAt: new Date().toISOString() };
  return token;
}

async function userFromToken(request: Request): Promise<UserRecord | null> {
  const header = String(request.headers.get('authorization') || '');
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || String(request.headers.get('x-auth-token') || '').trim();
  if (!token) return null;
  for (const user of await listUsers()) {
    if (user.auth?.token === token) return user;
  }
  return null;
}

interface AuthResult {
  user?: UserRecord;
  error?: Response;
}

async function requireAuth(request: Request, url: URL, body: Record<string, unknown> | null): Promise<AuthResult> {
  const user = await userFromToken(request);
  if (!user) {
    return {
      error: unauthorized(
        'Sign in required. Sign up with an invitation code, then sign in and send Authorization: Bearer <token>.'
      ),
    };
  }
  const requested = String(url.searchParams.get('email') || body?.email || '')
    .trim()
    .toLowerCase();
  if (requested && requested !== user.email) {
    return { error: forbidden('This session can only access its own account.') };
  }
  if (!requested && body) body.email = user.email;
  return { user };
}

function walletStateSnapshot(user: UserRecord) {
  const w = user.wallet;
  return {
    realBalance: w.realBalance,
    realUsdtBalance: w.realUsdtBalance,
    frozenBalance: w.frozenBalance,
    frozenUsdtBalance: w.frozenUsdtBalance,
    totalBalance: w.realBalance + w.frozenBalance,
    totalUsdtBalance: w.realUsdtBalance + w.frozenUsdtBalance,
    creditTotal: w.demoBalance,
    depositCredited: Number(w.depositCreditedTotal || 0),
    depositCreditedUsdt: Number(w.depositCreditedTotalUsdt || 0),
  };
}

// ---------------------------------------------------------------------------
// market data (Coinbase public feeds)
// ---------------------------------------------------------------------------
const SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC', 'LINK',
  'AVAX', 'DOT', 'POL', 'UNI', 'AAVE', 'ATOM', 'XLM', 'SHIB',
  'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'PEPE', 'BONK', 'FIL',
  'TON', 'INJ', 'RENDER', 'SEI', 'ONDO', 'ENA', 'HBAR', 'FET',
];
const QUOTES = ['USDT', 'USD', 'USDC'];
const GRANULARITY: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
const SEED: Record<string, [number, number]> = {
  BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], SOL: [184.76, 4.92], XRP: [2.18, -1.23],
  DOGE: [0.2184, -0.42], ADA: [0.728, 3.16], LTC: [92.4, 1.05], LINK: [17.85, 2.3],
  AVAX: [26.3, 5.4], DOT: [6.42, -0.85], POL: [0.51, 1.7], UNI: [9.85, -1.4],
  AAVE: [178.4, 2.9], ATOM: [6.85, 0.64], XLM: [0.372, 1.3], SHIB: [0.0000218, -2.1],
  NEAR: [5.6, 3.4], APT: [8.9, -0.75], ARB: [0.94, 2.2], OP: [1.72, 1.1],
  SUI: [2.85, 4.6], PEPE: [0.0000124, -3.2], BONK: [0.000021, 2.8], FIL: [4.85, -0.9],
  TON: [5.3, 0.45], INJ: [18.2, 6.1], RENDER: [7.6, 3.9], SEI: [0.42, -1.8],
  ONDO: [0.98, 2.5], ENA: [0.62, 4.1], HBAR: [0.182, 1.9], FET: [1.26, 5.2],
};
const NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin',
  ADA: 'Cardano', LTC: 'Litecoin', LINK: 'Chainlink', AVAX: 'Avalanche', DOT: 'Polkadot',
  POL: 'Polygon', UNI: 'Uniswap', AAVE: 'Aave', ATOM: 'Cosmos', XLM: 'Stellar',
  SHIB: 'Shiba Inu', NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  SUI: 'Sui', PEPE: 'Pepe', BONK: 'Bonk', FIL: 'Filecoin', TON: 'Toncoin',
  INJ: 'Injective', RENDER: 'Render', SEI: 'Sei', ONDO: 'Ondo', ENA: 'Ethena',
  HBAR: 'Hedera', FET: 'Fetch.ai',
};
const APY: Record<string, number> = {
  BTC: 2.8, ETH: 4.7, SOL: 6.9, XRP: 2.2, DOGE: 1.8, ADA: 5.1, LTC: 2.4, LINK: 4.3,
  AVAX: 7.1, DOT: 8.4, POL: 4.9, UNI: 3.7, AAVE: 4.1, ATOM: 9.6, XLM: 2.6, SHIB: 3.2,
  NEAR: 8.7, APT: 6.4, ARB: 3.4, OP: 3.9, SUI: 5.3, PEPE: 2.1, BONK: 2.9, FIL: 4.4,
  TON: 3.6, INJ: 10.8, RENDER: 4.2, SEI: 5.8, ONDO: 5.5, ENA: 6.1, HBAR: 3.3, FET: 5.2,
};
const APY_LOCKED: Record<string, number> = {
  BTC: 3.6, ETH: 6.2, SOL: 8.4, XRP: 3.1, DOGE: 2.6, ADA: 6.4, LTC: 3.2, LINK: 5.7,
  AVAX: 9.2, DOT: 11.6, POL: 6.3, UNI: 4.9, AAVE: 5.4, ATOM: 12.4, XLM: 3.5, SHIB: 4.4,
  NEAR: 11.2, APT: 8.1, ARB: 4.6, OP: 5.1, SUI: 6.9, PEPE: 3.0, BONK: 4.0, FIL: 5.8,
  TON: 4.8, INJ: 14.2, RENDER: 5.6, SEI: 7.5, ONDO: 7.1, ENA: 8.0, HBAR: 4.4, FET: 6.8,
};

function fallbackMarkets() {
  return SYMBOLS.map((symbol) => {
    const [price, change] = SEED[symbol] ?? [1, 0];
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

async function fetchCoinbase(route: string): Promise<any> {
  const hosts = ['https://api.exchange.coinbase.com', 'https://api.coinbase.com'];
  let lastError: unknown;
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${route}`, {
        headers: { 'User-Agent': 'MudrexxEarn/2.0' },
        cf: { cacheTtl: 30, cacheEverything: true },
      } as RequestInit);
      if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Coinbase market provider unavailable');
}

async function loadStats(): Promise<Map<string, any>> {
  const rows = await fetchCoinbase('/products/stats');
  const byId = new Map<string, any>();
  for (const row of rows) if (row && row.id) byId.set(row.id, row);
  return byId;
}

function resolvePair(byId: Map<string, any>, symbol: string): string | null {
  for (const quote of QUOTES) {
    const id = `${symbol}-${quote}`;
    if (byId.has(id)) return id;
  }
  return null;
}

// Lightweight quote cache for order entry/exit pricing.
let quoteCache: Map<string, number> = new Map();
let quoteCacheAt = 0;

async function ensureQuotes(): Promise<void> {
  if (Date.now() - quoteCacheAt < 30000 && quoteCache.size) return;
  try {
    const stats = await loadStats();
    const next = new Map<string, number>();
    for (const symbol of SYMBOLS) {
      const pair = resolvePair(stats, symbol);
      const item = pair ? stats.get(pair) : null;
      next.set(symbol, Number(item?.last || SEED[symbol]?.[0] || 1));
    }
    quoteCache = next;
  } catch {
    if (!quoteCache.size) for (const symbol of SYMBOLS) quoteCache.set(symbol, SEED[symbol]?.[0] || 1);
  }
  quoteCacheAt = Date.now();
}

async function currentPrice(symbol: string): Promise<number> {
  await ensureQuotes();
  return quoteCache.get(symbol) ?? SEED[symbol]?.[0] ?? 1;
}

/** GET /api/markets — Coinbase live quotes with a warm seed fallback. */
async function handleMarkets(request: Request, ctx: ExecutionContext) {
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let body: Response;
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
async function handleKlines(request: Request, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const symbol = String(url.searchParams.get('symbol') || 'BTC').toUpperCase();
  const interval = String(url.searchParams.get('interval') || '1m');
  const granularity = GRANULARITY[interval];
  if (!SYMBOLS.includes(symbol) || !granularity) {
    return badRequest('Unsupported market request');
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.search = `?symbol=${symbol}&interval=${interval}`;
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let body: Response;
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
      .map((row: number[]) => ({
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

// ---------------------------------------------------------------------------
// order engine — every order lands on the Instant Order page
// ---------------------------------------------------------------------------
function findOrderById(orderId: string): Promise<{ user: UserRecord; order: TradeOrder } | null> {
  return listUsers().then((users) => {
    for (const user of users) {
      const order = (user.orders || []).find((entry) => entry.id === orderId);
      if (order) return { user, order };
    }
    return null;
  });
}

async function settleOrder(
  user: UserRecord,
  order: TradeOrder,
  outcome: 'win' | 'lose' | 'cancel',
  percentOverride?: number,
  settledBy?: string
): Promise<boolean> {
  if (order.status !== 'open') return false;

  const pct = Math.min(500, Math.max(0, Number(percentOverride ?? order.payoutPercent ?? 5)));
  const currency: OrderCurrency = order.currency === 'USDT' ? 'USDT' : 'INR';
  const sign = currency === 'INR' ? '₹' : '₮';
  const isReal = order.accountType === 'real';
  const profit = Number(((order.amount * pct) / 100).toFixed(2));
  order.exitPrice = await currentPrice(order.symbol);
  order.settledAt = new Date().toISOString();
  order.settledBy = settledBy || 'market';
  order.settledPercent = pct;

  if (outcome === 'cancel') {
    order.status = 'cancelled';
    order.payout = order.amount;
    if (isReal) {
      if (currency === 'INR') {
        user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - order.amount);
        user.wallet.realBalance += order.amount;
      } else {
        user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - order.amount);
        user.wallet.realUsdtBalance += order.amount;
      }
      user.wallet.frozenItems = user.wallet.frozenItems.filter((entry) => entry.id !== order.id);
    } else {
      user.wallet.demoBalance += order.amount;
    }
    user.wallet.transactions.unshift({
      id: `tx-${order.id}-cancel`,
      title: 'Order Cancelled',
      description: `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString('en-IN')} refunded to available balance`,
      time: 'Just now', amount: order.amount, currency, type: 'trade', tone: 'neutral', status: 'completed',
    });
    await saveUser(user);
    return true;
  }

  const won = outcome === 'win';
  order.status = won ? 'won' : 'lost';
  order.profit = won ? profit : 0;

  if (isReal) {
    if (currency === 'INR') user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - order.amount);
    else user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - order.amount);
    user.wallet.frozenItems = user.wallet.frozenItems.filter((entry) => entry.id !== order.id);
    if (won) {
      order.payout = Number((order.amount + profit).toFixed(2));
      if (currency === 'INR') user.wallet.realBalance += order.payout;
      else user.wallet.realUsdtBalance += order.payout;
    } else {
      order.payout = 0;
    }
  } else if (won) {
    order.payout = Number((order.amount + profit).toFixed(2));
    user.wallet.demoBalance += order.payout;
  } else {
    order.payout = 0;
  }

  user.wallet.transactions.unshift({
    id: `tx-${order.id}-${won ? 'win' : 'lose'}`,
    title: won ? 'Order Won' : 'Order Lost',
    description: won
      ? `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString('en-IN')} returned ${sign}${(order.payout || 0).toLocaleString('en-IN')} at ${pct}%`
      : `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString('en-IN')} closed at 0`,
    time: 'Just now', amount: won ? order.payout || 0 : order.amount, currency, type: 'trade',
    tone: won ? 'up' : 'down', status: 'completed',
  });

  await saveUser(user);
  return true;
}

async function autoSettleOrders(user: UserRecord): Promise<void> {
  for (const order of user.orders || []) {
    if (order.status !== 'open' || Date.now() < Number(order.expiresAt || 0)) continue;
    const exit = await currentPrice(order.symbol);
    const outcome = order.side === 'down' ? exit <= order.entryPrice : exit >= order.entryPrice;
    await settleOrder(user, order, outcome ? 'win' : 'lose', undefined, 'market');
  }
}

// ---------------------------------------------------------------------------
// endpoint handlers
// ---------------------------------------------------------------------------
interface Body {
  email?: string;
  [key: string]: unknown;
}

async function readBody(request: Request): Promise<Body> {
  try {
    return (await request.json()) as Body;
  } catch {
    return {};
  }
}

const emailOf = (url: URL, body: Body | null, fallback = '') =>
  String(url.searchParams.get('email') || body?.email || fallback || '').trim().toLowerCase();

async function handleRegister(body: Body) {
  const name = String(body.name || '');
  const email = String(body.email || '').trim().toLowerCase();
  const inviteCode = String(body.inviteCode || '').trim();
  if (!email) return badRequest('Email is required');

  // Stage 1 — registration is STRICTLY by institute-assigned invitation code.
  const codeRole = resolveRole(ENV_REF!, inviteCode);
  if (!inviteCode || !codeRole) {
    return forbidden('Registration is by invitation only. Enter the code assigned to you.');
  }

  const user = await getOrCreateUser(email, name);
  if (body.phone) user.phone = String(body.phone);
  if (body.preferredCurrency) user.preferredCurrency = String(body.preferredCurrency) === 'USDT' ? 'USDT' : 'INR';
  user.invitedBy = inviteCode.toUpperCase();
  user.invitedByType = codeRole === 'super' ? 'super' : 'admin';

  const token = issueToken(user);
  await saveUser(user);

  return json({
    success: true,
    message: 'User registered successfully with ₹0.00 initial balance',
    user,
    token,
  });
}

async function handleLogin(body: Body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return badRequest('Email is required');
  const user = await getOrCreateUser(email, String(body.name || ''));
  const token = issueToken(user);
  await saveUser(user);
  return json({ success: true, message: 'Welcome back', user, token });
}

async function handleMe(request: Request, url: URL) {
  const supplied =
    String(request.headers.get('authorization') || '') ||
    String(request.headers.get('x-auth-token') || '');
  const user = await userFromToken(request);
  const requested = String(url.searchParams.get('email') || request.headers.get('x-user-email') || '')
    .trim()
    .toLowerCase();
  if (!user) {
    if (supplied.trim()) return unauthorized('Invalid or expired session token. Sign in again.');
    return json({ success: true, user: null, anonymous: true });
  }
  if (requested && requested !== user.email) {
    return forbidden('This session can only access its own account.');
  }
  return json({ success: true, user });
}

async function handleProfile(user: UserRecord, body: Body) {
  if (body.name) user.name = String(body.name);
  if (body.phone !== undefined) user.phone = String(body.phone);
  if (body.preferredCurrency) user.preferredCurrency = String(body.preferredCurrency) === 'USDT' ? 'USDT' : 'INR';
  await saveUser(user);
  return json({ success: true, message: 'Profile updated', user });
}

async function handleWalletSummary(user: UserRecord) {
  const w = user.wallet;
  return json({
    success: true,
    summary: {
      realBalance: w.realBalance,
      realUsdtBalance: w.realUsdtBalance,
      frozenBalance: w.frozenBalance,
      frozenUsdtBalance: w.frozenUsdtBalance,
      totalNetRealBalance: w.realBalance + w.frozenBalance,
      demoBalance: w.demoBalance,
      demoLinked: w.demoLinked,
      conversionRate: w.conversionRate,
      totalConverted: w.totalConverted,
      assetHoldings: w.assetHoldings,
      frozenItemsCount: w.frozenItems.length,
      depositCredited: Number(w.depositCreditedTotal || 0),
      depositCreditedUsdt: Number(w.depositCreditedTotalUsdt || 0),
      creditTotal: w.demoBalance,
      totalBalance: w.realBalance + w.frozenBalance,
      totalUsdtBalance: w.realUsdtBalance + w.frozenUsdtBalance,
      frozenTotal: w.frozenBalance,
      frozenTotalUsdt: w.frozenUsdtBalance,
      openOrders: (user.orders || []).filter((entry) => entry.status === 'open').length,
    },
  });
}

async function handleOrderCreate(user: UserRecord, body: Body) {
  const symbol = String(body.symbol || 'BTC').toUpperCase();
  const side: OrderSide = body.side === 'down' ? 'down' : 'up';
  const currency: OrderCurrency = body.currency === 'USDT' ? 'USDT' : 'INR';
  const accountType = body.accountType === 'demo' ? 'demo' : 'real';
  const amt = Number(body.amount || 0);
  if (amt <= 0) return badRequest('Email and positive amount required');

  const dur = Math.min(86400, Math.max(5, Math.round(Number(body.durationSeconds) || 60)));
  const pct = Math.min(500, Math.max(1, Number(body.payoutPercent) || 5));
  const now = Date.now();
  const order: TradeOrder = {
    id: `ord-${now}`,
    symbol, side, amount: amt, currency, accountType,
    status: 'open',
    payoutPercent: pct,
    durationSeconds: dur,
    createdAt: now,
    expiresAt: now + dur * 1000,
    entryPrice: await currentPrice(symbol),
  };

  if (accountType === 'real') {
    const isINR = currency === 'INR';
    const available = isINR ? user.wallet.realBalance : user.wallet.realUsdtBalance;
    if (amt > available) {
      return badRequest(
        `Insufficient real balance. Available: ${isINR ? '₹' : '₮'}${available}. Convert demo credits or deposit funds.`
      );
    }
    if (isINR) {
      user.wallet.realBalance -= amt;
      user.wallet.frozenBalance += amt;
    } else {
      user.wallet.realUsdtBalance -= amt;
      user.wallet.frozenUsdtBalance += amt;
    }
    user.wallet.frozenItems.unshift({
      id: order.id,
      title: `${symbol} ${side === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`,
      category: 'order',
      reason: `Active limit order scenario on ${symbol}/USDT`,
      amount: amt,
      currency,
      asset: symbol,
      date: 'Just now',
      status: 'locked',
      canRelease: true,
    });
    user.wallet.transactions.unshift({
      id: `tx-ord-${now}`,
      title: `Order Placed (${side.toUpperCase()})`,
      description: `${currency} ${amt} held in frozen order escrow`,
      time: 'Just now', amount: amt, currency, type: 'trade', tone: 'down', status: 'pending',
    });
    user.orders.unshift(order);
    await saveUser(user);
    return json({
      success: true,
      message: `${currency === 'INR' ? '₹' : '₮'}${amt.toLocaleString('en-IN')} placed into Frozen Amount section`,
      orderId: order.id,
      order,
      status: 'locked',
      newAvailable: user.wallet.realBalance,
      newFrozen: user.wallet.frozenBalance,
      wallet: walletStateSnapshot(user),
    });
  }

  // Linked credit order — escrows practice credits.
  if (amt > user.wallet.demoBalance) {
    return badRequest(`Insufficient credit balance. Available: ${user.wallet.demoBalance.toLocaleString('en-IN')} credits.`);
  }
  user.wallet.demoBalance -= amt;
  user.orders.unshift(order);
  await saveUser(user);
  return json({
    success: true,
    message: `Order active — ${amt.toLocaleString('en-IN')} credits in play`,
    orderId: order.id,
    order,
    status: 'open',
    newDemoBalance: user.wallet.demoBalance,
    wallet: walletStateSnapshot(user),
  });
}

async function handleAdminControl(body: Body) {
  const role = resolveRole(ENV_REF!, body.code);
  if (!role) return forbidden('Invalid administrator code');
  const orderId = String(body.orderId || '');
  const action = String(body.action || '');
  if (!orderId || !['win', 'lose', 'cancel'].includes(action)) {
    return badRequest('orderId and action (win|lose|cancel) are required');
  }
  const found = await findOrderById(orderId);
  if (!found) return notFound('Order not found');
  if (found.order.status !== 'open') {
    return json({ error: `Order already ${found.order.status}`, order: found.order }, 409);
  }
  const ok = await settleOrder(found.user, found.order, action as 'win' | 'lose' | 'cancel', body.percent as number | undefined, role);
  return json({
    success: ok,
    role,
    order: found.order,
    wallet: walletStateSnapshot(found.user),
    message: `Order ${found.order.id} ${action === 'win' ? 'closed as WIN' : action === 'lose' ? 'closed as LOSE' : 'cancelled & refunded'} by ${role === 'super' ? 'super admin' : 'admin'}`,
  });
}

async function handleAdminUpdate(body: Body) {
  const role = resolveRole(ENV_REF!, body.code);
  if (!role) return forbidden('Invalid administrator code');
  const found = await findOrderById(String(body.orderId || ''));
  if (!found) return notFound('Order not found');
  const { user, order } = found;
  if (order.status !== 'open') {
    return json({ error: `Order already ${order.status} — only open orders can be changed`, order }, 409);
  }

  const changes: string[] = [];
  if (body.payoutPercent != null && Number.isFinite(Number(body.payoutPercent))) {
    order.payoutPercent = Math.min(500, Math.max(1, Number(body.payoutPercent)));
    changes.push(`payout % → ${order.payoutPercent}%`);
  }
  if (body.durationSeconds != null && Number.isFinite(Number(body.durationSeconds))) {
    order.durationSeconds = Math.min(86400, Math.max(5, Math.round(Number(body.durationSeconds))));
    order.expiresAt = Date.now() + order.durationSeconds * 1000;
    changes.push(`time → ${order.durationSeconds}s`);
  }
  const nextCurrency = body.currency === 'USDT' ? 'USDT' : body.currency === 'INR' ? 'INR' : null;
  if (nextCurrency && nextCurrency !== order.currency) {
    if (order.accountType === 'real') {
      if (order.currency === 'INR') {
        user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - order.amount);
        user.wallet.frozenUsdtBalance += order.amount;
      } else {
        user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - order.amount);
        user.wallet.frozenBalance += order.amount;
      }
      const item = user.wallet.frozenItems.find((entry) => entry.id === order.id);
      if (item) {
        item.currency = nextCurrency;
        item.title = `${order.symbol} ${order.side === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`;
      }
    }
    order.currency = nextCurrency;
    changes.push(`currency → ${nextCurrency}`);
  }
  if (!changes.length) {
    return badRequest('Nothing to update — provide currency, durationSeconds or payoutPercent');
  }
  await saveUser(user);
  return json({ success: true, role, order, changes, wallet: walletStateSnapshot(user) });
}

async function handleWalletAdjust(body: Body) {
  const role = resolveRole(ENV_REF!, body.code);
  if (role !== 'super') return forbidden('Super admin code required for wallet control');
  const fields: Record<string, keyof UserRecord['wallet']> = {
    real: 'realBalance', realUsdt: 'realUsdtBalance', frozen: 'frozenBalance',
    frozenUsdt: 'frozenUsdtBalance', demo: 'demoBalance',
  };
  const key = fields[String(body.field || '')];
  const delta = Number(body.delta);
  if (!body.email || !key || !Number.isFinite(delta)) {
    return badRequest('email, field (real|realUsdt|frozen|frozenUsdt|demo) and numeric delta are required');
  }
  const user = await getOrCreateUser(String(body.email));
  const next = Number((Number(user.wallet[key]) + delta).toFixed(2));
  if (next < 0) return badRequest(`Adjustment would make ${body.field} negative (current ${user.wallet[key]})`);
  user.wallet[key] = next;
  user.wallet.transactions.unshift({
    id: `tx-admin-${Date.now()}`,
    title: 'Balance Sync',
    description: `${body.field} balance reconciliation ${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-IN')}`,
    time: 'Just now',
    amount: Math.abs(delta),
    currency: String(body.field) === 'demo' || String(body.field).includes('Usdt') ? String(body.field).toUpperCase() : 'INR',
    type: 'adjust',
    tone: delta >= 0 ? 'up' : 'down',
    status: 'completed',
  });
  await saveUser(user);
  return json({ success: true, field: body.field, delta, wallet: walletStateSnapshot(user) });
}

async function handleInvitedUsers(url: URL) {
  const code = String(url.searchParams.get('code') || '').trim().toLowerCase();
  if (!code) return badRequest('Admin code is required');
  const role = resolveRole(ENV_REF!, code);
  if (!role) return forbidden('Invalid admin code');

  const inviteFilter = String(url.searchParams.get('inviteCode') || '').trim().toLowerCase();
  const all = (await listUsers()).filter((user) => user.invitedBy);
  const users = (inviteFilter ? all.filter((user) => String(user.invitedBy).toLowerCase() === inviteFilter) : all).map(
    (user) => ({
      name: user.name,
      email: user.email,
      phone: user.phone,
      registeredAt: user.registeredAt,
      invitedBy: user.invitedBy,
      invitedByType: user.invitedByType,
      realBalance: Number(user.wallet?.realBalance || 0),
      realUsdtBalance: Number(user.wallet?.realUsdtBalance || 0),
      frozenBalance: Number(user.wallet?.frozenBalance || 0),
      demoBalance: Number(user.wallet?.demoBalance || 0),
      openOrders: (user.orders || []).filter((entry) => entry.status === 'open').length,
      lastActivity: user.wallet?.transactions?.[0]?.time || '—',
    })
  );

  return json({
    success: true,
    code,
    inviteCode: inviteFilter || undefined,
    total: users.length,
    users,
    summary: {
      invitedAccounts: all.length,
      byAdminCode: all.filter((user) => user.invitedByType === 'admin' || user.invitedByType === 'super').length,
      byReferral: all.filter((user) => user.invitedByType === 'user').length,
      combinedRealBalance: users.reduce((sum, user) => sum + user.realBalance, 0),
    },
  });
}

let ENV_REF: Env | null = null;

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ENV_REF = env;
    STORE_KV = env.STORE ?? null;
    storageMode = env.STORE ? 'kv' : 'memory';
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // --- system & market --------------------------------------------------
    if (path === '/api/health') {
      return json({
        ok: true,
        service: 'mudrex-earn-worker',
        status: 'healthy',
        source: 'cloudflare',
        storage: storageMode,
        timestamp: new Date().toISOString(),
      });
    }
    if (path === '/api/markets') return handleMarkets(request, ctx);
    if (path === '/api/market/klines') return handleKlines(request, ctx);
    if (path === '/api' && method === 'GET') return json({ endpoints: apiCatalog() });
    if ((path === '/verify' || path === '/api/verify') && method === 'GET') {
      return json({ ok: true, status: 'verified', timestamp: new Date().toISOString() });
    }

    // --- auth --------------------------------------------------------------
    if (path === '/api/auth/register' && method === 'POST') return handleRegister(await readBody(request));
    if (path === '/api/auth/login' && method === 'POST') return handleLogin(await readBody(request));
    if (path === '/api/auth/me' && method === 'GET') return handleMe(request, url);

    // --- admin (code-authenticated, no token) ------------------------------
    if (path === '/api/admin/role' && method === 'GET') {
      const role = resolveRole(env, url.searchParams.get('code'));
      if (!role) return forbidden('Invalid administrator code');
      return json({ success: true, role });
    }
    if (path === '/api/admin/invited-users' && method === 'GET') return handleInvitedUsers(url);
    if (path === '/api/admin/users' && method === 'GET') {
      const role = resolveRole(env, url.searchParams.get('code'));
      if (!role) return forbidden('Invalid admin code');
      const users = (await listUsers())
        .map((user) => ({
          name: user.name,
          email: user.email,
          phone: user.phone,
          registeredAt: user.registeredAt,
          invitedBy: user.invitedBy || '',
          invitedByType: user.invitedByType || '',
          realBalance: Number(user.wallet?.realBalance || 0),
          demoBalance: Number(user.wallet?.demoBalance || 0),
        }))
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      return json({ success: true, total: users.length, users });
    }
    if (path === '/api/admin/orders' && method === 'GET') {
      const code = url.searchParams.get('code');
      if (code && !resolveRole(env, code)) return forbidden('Invalid admin code');
      const target = String(url.searchParams.get('userId') || url.searchParams.get('email') || '')
        .trim()
        .toLowerCase();
      const orders: unknown[] = [];
      for (const user of await listUsers()) {
        if (target && user.email !== target && user.name?.toLowerCase() !== target) continue;
        for (const item of user.wallet?.frozenItems || []) {
          if (item.category !== 'order') continue;
          orders.push({ ...item, userId: user.email, userName: user.name, userPhone: user.phone });
        }
      }
      return json({ success: true, orders, total: orders.length });
    }
    if (path === '/api/admin/orders/all' && method === 'GET') {
      const role = resolveRole(env, url.searchParams.get('code'));
      if (!role) return forbidden('Invalid administrator code');
      const orders: TradeOrder[] = [];
      for (const user of await listUsers()) {
        await autoSettleOrders(user);
        for (const order of user.orders || []) orders.push({ ...order, userEmail: user.email, userName: user.name });
      }
      orders.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      return json({ success: true, role, orders, total: orders.length });
    }
    if (path === '/api/admin/orders/control' && method === 'POST') return handleAdminControl(await readBody(request));
    if (path === '/api/admin/orders/update' && method === 'POST') return handleAdminUpdate(await readBody(request));
    if (path === '/api/admin/wallet/adjust' && method === 'POST') return handleWalletAdjust(await readBody(request));

    // --- everything below requires a signed-in bearer token ----------------
    // (API surface only — any non-API path is the SPA / access-link route)
    if (!path.startsWith('/api/')) {
      if ((path.startsWith('/a/') || path.startsWith('/s/')) && (env.BACKEND || env.BACKEND_ORIGIN?.trim())) {
        if (env.BACKEND && typeof env.BACKEND.fetch === 'function') return env.BACKEND.fetch(request);
        const upstream = new URL(env.BACKEND_ORIGIN!.trim());
        upstream.pathname = path;
        upstream.search = url.search;
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.delete('host');
        proxyHeaders.delete('content-length');
        return fetch(upstream.toString(), {
          method: request.method,
          headers: proxyHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'manual',
        });
      }
      return env.ASSETS.fetch(request);
    }
    const needsBody = method === 'POST' || method === 'PUT';
    const body = needsBody ? ((await readBody(request)) as Body) : null;
    const auth = await requireAuth(request, url, body);
    if (auth.error) return auth.error;
    const user = auth.user!;
    const email = emailOf(url, body, user.email);
    const target = (await getUser(email)) || user;

    if (path === '/api/user/profile' && method === 'PUT') return handleProfile(user, body!);

    if (path === '/api/wallet/summary' && method === 'GET') return handleWalletSummary(target);
    if (path === '/api/wallet/transactions' && method === 'GET') {
      return json({ success: true, transactions: target.wallet.transactions });
    }
    if (path === '/api/wallet/frozen' && method === 'GET') {
      return json({
        success: true,
        frozenBalance: target.wallet.frozenBalance,
        frozenUsdtBalance: target.wallet.frozenUsdtBalance,
        items: target.wallet.frozenItems,
      });
    }
    if (path === '/api/wallet/frozen/release' && method === 'POST') {
      const id = String(body!.id || '');
      if (!id) return badRequest('Email and Frozen Item ID are required');
      const index = target.wallet.frozenItems.findIndex((item) => item.id === id);
      if (index === -1) return notFound('Frozen item not found');
      const [item] = target.wallet.frozenItems.splice(index, 1);
      if (item.category === 'order') {
        const order = target.orders.find((entry) => entry.id === item.id);
        if (order && order.status === 'open') {
          order.status = 'cancelled';
          order.settledAt = new Date().toISOString();
          order.settledBy = 'user-release';
          order.payout = order.amount;
        }
      }
      if (item.currency === 'INR') {
        target.wallet.frozenBalance = Math.max(0, target.wallet.frozenBalance - item.amount);
        target.wallet.realBalance += item.amount;
      } else {
        target.wallet.frozenUsdtBalance = Math.max(0, target.wallet.frozenUsdtBalance - item.amount);
        target.wallet.realUsdtBalance += item.amount;
      }
      target.wallet.transactions.unshift({
        id: `tx-rel-${Date.now()}`,
        title: 'Frozen Funds Released',
        description: `${item.title} released back to Available Balance`,
        time: 'Just now', amount: item.amount, currency: item.currency, type: 'release', tone: 'up', status: 'completed',
      });
      await saveUser(target);
      return json({
        success: true,
        message: `${item.currency === 'INR' ? '₹' : '₮'}${item.amount.toLocaleString('en-IN')} released to Available Balance`,
        releasedAmount: item.amount,
        newRealBalance: target.wallet.realBalance,
        newFrozenBalance: target.wallet.frozenBalance,
      });
    }
    if (path === '/api/wallet/deposit/approve' && method === 'POST') {
      const id = String(body!.id || '');
      if (!id) return badRequest('Email and Deposit Item ID are required');
      const index = target.wallet.frozenItems.findIndex((item) => item.id === id);
      if (index === -1) return notFound('Deposit item not found');
      const [item] = target.wallet.frozenItems.splice(index, 1);
      const isINR = item.currency === 'INR';
      if (isINR) {
        target.wallet.depositCreditedTotal = Number(target.wallet.depositCreditedTotal || 0) + item.amount;
        target.wallet.frozenBalance = Math.max(0, target.wallet.frozenBalance - item.amount);
        target.wallet.realBalance += item.amount;
      } else {
        target.wallet.depositCreditedTotalUsdt = Number(target.wallet.depositCreditedTotalUsdt || 0) + item.amount;
        target.wallet.frozenUsdtBalance = Math.max(0, target.wallet.frozenUsdtBalance - item.amount);
        target.wallet.realUsdtBalance += item.amount;
      }
      target.wallet.transactions.unshift({
        id: `tx-app-${Date.now()}`,
        title: 'Deposit Verified & Unlocked',
        description: `${item.currency} ${item.amount} moved from Frozen to Available balance`,
        time: 'Just now', amount: item.amount, currency: item.currency, type: 'deposit', tone: 'up', status: 'completed',
      });
      await saveUser(target);
      return json({
        success: true,
        newRealBalance: target.wallet.realBalance,
        newFrozenBalance: target.wallet.frozenBalance,
      });
    }
    if (path === '/api/wallet/convert-demo' && method === 'POST') {
      const credits = Number(body!.demoCredits || 0);
      if (credits <= 0) return badRequest('Valid demoCredits amount required');
      if (credits > target.wallet.demoBalance) {
        return badRequest(`Insufficient demo credits. Available: ${target.wallet.demoBalance}`);
      }
      const rate = target.wallet.conversionRate || 0.1;
      const realGain = Number((credits * rate).toFixed(2));
      target.wallet.demoBalance -= credits;
      target.wallet.realBalance += realGain;
      target.wallet.totalConverted += realGain;
      target.wallet.transactions.unshift({
        id: `tx-cnv-${Date.now()}`,
        title: 'Demo Converted to Real INR',
        description: `${credits.toLocaleString('en-IN')} credits → ${inr(realGain)} real wallet funds`,
        time: 'Just now', amount: realGain, currency: 'INR', type: 'conversion', tone: 'up', status: 'completed',
      });
      await saveUser(target);
      return json({
        success: true,
        message: `Converted ${credits.toLocaleString('en-IN')} Demo Credits to ${inr(realGain)} Real INR`,
        convertedCredits: credits,
        realGain,
        newRealBalance: target.wallet.realBalance,
        newDemoBalance: target.wallet.demoBalance,
      });
    }
    if (path === '/api/wallet/claim-demo' && method === 'POST') {
      const grant = Number(body!.amount || 5000);
      if (grant <= 0) return badRequest('Valid amount required');
      target.wallet.demoBalance += grant;
      target.wallet.transactions.unshift({
        id: `tx-claim-${Date.now()}`,
        title: 'Practice Credits Granted',
        description: `+${grant.toLocaleString('en-IN')} credits added to your account`,
        time: 'Just now', amount: grant, currency: 'CREDITS', type: 'reward', tone: 'up', status: 'completed',
      });
      await saveUser(target);
      return json({ success: true, newDemoBalance: target.wallet.demoBalance });
    }
    if (path === '/api/wallet/link-demo' && method === 'POST') {
      target.wallet.demoLinked = body!.linked !== undefined ? Boolean(body!.linked) : true;
      await saveUser(target);
      return json({ success: true, linked: target.wallet.demoLinked });
    }
    if (path === '/api/wallet/demo/adjust' && method === 'POST') {
      const delta = Number(body!.delta || 0);
      const next = target.wallet.demoBalance + delta;
      if (next < 0) return badRequest('Insufficient practice credits');
      target.wallet.demoBalance = next;
      await saveUser(target);
      return json({
        success: true,
        message: `Demo balance adjusted by ${delta > 0 ? '+' : ''}${delta} credits`,
        delta,
        newDemoBalance: target.wallet.demoBalance,
      });
    }
    if (path === '/api/deposit/submit' && method === 'POST') {
      const amt = Number(body!.amount || 0);
      const rail = String(body!.rail || 'inr') === 'usdt' ? 'usdt' : 'inr';
      const method = String(body!.method || 'upi');
      const reference = String(body!.reference || '');
      if (amt <= 0) return badRequest('Email and positive amount required');
      const currency: OrderCurrency = rail === 'usdt' ? 'USDT' : 'INR';
      const depositId = `dep-${Date.now()}`;
      if (rail === 'usdt') target.wallet.frozenUsdtBalance += amt;
      else target.wallet.frozenBalance += amt;
      target.wallet.frozenItems.unshift({
        id: depositId,
        title: `${rail.toUpperCase()} Deposit (${method.toUpperCase()})`,
        category: 'deposit',
        reason: `Pending verification${reference ? ` · Ref: ${reference}` : ''}`,
        amount: amt,
        currency,
        date: 'Just now',
        status: 'processing',
        canRelease: true,
        canApprove: true,
      });
      target.wallet.transactions.unshift({
        id: `tx-dep-${Date.now()}`,
        title: `${rail.toUpperCase()} Deposit Submitted`,
        description: `${currency} ${amt.toLocaleString('en-IN')} submitted — held in Frozen Amount until verified`,
        time: 'Just now', amount: amt, currency, type: 'deposit', tone: 'neutral', status: 'pending',
      });
      await saveUser(target);
      return json({
        success: true,
        message: `${currency === 'INR' ? '₹' : '₮'}${amt.toLocaleString('en-IN')} deposit recorded in Frozen Amount section`,
        depositId,
        newFrozenBalance: target.wallet.frozenBalance,
      });
    }
    if (path === '/api/withdraw/submit' && method === 'POST') {
      const amt = Number(body!.amount || 0);
      if (amt <= 0) return badRequest('Email and positive amount required');
      if (amt > target.wallet.realBalance) {
        return badRequest(
          `Insufficient available balance. Available: ${inr(target.wallet.realBalance)}. Note: Frozen funds (${inr(target.wallet.frozenBalance)}) cannot be withdrawn until released.`
        );
      }
      target.wallet.realBalance -= amt;
      target.wallet.transactions.unshift({
        id: `tx-wdr-${Date.now()}`,
        title: 'Withdrawal Processed',
        description: `${inr(amt)} withdrawal to ${String(body!.destination || 'saved destination')}`,
        time: 'Just now', amount: amt, currency: 'INR', type: 'withdrawal', tone: 'down', status: 'completed',
      });
      await saveUser(target);
      return json({
        success: true,
        message: `${inr(amt)} withdrawal processed from Available Balance`,
        amount: amt,
        remainingAvailable: target.wallet.realBalance,
      });
    }
    if (path === '/api/orders/create' && method === 'POST') return handleOrderCreate(target, body!);
    if (path === '/api/orders/list' && method === 'GET') {
      await autoSettleOrders(target);
      return json({
        success: true,
        orders: target.orders || [],
        total: (target.orders || []).length,
        wallet: walletStateSnapshot(target),
      });
    }
    if (path === '/api/orders/status' && method === 'GET') {
      const orderId = url.searchParams.get('orderId');
      if (!email && !orderId) return badRequest('Email or orderId is required');
      const orders = (target.wallet.frozenItems || []).filter((item) => item.category === 'order');
      if (orderId) {
        const order = orders.find((entry) => entry.id === orderId);
        if (!order) return notFound('Order not found');
        return json({ success: true, order, status: order.status });
      }
      return json({ success: true, orders, total: orders.length });
    }
    if (path === '/api/staking/stake' && method === 'POST') {
      const amt = Number(body!.amount || 0);
      const asset = String(body!.asset || 'ETH');
      const apy = Number(body!.apy || 4.7);
      if (amt <= 0) return badRequest('Email and positive amount required');
      if (amt > target.wallet.realBalance) {
        return badRequest(`Insufficient available balance. Available: ${inr(target.wallet.realBalance)}`);
      }
      target.wallet.realBalance -= amt;
      target.wallet.frozenBalance += amt;
      target.wallet.frozenItems.unshift({
        id: `stk-${Date.now()}`,
        title: `Flexible ${asset} Staking Vault`,
        category: 'staking',
        reason: `Accruing ${apy}% APY yield`,
        amount: amt,
        currency: 'INR',
        asset,
        date: 'Just now',
        status: 'accruing',
        canRelease: true,
        apy,
      });
      target.wallet.transactions.unshift({
        id: `tx-stk-${Date.now()}`,
        title: `Staked in ${asset} Vault`,
        description: `${inr(amt)} locked in flexible earn at ${apy}% APY`,
        time: 'Just now', amount: amt, currency: 'INR', type: 'stake', tone: 'neutral', status: 'completed',
      });
      await saveUser(target);
      return json({
        success: true,
        message: `${inr(amt)} staked in Flexible ${asset} Vault (Held in Frozen Balance)`,
        vaultId: `stk-${Date.now()}`,
        newAvailable: target.wallet.realBalance,
        newFrozen: target.wallet.frozenBalance,
      });
    }

    // --- optional backend passthrough for anything else under /api --------
    if (path.startsWith('/api/') || path.startsWith('/a/') || path.startsWith('/s/')) {
      if (env.BACKEND && typeof env.BACKEND.fetch === 'function') return env.BACKEND.fetch(request);
      if (env.BACKEND_ORIGIN?.trim()) {
        const upstream = new URL(env.BACKEND_ORIGIN.trim());
        upstream.pathname = path;
        upstream.search = url.search;
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('content-length');
        return fetch(upstream.toString(), {
          method: request.method,
          headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'manual',
        });
      }
      return json({ error: `Endpoint not found: ${method} ${path}` }, 404);
    }

    // --- the frontend ------------------------------------------------------
    return env.ASSETS.fetch(request);
  },
};

function apiCatalog() {
  return {
    health: 'GET /api/health',
    markets: 'GET /api/markets',
    klines: 'GET /api/market/klines?symbol=BTC&interval=1m',
    auth: {
      register: 'POST /api/auth/register {inviteCode REQUIRED — institute codes only}',
      login: 'POST /api/auth/login -> bearer token',
      me: 'GET /api/auth/me (Authorization: Bearer <token>)',
      updateProfile: 'PUT /api/user/profile (auth)',
    },
    admin: {
      role: 'GET /api/admin/role?code=...',
      users: 'GET /api/admin/users?code=...',
      invitedUsers: 'GET /api/admin/invited-users?code=...&inviteCode=<optional code filter>',
      orders: 'GET /api/admin/orders?userId=...&code=...',
      allOrders: 'GET /api/admin/orders/all?code=...',
      orderControl: 'POST /api/admin/orders/control {code,orderId,action:win|lose|cancel,percent?}',
      orderUpdate: 'POST /api/admin/orders/update {code,orderId,currency?,durationSeconds?,payoutPercent?}',
      walletAdjust: 'POST /api/admin/wallet/adjust {code,email,field:real|realUsdt|frozen|frozenUsdt|demo,delta} [super admin only]',
    },
    wallet: {
      summary: 'GET /api/wallet/summary (auth)',
      transactions: 'GET /api/wallet/transactions (auth)',
      frozen: 'GET /api/wallet/frozen (auth)',
      releaseFrozen: 'POST /api/wallet/frozen/release (auth)',
      approveDeposit: 'POST /api/wallet/deposit/approve (auth)',
      convertDemo: 'POST /api/wallet/convert-demo (auth)',
      claimDemo: 'POST /api/wallet/claim-demo (auth)',
      linkDemo: 'POST /api/wallet/link-demo (auth)',
      adjustDemo: 'POST /api/wallet/demo/adjust (auth)',
    },
    deposit: 'POST /api/deposit/submit (auth)',
    withdraw: 'POST /api/withdraw/submit (auth)',
    orders: {
      create: 'POST /api/orders/create (auth)',
      status: 'GET /api/orders/status?orderId=...&email=... (auth)',
      list: 'GET /api/orders/list (auth)',
    },
    staking: { stake: 'POST /api/staking/stake (auth)' },
  };
}
