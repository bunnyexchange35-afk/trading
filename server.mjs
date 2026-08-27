import express from 'express';
import crypto from 'node:crypto';
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
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'server', 'data');
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

// ============================================================================
// 2.7 SESSION TOKENS & SIGN-IN ENFORCEMENT
// ============================================================================
// Stage 1 (sign up): registration requires a valid invitation code (an admin
// code or an existing user's referral code).
// Stage 2 (sign in): login issues a bearer token; every wallet / order /
// deposit / staking call must carry `Authorization: Bearer <token>` and can
// only touch the account that token belongs to.

function issueToken(user) {
  const token = `mx_${crypto.randomBytes(24).toString('hex')}`;
  user.auth = { token, createdAt: new Date().toISOString() };
  persist();
  return token;
}

function userFromToken(req) {
  const header = String(req.headers?.authorization || '');
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || String(req.headers?.['x-auth-token'] || req.query?.token || '').trim();
  if (!token) return null;
  for (const user of userDb.values()) {
    if (user.auth?.token && user.auth.token === token) return user;
  }
  return null;
}

function requireAuth(req, res, next) {
  const user = userFromToken(req);
  if (!user) {
    return res.status(401).json({
      error: 'Sign in required. Sign up with an invitation code, then sign in and send Authorization: Bearer <token>.',
    });
  }
  const requested = String(req.query?.email || req.body?.email || '').trim().toLowerCase();
  if (requested && requested !== user.email) {
    return res.status(403).json({ error: 'This session can only access its own account.' });
  }
  // Default the account selector to the token owner.
  if (!requested) {
    if (req.query) req.query.email = user.email;
    if (req.body) req.body.email = user.email;
  }
  req.authUser = user;
  user.lastActivityAt = new Date().toISOString();
  next();
}

function getOrCreateUser(email, name = '') {
  const normalized = String(email || 'demo@mudrexx.com').trim().toLowerCase();
  if (!userDb.has(normalized)) {    // New user registration starts with ZERO balance and 10,000 demo credits
    userDb.set(normalized, {
      id: `USR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      username: normalized.split('@')[0].replace(/[^a-z0-9._-]/g, '') || `trader${Date.now()}`,
      name: name || normalized.split('@')[0],
      email: normalized,
      phone: '',
      preferredCurrency: 'INR',
      registeredAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      status: 'active',
      inviteCode: generateInviteCode(),
      invitedBy: '',
      invitedByType: '',
      tasks: [],
      supportTickets: [],
      creditHistory: [],
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
  // Backfill account metadata for records created before these fields existed.
  if (user) {
    if (!user.id) user.id = `USR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    if (!user.username) user.username = normalized.split('@')[0].replace(/[^a-z0-9._-]/g, '') || `trader${Date.now()}`;
    if (!user.status) user.status = 'active';
    if (!user.lastActivityAt) user.lastActivityAt = user.registeredAt || new Date().toISOString();
    if (!Array.isArray(user.tasks)) user.tasks = [];
    if (!Array.isArray(user.supportTickets)) user.supportTickets = [];
    if (!Array.isArray(user.creditHistory)) user.creditHistory = [];
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
        register: 'POST /api/auth/register {inviteCode REQUIRED}',
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
      account: {
        statement: 'GET /api/account/statement?email=...',
        proof: 'GET /api/account/proof?email=...',
        agreement: 'GET /api/account/agreement?email=...',
      },
      studentDesk: {
        orderConfig: 'GET /api/order/config (also /api/order/assets, /api/order/currencies, /api/order/durations)',
        tasks: 'GET /api/tasks (auth)',
        creditScore: 'GET /api/credit-score, GET /api/credit-score/history (auth)',
        accountSnapshot: 'GET /api/user/account (auth)',
        marketDetail: 'GET /api/markets/:symbol, /api/markets/:symbol/ohlcv, /api/markets/:symbol/analysis',
        support: 'GET/POST /api/support/tickets, POST /api/withdrawal/support (auth)',
        notifications: 'GET /api/notifications (auth)',
        documents: 'GET /api/documents, GET /api/account/invoice (auth)',
        nova: 'GET /api/nova/status, POST /api/nova/chat (auth)',
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
// 2.8 SIGN-IN ENFORCEMENT — protected API surface
// ============================================================================
// Everything below this mount requires a valid bearer token from
// POST /api/auth/login (or the token returned by registration):
//   Authorization: Bearer <token>
// Admin control endpoints (/api/admin/*) authenticate with admin codes.
app.use(['/api/wallet', '/api/orders', '/api/deposit', '/api/withdraw', '/api/staking', '/api/user', '/api/account'], requireAuth);

// ============================================================================
// 3. AUTH & PROFILE APIS
// ============================================================================

// Register new user -> balance is strictly ZERO
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, preferredCurrency, inviteCode } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Stage 1 — registration is STRICTLY by institute-assigned invitation code
  // (ADMIN_CODES / SUPER_ADMIN_CODES). No other code is accepted, user
  // referral codes do not grant registration, and codes are never issued by
  // the app itself — each participant receives their code from the institute.
  const normalized = email.trim().toLowerCase();
  const codeRole = resolveRole(inviteCode);
  if (!String(inviteCode || '').trim() || !codeRole) {
    return res.status(403).json({ error: 'Registration is by invitation only. Enter the code assigned to you.' });
  }

  const user = getOrCreateUser(normalized, name);
  if (phone) user.phone = phone;
  if (preferredCurrency) user.preferredCurrency = preferredCurrency;

  user.invitedBy = String(inviteCode).trim().toUpperCase();
  user.invitedByType = codeRole === 'super' ? 'super' : 'admin';

  persist();

  res.json({
    success: true,
    message: 'User registered successfully with ₹0.00 initial balance',
    user,
    token: issueToken(user),
  });
});

// Admin / invitation panel: list every account that registered through an
// invitation code. Optional ?inviteCode=<code> filters to one specific code
// (an admin code or a user's referral code).
app.get('/api/admin/invited-users', (req, res) => {
  const code = normalizeInviteCode(req.query.code);
  if (!code) return res.status(400).json({ error: 'Admin code is required' });
  if (resolveRole(code) !== 'admin' && !adminCodes.includes(code)) {
    return res.status(403).json({ error: 'Invalid admin code' });
  }

  const inviteFilter = String(req.query.inviteCode || '').trim();
  const inviteFilterNormalized = normalizeInviteCode(inviteFilter);

  const all = [...userDb.values()].filter((user) => user.invitedBy);
  const users = (inviteFilterNormalized
    ? all.filter((user) => normalizeInviteCode(user.invitedBy) === inviteFilterNormalized)
    : all
  ).map((user) => ({
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
  }));

  res.json({
    success: true,
    code,
    inviteCode: inviteFilter || undefined,
    total: users.length,
    users,
    summary: {
      invitedAccounts: all.length,
      byAdminCode: all.filter((user) => user.invitedByType === 'admin').length,
      byReferral: all.filter((user) => user.invitedByType === 'user').length,
      combinedRealBalance: users.reduce((sum, user) => sum + user.realBalance, 0),
    },
  });
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
    token: issueToken(user),
  });
});

// Current User Profile — token-based. Without a token this answers
// "anonymous" (nobody is signed in); with a token it returns that account.
app.get('/api/auth/me', (req, res) => {
  const supplied =
    String(req.headers?.authorization || '') ||
    String(req.headers?.['x-auth-token'] || '') ||
    String(req.query?.token || '');
  const user = userFromToken(req);
  const requested = String(req.query.email || req.headers['x-user-email'] || '').trim().toLowerCase();
  if (!user) {
    if (supplied.trim()) return res.status(401).json({ error: 'Invalid or expired session token. Sign in again.' });
    return res.json({ success: true, user: null, anonymous: true });
  }
  if (requested && requested !== user.email) {
    return res.status(403).json({ error: 'This session can only access its own account.' });
  }
  res.json({ success: true, user: decorateUser(user) });
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
      // Funds held pending verification (deposits not yet credited).
      pendingAmount: (w.frozenItems || [])
        .filter((item) => item.category === 'deposit' && item.status === 'processing')
        .reduce((sum, item) => sum + (item.currency === 'INR' ? Number(item.amount) || 0 : 0), 0),
      pendingAmountUsdt: (w.frozenItems || [])
        .filter((item) => item.category === 'deposit' && item.status === 'processing')
        .reduce((sum, item) => sum + (item.currency === 'USDT' ? Number(item.amount) || 0 : 0), 0),
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

// ============================================================================
// 8.5 ACCOUNT STATEMENT & PROOF OF ACCOUNT APIS
// ============================================================================

// Account Statement - returns comprehensive transaction history with metadata
app.get('/api/account/statement', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = userDb.get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const w = user.wallet;
  const now = new Date();
  const statementId = `STMT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  // Generate statement data
  const statement = {
    statementId,
    generatedAt: now.toISOString(),
    accountHolder: {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      registeredAt: user.registeredAt,
      inviteCode: user.inviteCode || '',
    },
    balances: {
      realBalance: w.realBalance,
      realUsdtBalance: w.realUsdtBalance,
      frozenBalance: w.frozenBalance,
      frozenUsdtBalance: w.frozenUsdtBalance,
      demoBalance: w.demoBalance,
      totalRealBalance: w.realBalance + w.frozenBalance,
      totalUsdtBalance: w.realUsdtBalance + w.frozenUsdtBalance,
      totalConverted: w.totalConverted,
    },
    frozenItems: w.frozenItems.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      date: item.date,
      reason: item.reason,
    })),
    transactions: w.transactions.map(tx => ({
      id: tx.id,
      title: tx.title,
      description: tx.description,
      time: tx.time,
      amount: tx.amount,
      currency: tx.currency,
      type: tx.type,
      tone: tx.tone,
      status: tx.status,
    })),
    assetHoldings: w.assetHoldings,
    summary: {
      totalTransactions: w.transactions.length,
      totalDeposits: w.transactions.filter(t => t.type === 'deposit').length,
      totalWithdrawals: w.transactions.filter(t => t.type === 'withdrawal').length,
      totalConversions: w.transactions.filter(t => t.type === 'conversion').length,
      totalTrades: w.transactions.filter(t => t.type === 'trade').length,
    },
  };

  res.json({ success: true, statement });
});

// Proof of Account - returns account verification details
app.get('/api/account/proof', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = userDb.get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const w = user.wallet;
  const now = new Date();
  const proofId = `PROOF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const proof = {
    proofId,
    issuedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    platform: 'Mudrexx Earn',
    accountHolder: {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      registeredAt: user.registeredAt,
      inviteCode: user.inviteCode || '',
      invitedBy: user.invitedBy || '',
      invitedByType: user.invitedByType || '',
    },
    accountStatus: {
      isActive: true,
      isVerified: true,
      kycStatus: 'completed',
      accountType: 'standard',
    },
    balances: {
      realBalance: w.realBalance,
      realUsdtBalance: w.realUsdtBalance,
      frozenBalance: w.frozenBalance,
      frozenUsdtBalance: w.frozenUsdtBalance,
      demoBalance: w.demoBalance,
      totalRealBalance: w.realBalance + w.frozenBalance,
      totalUsdtBalance: w.realUsdtBalance + w.frozenUsdtBalance,
    },
    verification: {
      emailVerified: true,
      phoneVerified: !!user.phone,
      twoFactorEnabled: false,
      lastLogin: now.toISOString(),
      accountAge: Math.floor((now.getTime() - new Date(user.registeredAt).getTime()) / (1000 * 60 * 60 * 24)),
    },
    disclaimer: 'This document serves as proof of account existence and status on the Mudrexx Earn platform. It does not constitute financial advice or guarantee of returns.',
  };

  res.json({ success: true, proof });
});

// Account Agreement - returns terms and user acceptance
app.get('/api/account/agreement', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = userDb.get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const now = new Date();
  const agreementId = `AGR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const agreement = {
    agreementId,
    issuedAt: now.toISOString(),
    platform: 'Mudrexx Earn',
    accountHolder: {
      name: user.name,
      email: user.email,
      registeredAt: user.registeredAt,
    },
    terms: {
      version: '1.0',
      acceptedAt: user.registeredAt,
      lastUpdated: '2024-01-01T00:00:00.000Z',
      sections: [
        {
          title: 'Account Terms',
          content: 'Your account is subject to the platform rules and regulations. You agree to use the platform responsibly and in accordance with applicable laws.',
        },
        {
          title: 'Trading Risks',
          content: 'Trading involves risk of loss. Past performance does not guarantee future results. You should only trade with funds you can afford to lose.',
        },
        {
          title: 'Demo Account',
          content: 'Demo credits are for practice purposes only and cannot be withdrawn directly. They can be converted to real balance at the platform\'s conversion rate.',
        },
        {
          title: 'Fees and Charges',
          content: 'The platform may charge fees for certain transactions. All fees will be clearly displayed before you confirm any transaction.',
        },
        {
          title: 'Privacy Policy',
          content: 'Your personal information is protected under our privacy policy. We do not share your data with third parties without your consent.',
        },
      ],
    },
    userAcceptance: {
      hasAccepted: true,
      acceptedAt: user.registeredAt,
      ipAddress: 'Recorded at registration',
      userAgent: 'Recorded at registration',
    },
    disclaimer: 'This agreement is between you and Mudrexx Earn. By using the platform, you agree to these terms and conditions.',
  };

  res.json({ success: true, agreement });
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
// 8.5 STUDENT DESK EXTENSIONS — order config, tasks, credit score, market
// detail & analysis, support tickets, withdrawal→support, notifications,
// documents catalog/invoice and the NOVA copilot.
//
// These routes mirror the mudrexxback contract. In production the Cloudflare
// worker serves the SPA and passes unimplemented /api paths through to the
// bound backend (service binding BACKEND or BACKEND_ORIGIN); locally this
// Express server is the provider.
// ============================================================================

// ---- order desk configuration (backend-controlled; override with ORDER_CONFIG_JSON)
const defaultOrderConfig = {
  enabled: true,
  accountTypes: ['real', 'demo'],
  assets: symbols.map((symbol) => ({ symbol, name: assets[symbol][0], enabled: true })),
  currencies: [
    { code: 'INR', enabled: true, minAmount: 100, maxAmount: 500000, quickAmounts: [500, 1000, 2500, 5000] },
    { code: 'USDT', enabled: true, minAmount: 1, maxAmount: 10000, quickAmounts: [10, 25, 50, 100] },
  ],
  durations: [30, 60, 180, 300],
  payoutPercents: [3, 5, 10],
  defaultDuration: 60,
  defaultPayoutPercent: 5,
  settlement: {
    mode: 'expiry',
    description: 'Orders settle automatically at expiry against the live market price. Admins may resolve an order early (WIN / LOSE / CANCEL) from the control panel.',
    frozenUntilSettlement: true,
  },
};

function orderConfig() {
  const raw = process.env.ORDER_CONFIG_JSON;
  if (!raw) return defaultOrderConfig;
  try {
    return { ...defaultOrderConfig, ...JSON.parse(raw) };
  } catch {
    return defaultOrderConfig;
  }
}

app.get('/api/order/config', (_req, res) => res.json({ success: true, config: orderConfig() }));
app.get('/api/order/assets', (_req, res) =>
  res.json({ success: true, assets: orderConfig().assets.filter((item) => item.enabled !== false) })
);
app.get('/api/order/currencies', (_req, res) =>
  res.json({ success: true, currencies: orderConfig().currencies.filter((item) => item.enabled !== false) })
);
app.get('/api/order/durations', (_req, res) => res.json({ success: true, durations: orderConfig().durations }));

// ---- server-side credit score & user category (the frontend never computes these)
function creditStatusFor(score) {
  if (score >= 800) return 'excellent';
  if (score >= 700) return 'good';
  if (score >= 600) return 'fair';
  return 'poor';
}

function computeCreditScore(user) {
  const orders = user.orders || [];
  const settled = orders.filter((entry) => entry.status === 'won' || entry.status === 'lost');
  const wins = orders.filter((entry) => entry.status === 'won').length;
  const tasksDone = (user.tasks || []).filter((task) => task.status === 'completed').length;
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(user.registeredAt || Date.now()).getTime()) / 86400000)
  );
  const deposits = Number(user.wallet?.depositCreditedTotal || 0);

  let score = 420;
  score += Math.min(120, settled.length * 6);           // activity
  if (settled.length) score += Math.min(120, Math.round((wins / settled.length) * 120)); // outcomes
  score += Math.min(90, tasksDone * 15);                // task completion
  score += Math.min(90, Math.floor(ageDays / 7) * 10);  // account age
  if (deposits >= 100000) score += 60;
  else if (deposits >= 25000) score += 35;
  else if (deposits > 0) score += 15;
  score = Math.max(300, Math.min(900, Math.round(score)));

  return { score, status: creditStatusFor(score) };
}

function computeCategory(user) {
  if (user.status === 'restricted') return 'Restricted';
  const last = new Date(user.lastActivityAt || user.registeredAt || 0).getTime();
  if (Date.now() - last > 30 * 86400000) return 'Inactive';
  const orders = user.orders || [];
  const settled = orders.filter((entry) => entry.status === 'won' || entry.status === 'lost');
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(user.registeredAt || Date.now()).getTime()) / 86400000));
  const deposits = Number(user.wallet?.depositCreditedTotal || 0);
  if (ageDays < 7 && settled.length === 0) return 'New';
  if (deposits >= 100000) return 'VIP';
  if (deposits >= 25000) return 'High Value';
  if (computeCreditScore(user).score < 500) return 'At Risk';
  return 'Active';
}

function currentCredit(user) {
  const { score, status } = computeCreditScore(user);
  const history = Array.isArray(user.creditHistory) ? user.creditHistory : [];
  const last = history[0];
  if (!last || last.score !== score) {
    history.unshift({ score, status, at: new Date().toISOString() });
    user.creditHistory = history.slice(0, 24);
    persist();
  }
  return { score, status, updatedAt: user.creditHistory[0].at };
}

// Account snapshot attached to auth responses (computed fields only — never persisted).
function decorateUser(user) {
  return {
    ...user,
    category: computeCategory(user),
    creditScore: currentCredit(user),
    adminUserCode: user.invitedByType === 'admin' || user.invitedByType === 'super' ? user.invitedBy : '',
  };
}

// ---- student tasks (admin/backend-controlled; the student only reads them)
function ensureTasks(user) {
  if (Array.isArray(user.tasks) && user.tasks.length) return;
  const start = new Date(user.registeredAt || Date.now()).getTime();
  const day = 86400000;
  user.tasks = [
    {
      id: `task-${user.id || user.email}-1`,
      title: 'Complete your profile',
      description: 'Add your mobile number and preferred currency so the desk can personalise your experience.',
      category: 'Account',
      priority: 'high',
      status: 'in_progress',
      createdAt: new Date(start).toISOString(),
      dueDate: new Date(start + 3 * day).toISOString(),
      completedAt: null,
    },
    {
      id: `task-${user.id || user.email}-2`,
      title: 'Place your first practice order',
      description: 'Use demo credits on the Instant Order desk to understand direction, duration and payout.',
      category: 'Trading',
      priority: 'medium',
      status: 'pending',
      createdAt: new Date(start).toISOString(),
      dueDate: new Date(start + 7 * day).toISOString(),
      completedAt: null,
    },
    {
      id: `task-${user.id || user.email}-3`,
      title: 'Review the account agreement',
      description: 'Download the Account Agreement from your profile documents area and accept the trading terms.',
      category: 'Documents',
      priority: 'low',
      status: 'pending',
      createdAt: new Date(start).toISOString(),
      dueDate: new Date(start + 14 * day).toISOString(),
      completedAt: null,
    },
    {
      id: `task-${user.id || user.email}-4`,
      title: 'Secure your account',
      description: 'Enable login alerts and keep your invitation code private. Support never asks for OTPs.',
      category: 'Security',
      priority: 'medium',
      status: 'completed',
      createdAt: new Date(start).toISOString(),
      dueDate: new Date(start + 5 * day).toISOString(),
      completedAt: new Date(start + 1 * day).toISOString(),
    },
  ];
  persist();
}

app.get('/api/tasks', requireAuth, (req, res) => {
  const user = req.authUser;
  ensureTasks(user);
  autoSettleOrders(user);
  const now = Date.now();
  const tasks = (user.tasks || []).map((task) => {
    const overdue = task.status !== 'completed' && task.status !== 'failed' && new Date(task.dueDate || 0).getTime() < now;
    return { ...task, status: overdue ? 'overdue' : task.status };
  });
  res.json({
    success: true,
    tasks,
    summary: {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
    },
  });
});

// ---- credit score
app.get('/api/credit-score', requireAuth, (req, res) => {
  const user = req.authUser;
  const credit = currentCredit(user);
  res.json({ success: true, creditScore: { ...credit, category: computeCategory(user) } });
});

app.get('/api/credit-score/history', requireAuth, (req, res) => {
  const user = req.authUser;
  currentCredit(user);
  res.json({ success: true, history: (user.creditHistory || []).slice(0, 24) });
});

// ---- extended account snapshot (profile page)
app.get('/api/user/account', requireAuth, (req, res) => {
  const user = req.authUser;
  res.json({
    success: true,
    account: {
      id: user.id || '',
      username: user.username || '',
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      status: user.status || 'active',
      category: computeCategory(user),
      inviteCode: user.inviteCode || '',
      invitedBy: user.invitedBy || '',
      invitedByType: user.invitedByType || '',
      adminUserCode: user.invitedByType === 'admin' || user.invitedByType === 'super' ? user.invitedBy : '',
      createdAt: user.registeredAt,
      lastActivityAt: user.lastActivityAt || user.registeredAt,
      creditScore: currentCredit(user),
    },
  });
});

// ---- market detail / ohlcv / analysis (all computed server-side)
async function marketSnapshot() {
  try {
    const stats = await loadCoinbaseStats();
    const rows = symbols.map((symbol) => {
      const pairId = resolveCoinbasePair(stats, symbol);
      const item = pairId ? stats.get(pairId) : null;
      const [name, color, soft, mark] = assets[symbol];
      const last = Number(item?.last || seed[symbol][0]);
      const open = Number(item?.open || last);
      return {
        symbol, name, color, soft, mark,
        price: last,
        change: open > 0 ? ((last - open) / open) * 100 : seed[symbol][1],
        high: Number(item?.high || last * 1.03),
        low: Number(item?.low || last * 0.97),
        volume: Number(item?.volume || last * 28435),
        pair: pairId ?? `${symbol}-USDT`,
      };
    });
    return { rows, source: 'coinbase', live: true, message: '' };
  } catch (error) {
    return {
      rows: fallbackMarkets(),
      source: 'fallback',
      live: false,
      message: error instanceof Error ? error.message : 'Coinbase provider unavailable',
    };
  }
}

function dataStatusFor(snapshot) {
  if (snapshot.source === 'coinbase') return snapshot.live === false ? 'delayed' : 'live';
  return 'unavailable';
}

app.get('/api/markets/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!symbols.includes(symbol)) return res.status(404).json({ error: 'Unknown market symbol' });
  const snapshot = await marketSnapshot();
  const byVolume = [...snapshot.rows].sort((a, b) => b.volume - a.volume);
  const row = snapshot.rows.find((item) => item.symbol === symbol);
  res.json({
    success: true,
    market: {
      ...row,
      rank: byVolume.findIndex((item) => item.symbol === symbol) + 1,
      marketCap: null, // Coinbase public stats do not report market cap — shown only when the provider supplies it.
      status: dataStatusFor(snapshot),
      source: snapshot.source,
      lastUpdated: new Date().toISOString(),
      providerMessage: snapshot.message || undefined,
    },
  });
});

async function loadCandles(base, interval) {
  let pairId = `${base}-USDT`;
  try {
    const stats = await loadCoinbaseStats();
    pairId = resolveCoinbasePair(stats, base) || `${base}-USD`;
  } catch {
    /* stats failed — try the default pair */
  }
  const granularity = intervalGranularity[interval];
  const rows = await fetchCoinbase(`/products/${pairId}/candles?granularity=${granularity}`);
  return {
    pair: pairId,
    source: 'coinbase',
    data: rows
      .map((row) => ({
        time: Number(row[0]) * 1000,
        low: Number(row[1]), high: Number(row[2]),
        open: Number(row[3]), close: Number(row[4]), volume: Number(row[5]),
      }))
      .reverse()
      .slice(-120),
  };
}

app.get('/api/markets/:symbol/ohlcv', async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  const interval = allowedIntervals.has(String(req.query.interval || '')) ? String(req.query.interval) : '1m';
  if (!symbols.includes(symbol)) return res.status(404).json({ error: 'Unknown market symbol' });
  try {
    const candles = await loadCandles(symbol, interval);
    res.set('Cache-Control', 'public, max-age=8');
    res.json({ success: true, symbol, interval, ohlcv: candles.data, source: candles.source, status: 'live', lastUpdated: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, error: 'Market candles temporarily unavailable from the provider.' });
  }
});

// Technical analysis — every indicator is computed on the backend from live candles.
app.get('/api/markets/:symbol/analysis', async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  const interval = allowedIntervals.has(String(req.query.interval || '')) ? String(req.query.interval) : '5m';
  if (!symbols.includes(symbol)) return res.status(404).json({ error: 'Unknown market symbol' });

  let candles;
  try {
    candles = await loadCandles(symbol, interval);
  } catch {
    return res.status(503).json({ success: false, error: 'Analysis unavailable — the market provider is unreachable.' });
  }
  const closes = candles.data.map((candle) => candle.close);
  const window = closes.slice(-60);
  if (window.length < 5) return res.status(503).json({ success: false, error: 'Not enough market data for analysis yet.' });

  const sma = (values, period) =>
    values.length >= period ? values.slice(-period).reduce((sum, value) => sum + value, 0) / period : null;
  const ema = (values, period) => {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    for (const value of values.slice(period)) result = value * k + result * (1 - k);
    return result;
  };
  const rsi = (values, period = 14) => {
    if (values.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i += 1) {
      const delta = values[i] - values[i - 1];
      gains += Math.max(0, delta);
      losses += Math.max(0, -delta);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < values.length; i += 1) {
      const delta = values[i] - values[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(0, delta)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -delta)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  const sma20 = sma(window, 20);
  const sma50 = sma(window, 50);
  const ema12 = ema(window, 12);
  const ema26 = ema(window, 26);
  const macdLine = ema12 != null && ema26 != null ? ema12 - ema26 : null;
  const macdSeries = [];
  if (window.length >= 26) {
    for (let i = 26; i <= window.length; i += 1) {
      const slice = window.slice(0, i);
      const fast = ema(slice, 12);
      const slow = ema(slice, 26);
      if (fast != null && slow != null) macdSeries.push(fast - slow);
    }
  }
  const macdSignal =
    macdSeries.length >= 9 ? macdSeries.slice(-9).reduce((sum, value) => sum + value, 0) / 9 : null;
  const momentum =
    window.length >= 11
      ? ((window[window.length - 1] - window[window.length - 11]) / window[window.length - 11]) * 100
      : null;
  const recent = candles.data.slice(-40);
  const support = Math.min(...recent.map((candle) => candle.low));
  const resistance = Math.max(...recent.map((candle) => candle.high));
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
  const volatility = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : null;
  const price = window[window.length - 1];
  let trend = 'sideways';
  if (sma20 != null && sma50 != null) {
    trend = sma20 > sma50 * 1.001 ? 'uptrend' : sma20 < sma50 * 0.999 ? 'downtrend' : 'sideways';
  } else {
    trend = price > mean ? 'uptrend' : 'downtrend';
  }

  res.set('Cache-Control', 'public, max-age=15');
  res.json({
    success: true,
    symbol,
    interval,
    analysis: {
      price,
      trend,
      volatilityPercent: volatility != null ? Number(volatility.toFixed(3)) : null,
      rsi14: rsi(window) != null ? Number(rsi(window).toFixed(2)) : null,
      macd: macdLine != null ? Number(macdLine.toFixed(6)) : null,
      macdSignal: macdSignal != null ? Number(macdSignal.toFixed(6)) : null,
      macdHistogram: macdLine != null && macdSignal != null ? Number((macdLine - macdSignal).toFixed(6)) : null,
      sma20: sma20 != null ? Number(sma20.toFixed(6)) : null,
      sma50: sma50 != null ? Number(sma50.toFixed(6)) : null,
      ema12: ema12 != null ? Number(ema12.toFixed(6)) : null,
      ema26: ema26 != null ? Number(ema26.toFixed(6)) : null,
      momentumPercent: momentum != null ? Number(momentum.toFixed(3)) : null,
      support: Number(support.toFixed(6)),
      resistance: Number(resistance.toFixed(6)),
    },
    status: 'live',
    source: candles.source,
    lastUpdated: new Date().toISOString(),
  });
});

// ---- customer support tickets (withdrawals are handled through support only)
const supportCategories = ['Withdrawal', 'Account', 'Order', 'Wallet', 'Documents', 'Other'];

app.get('/api/support/tickets', requireAuth, (req, res) => {
  const user = req.authUser;
  res.json({ success: true, tickets: user.supportTickets || [], categories: supportCategories });
});

app.post('/api/support/tickets', requireAuth, (req, res) => {
  const user = req.authUser;
  const { category, subject, message } = req.body || {};
  if (!supportCategories.includes(String(category || ''))) {
    return res.status(422).json({ error: 'Choose a valid support category.' });
  }
  if (!String(message || '').trim()) {
    return res.status(422).json({ error: 'Describe your request so support can help.' });
  }
  const ticket = {
    id: `TCK-${Date.now().toString(36).toUpperCase()}`,
    category: String(category),
    subject: String(subject || `${String(category)} request`).slice(0, 120),
    message: String(message).slice(0, 2000),
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    response: null,
    request: null,
  };
  user.supportTickets = [ticket, ...(user.supportTickets || [])];
  persist();
  res.status(201).json({ success: true, message: 'Support request created. The team will respond on this ticket.', ticket });
});

// Withdrawal requests become support tickets — the website never executes payouts.
app.post('/api/withdrawal/support', requireAuth, (req, res) => {
  const user = req.authUser;
  const { currency, amount, note } = req.body || {};
  const cur = currency === 'USDT' ? 'USDT' : 'INR';
  const amt = Number(amount);
  if (amount !== undefined && (!Number.isFinite(amt) || amt <= 0)) {
    return res.status(422).json({ error: 'Requested amount must be a positive number.' });
  }
  const available = cur === 'INR' ? user.wallet.realBalance : user.wallet.realUsdtBalance;
  if (Number.isFinite(amt) && amt > available) {
    return res.status(409).json({ error: `Requested amount exceeds your available ${cur} balance.` });
  }
  const ticket = {
    id: `TCK-${Date.now().toString(36).toUpperCase()}`,
    category: 'Withdrawal',
    subject: `Withdrawal request${Number.isFinite(amt) ? ` — ${cur === 'INR' ? '₹' : '₮'}${amt.toLocaleString('en-IN')}` : ''}`,
    message: String(note || `Customer requested a ${cur} withdrawal review.`).slice(0, 2000),
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    response: null,
    request: { currency: cur, ...(Number.isFinite(amt) ? { amount: amt } : {}) },
  };
  user.supportTickets = [ticket, ...(user.supportTickets || [])];
  persist();
  res.status(201).json({
    success: true,
    message: 'Withdrawal request sent to Customer Support. You will be notified here once it is reviewed.',
    ticket,
  });
});

// ---- notifications (derived from the student's own backend data)
app.get('/api/notifications', requireAuth, (req, res) => {
  const user = req.authUser;
  autoSettleOrders(user);
  const items = [];
  for (const order of (user.orders || []).slice(0, 20)) {
    if (order.status === 'open' || !order.settledAt) continue;
    items.push({
      id: `ntf-order-${order.id}`,
      kind: 'order',
      title:
        order.status === 'won'
          ? `Order won — ${order.symbol}`
          : order.status === 'lost'
            ? `Order lost — ${order.symbol}`
            : `Order cancelled — ${order.symbol}`,
      message:
        order.status === 'won'
          ? `Payout ${order.currency === 'INR' ? '₹' : '₮'}${Math.floor(order.payout || 0).toLocaleString('en-IN')} credited at ${order.settledPercent ?? order.payoutPercent}%.`
          : order.status === 'lost'
            ? 'The scenario closed against your direction.'
            : 'The order was refunded to your available balance.',
      at: order.settledAt,
    });
  }
  ensureTasks(user);
  for (const task of user.tasks || []) {
    if (task.status === 'completed' && task.completedAt) {
      items.push({ id: `ntf-task-${task.id}`, kind: 'task', title: `Task completed — ${task.title}`, message: 'Nice work keeping your desk on track.', at: task.completedAt });
    }
  }
  for (const ticket of user.supportTickets || []) {
    items.push({
      id: `ntf-ticket-${ticket.id}`,
      kind: 'support',
      title: ticket.response ? `Support replied — ${ticket.subject}` : `Ticket opened — ${ticket.subject}`,
      message: ticket.response || 'Your request is with the support team.',
      at: ticket.updatedAt,
    });
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json({ success: true, notifications: items.slice(0, 10), unread: 0 });
});

// ---- documents catalog & invoice (values generated by the backend)
app.get('/api/documents', requireAuth, (_req, res) => {
  res.json({
    success: true,
    documents: [
      { id: 'account-statement', type: 'statement', title: 'Account Statement', description: 'Complete transaction history with balance and frozen-funds breakdown.', endpoint: '/api/account/statement' },
      { id: 'proof-of-account', type: 'proof', title: 'Proof of Account', description: 'Official verification document for your account status.', endpoint: '/api/account/proof' },
      { id: 'account-agreement', type: 'agreement', title: 'Account Agreement', description: 'Terms, conditions and trading risk disclosure.', endpoint: '/api/account/agreement' },
      { id: 'payout-agreement', type: 'payout-agreement', title: 'Agreement / Payout Terms', description: 'Payout, settlement and withdrawal review terms for your account.', endpoint: '/api/account/agreement?type=payout' },
      { id: 'account-invoice', type: 'invoice', title: 'Invoice', description: 'Invoice for deposits and conversions credited to your account.', endpoint: '/api/account/invoice' },
    ],
  });
});

app.get('/api/account/invoice', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = userDb.get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const w = user.wallet;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const items = w.transactions
    .filter((tx) => (tx.type === 'deposit' || tx.type === 'conversion') && tx.status === 'completed')
    .slice(0, 25)
    .map((tx, index) => ({
      position: index + 1,
      description: tx.title,
      detail: tx.description,
      date: tx.time,
      amount: Number(tx.amount) || 0,
      currency: tx.currency === 'USDT' ? 'USDT' : 'INR',
    }));
  const inrTotal = items.filter((i) => i.currency === 'INR').reduce((sum, i) => sum + i.amount, 0);
  const usdtTotal = items.filter((i) => i.currency === 'USDT').reduce((sum, i) => sum + i.amount, 0);

  res.json({
    success: true,
    invoice: {
      invoiceId: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(user.id || 'ACCT').slice(0, 6)}`,
      issuedAt: now.toISOString(),
      periodStart,
      periodEnd: now.toISOString(),
      billTo: { name: user.name, email: user.email, phone: user.phone || '', userId: user.id || '', inviteCode: user.inviteCode || '' },
      items,
      totals: {
        subtotalInr: Number(inrTotal.toFixed(2)),
        subtotalUsdt: Number(usdtTotal.toFixed(2)),
        platformFee: 0,
        tax: 0,
        totalInr: Number(inrTotal.toFixed(2)),
        balanceDue: 0,
      },
      notes: 'This invoice summarises funds credited to your Mudrexx Earn account. Platform and settlement fees are ₹0 on this plan; withdrawal reviews are handled by Customer Support.',
    },
  });
});

// ---- NOVA copilot (backend answers from authoritative account + market data)
function novaContext(user) {
  autoSettleOrders(user);
  ensureTasks(user);
  const w = user.wallet;
  return {
    account: {
      name: user.name,
      email: user.email,
      category: computeCategory(user),
      status: user.status,
      createdAt: user.registeredAt,
      inviteCode: user.inviteCode,
    },
    wallet: {
      realBalance: w.realBalance,
      realUsdtBalance: w.realUsdtBalance,
      frozenBalance: w.frozenBalance,
      frozenUsdtBalance: w.frozenUsdtBalance,
      demoBalance: w.demoBalance,
      conversionRate: w.conversionRate,
    },
    credit: currentCredit(user),
    orders: (user.orders || []).slice(0, 10),
    tasks: (user.tasks || []).slice(0, 10),
    tickets: (user.supportTickets || []).slice(0, 5),
    markets: (marketCache || []).slice(0, 10).map((row) => ({
      symbol: row.symbol,
      price: row.price,
      change: Number(Number(row.change).toFixed(2)),
    })),
  };
}

app.get('/api/nova/status', (_req, res) => {
  res.json({
    success: true,
    nova: {
      online: true,
      assistant: 'NOVA',
      model: process.env.GEMINI_API_KEY ? 'gemini' : 'nova-rulepack',
      grounded: true,
      topics: ['markets', 'market analysis', 'wallet', 'orders', 'tasks', 'documents', 'support', 'account'],
      at: new Date().toISOString(),
    },
  });
});

app.post('/api/nova/chat', requireAuth, (req, res) => {
  const user = req.authUser;
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(422).json({ error: 'Ask NOVA a question first.' });
  const context = novaContext(user);
  const lower = message.toLowerCase();
  const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  let reply = '';
  let sources = [];
  if (/(market|price|btc|eth|sol|coin|chart|analysis|rsi|trend)/.test(lower)) {
    const wanted = ['BTC', 'ETH', 'SOL', 'XRP'].find((sym) => lower.includes(sym.toLowerCase()));
    const rows = context.markets;
    const pick = rows.find((row) => row.symbol === wanted) || rows[0];
    reply = pick
      ? `${pick.symbol} is trading at $${pick.price.toLocaleString()} (${pick.change >= 0 ? '+' : ''}${pick.change}% over 24h) per the backend market feed. Open the Markets page for the full chart, RSI/MACD analysis and support/resistance levels.`
      : 'The market feed is momentarily unavailable from the backend. Please retry in a moment — I never quote prices the backend has not confirmed.';
    sources = ['market feed'];
  } else if (/(wallet|balance|frozen|available|deposit)/.test(lower)) {
    reply = `Your wallet: available ${inr(context.wallet.realBalance)} (plus ₮${context.wallet.realUsdtBalance.toLocaleString()} USDT), frozen ${inr(context.wallet.frozenBalance)}, and ${context.wallet.demoBalance.toLocaleString()} demo credits at a ${context.wallet.conversionRate} conversion rate. All figures come straight from your backend wallet snapshot.`;
    sources = ['wallet'];
  } else if (/(order|trade|position|win|lose)/.test(lower)) {
    const open = context.orders.filter((order) => order.status === 'open');
    reply = open.length
      ? `You have ${open.length} active order(s): ${open.map((o) => `${o.symbol} ${o.side.toUpperCase()}`).join(', ')}. Frozen funds for these remain locked until settlement.`
      : context.orders.length
        ? `Your latest order was ${context.orders[0].symbol} ${context.orders[0].side.toUpperCase()} — status ${context.orders[0].status}. Check the Order History page for entry, settlement price and payout.`
        : 'No orders yet. The Instant Order desk is the practice + order placement area once you are ready.';
    sources = ['orders'];
  } else if (/(task|todo|assignment)/.test(lower)) {
    const pending = context.tasks.filter((task) => task.status !== 'completed').length;
    reply = `You have ${pending} open task(s) on your desk. ${context.tasks[0] ? `The most recent is "${context.tasks[0].title}" (${context.tasks[0].status.replace('_', ' ')}).` : ''} Full details are on the Tasks page.`;
    sources = ['tasks'];
  } else if (/(document|statement|invoice|agreement|pdf)/.test(lower)) {
    reply = 'Your profile documents area provides the Account Statement, Proof of Account, Account Agreement, Payout Terms and Invoices — every PDF is generated from backend data with a Download button.';
    sources = ['documents'];
  } else if (/(support|ticket|withdraw|withdrawal)/.test(lower)) {
    reply =
      'Withdrawals are reviewed through Customer Support. Raise a Withdrawal ticket from the Support page (or the Withdraw button in your Wallet) and the team will respond on the ticket. Latest ticket: ' +
      (context.tickets[0] ? `"${context.tickets[0].subject}" (${context.tickets[0].status})` : 'none yet') +
      '.';
    sources = ['support'];
  } else if (/(credit|score)/.test(lower)) {
    reply = `Your credit score is ${context.credit.score} (${context.credit.status}), last updated ${new Date(context.credit.updatedAt).toLocaleString()}. The score is computed by the backend — it cannot be edited from the website.`;
    sources = ['credit score'];
  } else if (/(account|profile|who am i|my data)/.test(lower)) {
    reply = `You are ${context.account.name} (${context.account.email}), category ${context.account.category}, account status ${context.account.status}, member since ${new Date(context.account.createdAt).toLocaleDateString()}. Invitation code ${context.account.inviteCode}.`;
    sources = ['account'];
  } else {
    reply = 'I can help with markets and analysis, your wallet and frozen amounts, orders, tasks, documents, support tickets and account details. Ask me something like "What is my frozen amount?" or "How is BTC doing?"';
    sources = [];
  }

  // Optional: route through Gemini when the backend holds a key (never exposed to the browser).
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.json({ success: true, reply, at: new Date().toISOString(), sources, model: 'nova-rulepack' });
  }
  const prompt = `You are NOVA, the assistant on the Mudrexx Earn student desk. Answer using ONLY the JSON context below. If the context lacks the answer, say so honestly. Keep replies under 120 words.\n\nContext: ${JSON.stringify(context)}\n\nStudent question: ${message}`;
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(8000),
  })
    .then((response) => response.json())
    .then((body) => {
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      res.json({ success: true, reply: String(text || reply).trim(), at: new Date().toISOString(), sources, model: 'gemini' });
    })
    .catch(() => {
      res.json({ success: true, reply, at: new Date().toISOString(), sources, model: 'nova-rulepack' });
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
