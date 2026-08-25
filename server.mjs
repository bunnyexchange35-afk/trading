import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8080);
const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ETC', 'ADA', 'DOGE'];
const allowedIntervals = new Set(['1m', '5m', '15m', '1h']);
const seed = {
  BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], BNB: [873.22, -0.64], SOL: [184.76, 4.92],
  XRP: [2.18, -1.23], ETC: [23.74, 0.82], ADA: [0.728, 3.16], DOGE: [0.2184, -0.42],
};
const assets = {
  BTC: ['Bitcoin', '#f7931a', '#fff4e4', '₿'], ETH: ['Ethereum', '#627eea', '#eef1ff', 'Ξ'],
  BNB: ['BNB', '#f3ba2f', '#fff9df', 'B'], SOL: ['Solana', '#7657ff', '#f2efff', 'S'],
  XRP: ['XRP', '#23292f', '#edf0f2', 'X'], ETC: ['Ethereum Classic', '#3ab83a', '#eaf9ea', 'E'],
  ADA: ['Cardano', '#316bd6', '#edf4ff', 'A'], DOGE: ['Dogecoin', '#c3a634', '#fff9df', 'Ð'],
};
const apy = { BTC: 2.8, ETH: 4.7, BNB: 3.4, SOL: 6.9, XRP: 2.2, ETC: 3.8, ADA: 5.1, DOGE: 1.8 };
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
const adminCodes = (process.env.ADMIN_CODES || 'MUDREXX-ADMIN,ADMIN-2024')
  .split(',')
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

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
    return { ok: true, invitedBy: normalized, invitedByType: 'admin' };
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
      symbol, name, color, soft, mark, stakingApy: apy[symbol], price, change,
      high: price * 1.035, low: price * 0.968, volume: price * 28435,
    };
  });
}

async function fetchBinance(route) {
  const hosts = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api.binance.us'];
  let lastError;
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${route}`, { signal: AbortSignal.timeout(5500), headers: { 'User-Agent': 'MudrexxEarn/1.0' } });
      if (!response.ok) throw new Error(`Binance returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Market provider unavailable');
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

app.get('/api', (_req, res) => {
  res.json({
    name: 'Mudrexx Earn Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      markets: 'GET /api/markets',
      klines: 'GET /api/market/klines?symbol=BTC&interval=1m',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me?email=...',
        updateProfile: 'PUT /api/user/profile',
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
      orders: 'POST /api/orders/create',
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
    return res.json({ data: marketCache, source: 'binance', cached: true });
  }
  try {
    const pairs = symbols.map((symbol) => `"${symbol}USDT"`).join(',');
    const tickers = await fetchBinance(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(`[${pairs}]`)}`);
    marketCache = symbols.map((symbol) => {
      const item = tickers.find((ticker) => ticker.symbol === `${symbol}USDT`);
      const [name, color, soft, mark] = assets[symbol];
      const price = Number(item?.lastPrice || seed[symbol][0]);
      return {
        symbol, name, color, soft, mark, stakingApy: apy[symbol], price,
        change: Number(item?.priceChangePercent || seed[symbol][1]),
        high: Number(item?.highPrice || price * 1.03),
        low: Number(item?.lowPrice || price * 0.97),
        volume: Number(item?.quoteVolume || price * 28435),
      };
    });
    cacheAt = Date.now();
    res.set('Cache-Control', 'public, max-age=5');
    res.json({ data: marketCache, source: 'binance', cached: false });
  } catch (error) {
    res.json({ data: fallbackMarkets(), source: 'fallback', message: error instanceof Error ? error.message : 'Provider unavailable' });
  }
});

app.get('/api/market/klines', async (req, res) => {
  const base = String(req.query.symbol || 'BTC').toUpperCase();
  const interval = String(req.query.interval || '1m');
  if (!symbols.includes(base) || !allowedIntervals.has(interval)) {
    return res.status(400).json({ error: 'Unsupported market request' });
  }
  try {
    const rows = await fetchBinance(`/api/v3/klines?symbol=${base}USDT&interval=${interval}&limit=80`);
    const data = rows.map((row) => ({
      time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
      close: Number(row[4]), volume: Number(row[5]),
    }));
    res.set('Cache-Control', 'public, max-age=8');
    res.json({ data, source: 'binance' });
  } catch {
    const [start] = seed[base];
    let price = start * 0.975;
    const data = Array.from({ length: 80 }, (_, index) => {
      const open = price;
      price = Math.max(0.0001, price * (1 + (Math.sin(index * 1.7) + Math.random() - 0.45) * 0.0028));
      return {
        time: Date.now() - (79 - index) * 60_000,
        open, high: Math.max(open, price) * 1.002, low: Math.min(open, price) * 0.998,
        close: price, volume: 100 + Math.random() * 900,
      };
    });
    res.json({ data, source: 'fallback' });
  }
});

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
  const { email, symbol = 'BTC', side = 'up', amount, currency = 'INR', accountType = 'real' } = req.body || {};
  const amt = Number(amount || 0);

  if (!email || amt <= 0) return res.status(400).json({ error: 'Email and positive amount required' });

  const user = getOrCreateUser(email);

  if (accountType === 'real') {
    const isINR = currency === 'INR';
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
      id: `ord-${Date.now()}`,
      title: `${symbol} ${side === 'up' ? 'BUY UP' : 'BUY DOWN'} Order`,
      category: 'order',
      reason: `Active limit order scenario on ${symbol}/USDT`,
      amount: amt,
      currency,
      asset: symbol,
      date: 'Just now',
      status: 'locked',
      canRelease: true,
    };
    user.wallet.frozenItems.unshift(orderItem);

    user.wallet.transactions.unshift({
      id: `tx-ord-${Date.now()}`,
      title: `Order Placed (${side.toUpperCase()})`,
      description: `${currency} ${amt} held in frozen order escrow`,
      time: 'Just now',
      amount: amt,
      currency,
      type: 'trade',
      tone: 'down',
      status: 'pending',
    });

    persist();
    return res.json({
      success: true,
      message: `${currency === 'INR' ? '₹' : '₮'}${amt} placed into Frozen Amount section`,
      orderId: orderItem.id,
      status: 'locked',
      newAvailable: user.wallet.realBalance,
      newFrozen: user.wallet.frozenBalance,
    });
  }

  // Demo order
  res.json({
    success: true,
    message: 'Demo practice scenario active',
    status: 'demo_active',
  });
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
