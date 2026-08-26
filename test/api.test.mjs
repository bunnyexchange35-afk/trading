import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 8799;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DATA_DIR = path.join(os.tmpdir(), `mudrexx-test-data-${Date.now()}`);

let serverProcess;

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server failed to start within ${timeoutMs}ms`);
}

// ---- helpers: institute invitation codes + bearer-token sign-in ----------
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function registerAccount(email, name, inviteCode = 'ADMIN777') {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name, email, inviteCode }),
  });
  return { status: res.status, data: await res.json() };
}

async function signIn(email) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  assert.equal(data.success, true, `login failed for ${email}`);
  return data.token;
}

describe('Mudrexx Earn Backend Test Suite', () => {
  before(async () => {
    serverProcess = spawn('node', [path.join(__dirname, '..', 'server.mjs')], {
      env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test', DATA_DIR: TEST_DATA_DIR },
      stdio: 'pipe',
    });
    await waitForServer(BASE_URL);
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Health and Verification Endpoints', () => {
    test('GET /api/health returns healthy status', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(data.status, 'healthy');
    });

    test('GET /verify and /api/verify return verified status', async () => {
      const res1 = await fetch(`${BASE_URL}/verify`);
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.ok, true);
      assert.equal(data1.status, 'verified');

      const res2 = await fetch(`${BASE_URL}/api/verify`);
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.ok, true);
      assert.equal(data2.status, 'verified');
    });

    test('GET /api returns endpoint catalog', async () => {
      const res = await fetch(`${BASE_URL}/api`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.endpoints);
      assert.ok(data.endpoints.orders);
    });
  });

  describe('Market Endpoints', () => {
    test('GET /api/markets returns market assets list', async () => {
      const res = await fetch(`${BASE_URL}/api/markets`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.length >= 30);
      const btc = data.data.find((m) => m.symbol === 'BTC');
      assert.ok(btc);
      assert.ok(typeof btc.price === 'number');
    });

    test('GET /api/market/klines returns candle history', async () => {
      const res = await fetch(`${BASE_URL}/api/market/klines?symbol=BTC&interval=1m`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.length > 0);
      assert.ok(data.data[0].open !== undefined);
      assert.ok(data.data[0].close !== undefined);
    });
  });

  describe('Invitation-Only Registration & Sign-In Enforcement', () => {
    const testEmail = `testuser_${Date.now()}@mudrexx.com`;
    const otherEmail = `otheruser_${Date.now()}@mudrexx.com`;
    let token;
    let otherToken;

    test('registration without an invitation code is rejected', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'No Code', email: `nocode_${Date.now()}@mudrexx.com` }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /invitation only/i);
    });

    test('registration with an unknown code is rejected', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'Bad Code', email: `bad_${Date.now()}@mudrexx.com`, inviteCode: 'NOT-A-CODE' }),
      });
      assert.equal(res.status, 403);
    });

    test('user referral codes do NOT grant registration (institute codes only)', async () => {
      const first = await registerAccount(testEmail, 'Test Trader', 'ADMIN777');
      assert.equal(first.status, 200);
      const referralCode = first.data.user.inviteCode; // MUD-XXXX user code
      assert.match(referralCode, /^MUD-/);
      const attempt = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: 'Referral Try', email: `ref_${Date.now()}@mudrexx.com`, inviteCode: referralCode }),
      });
      assert.equal(attempt.status, 403);
    });

    test('valid institute code registers with ₹0 real, 10,000 credits and a bearer token', async () => {
      const { status, data } = await registerAccount(otherEmail, 'Other Trader', 'MUDREXX-SUPER');
      assert.equal(status, 200);
      assert.equal(data.success, true);
      assert.equal(data.user.wallet.realBalance, 0);
      assert.equal(data.user.wallet.demoBalance, 10000);
      assert.equal(data.user.invitedByType, 'super');
      assert.match(data.token, /^mx_/);
      otherToken = data.token;
    });

    test('POST /api/auth/login issues a fresh bearer token', async () => {
      token = await signIn(testEmail);
      assert.match(token, /^mx_/);
      assert.notEqual(token, otherToken);
    });

    test('GET /api/auth/me without a token answers anonymous', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.anonymous, true);
      assert.equal(data.user, null);
    });

    test('GET /api/auth/me with a token returns the signed-in account', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.email, testEmail);
    });

    test('a token cannot read another account', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me?email=${encodeURIComponent(otherEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 403);
    });

    test('protected wallet endpoints require sign-in (401 without token)', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/summary?email=${encodeURIComponent(testEmail)}`);
      assert.equal(res.status, 401);
      const orders = await fetch(`${BASE_URL}/api/orders/list?email=${encodeURIComponent(testEmail)}`);
      assert.equal(orders.status, 401);
    });

    test('PUT /api/user/profile updates the signed-in user', async () => {
      const res = await fetch(`${BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, name: 'Updated Trader', preferredCurrency: 'INR' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.name, 'Updated Trader');
    });

    test('GET /api/admin/invited-users filters by invitation code', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/invited-users?code=ADMIN777&inviteCode=MUDREXX-SUPER`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total, 1);
      assert.equal(data.users[0].email, otherEmail);
      assert.ok(data.summary);
    });
  });

  describe('Wallet, Demo Conversion, and Escrow Controls', () => {
    const testEmail = `walletuser_${Date.now()}@mudrexx.com`;
    let token;

    before(async () => {
      const { data } = await registerAccount(testEmail, 'Wallet User', 'ADMIN777');
      token = data.token;
    });

    test('POST /api/wallet/convert-demo converts practice credits to real balance', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/convert-demo`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, demoCredits: 1000 }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.convertedCredits, 1000);
      assert.equal(data.realGain, 100); // 10:1 ratio
      assert.equal(data.newRealBalance, 100);
      assert.equal(data.newDemoBalance, 9000);
    });

    test('POST /api/wallet/claim-demo tops up demo credits', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/claim-demo`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, amount: 5000 }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.newDemoBalance, 14000);
    });

    test('POST /api/wallet/demo/adjust adjusts demo balance up and down', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/demo/adjust`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, delta: -2000 }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.newDemoBalance, 12000);
    });

    test('POST /api/deposit/submit creates a pending deposit in frozen items', async () => {
      const res = await fetch(`${BASE_URL}/api/deposit/submit`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          email: testEmail,
          amount: 500,
          rail: 'inr',
          method: 'UPI Direct',
          reference: 'UPI12345678',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.depositId);
    });

    test('POST /api/wallet/deposit/approve approves pending deposit and moves funds to available', async () => {
      const frozenRes = await fetch(`${BASE_URL}/api/wallet/frozen?email=${encodeURIComponent(testEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const frozenData = await frozenRes.json();
      const depositItem = frozenData.items.find((i) => i.category === 'deposit' && i.canApprove);
      assert.ok(depositItem);

      const res = await fetch(`${BASE_URL}/api/wallet/deposit/approve`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, id: depositItem.id }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.newRealBalance >= 600); // 100 converted + 500 approved deposit
    });

    test('POST /api/withdraw/submit handles withdrawal request', async () => {
      const res = await fetch(`${BASE_URL}/api/withdraw/submit`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          email: testEmail,
          amount: 100,
          destination: 'trader@upi',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.amount, 100);
    });
  });

  describe('Orders and Admin Directory', () => {
    const testEmail = `orderuser_${Date.now()}@mudrexx.com`;
    let token;
    let placedOrderId;

    before(async () => {
      const { data } = await registerAccount(testEmail, 'Order Trader', 'MEDRIX888');
      token = data.token;
      // Convert demo credits to have real balance
      await fetch(`${BASE_URL}/api/wallet/convert-demo`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, demoCredits: 5000 }),
      });
    });

    test('POST /api/orders/create places real order into frozen escrow', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          email: testEmail,
          symbol: 'BTC',
          side: 'up',
          amount: 200,
          currency: 'INR',
          accountType: 'real',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.orderId);
      assert.equal(data.status, 'locked');
      placedOrderId = data.orderId;
    });

    test('GET /api/orders/status fetches order status by orderId or email', async () => {
      const res1 = await fetch(`${BASE_URL}/api/orders/status?orderId=${placedOrderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.success, true);
      assert.equal(data1.order.id, placedOrderId);
      assert.equal(data1.status, 'locked');

      const res2 = await fetch(`${BASE_URL}/api/orders/status?email=${encodeURIComponent(testEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.success, true);
      assert.ok(data2.orders.length >= 1);
    });

    test('GET /api/admin/orders lists orders and filters by userId', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders?code=ADMIN777&userId=${encodeURIComponent(testEmail)}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.orders.length >= 1);
      assert.equal(data.orders[0].userId, testEmail);
    });

    test('GET /api/admin/users lists all registered users with code', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/users?code=ADMIN777`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.total >= 1);
      const user = data.users.find((u) => u.email === testEmail);
      assert.ok(user);
      assert.equal(user.invitedBy, 'MEDRIX888');
    });

    test('POST /api/wallet/frozen/release releases order escrow back to available balance', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/frozen/release`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, id: placedOrderId }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.releasedAmount, 200);
    });
  });

  describe('Order Board & Admin / Super Admin Control Commands', () => {
    const testEmail = `boarduser_${Date.now()}@mudrexx.com`;
    let token;
    let orderId;
    let creditOrderId;

    before(async () => {
      const { data } = await registerAccount(testEmail, 'Board Trader', 'ADMIN777');
      token = data.token;
      await fetch(`${BASE_URL}/api/wallet/convert-demo`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: testEmail, demoCredits: 8000 }),
      });
    });

    test('GET /api/admin/role resolves admin and super admin codes', async () => {
      const admin = await (await fetch(`${BASE_URL}/api/admin/role?code=ADMIN777`)).json();
      assert.equal(admin.role, 'admin');
      const superAdmin = await (await fetch(`${BASE_URL}/api/admin/role?code=MUDREXX-SUPER`)).json();
      assert.equal(superAdmin.role, 'super');
      const invalid = await fetch(`${BASE_URL}/api/admin/role?code=NOPE`);
      assert.equal(invalid.status, 403);
    });

    test('POST /api/orders/create records duration, payout % and entry price on the board', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          email: testEmail, symbol: 'ETH', side: 'up', amount: 300,
          currency: 'INR', accountType: 'real', durationSeconds: 30, payoutPercent: 40,
        }),
      });
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.order.status, 'open');
      assert.equal(data.order.payoutPercent, 40);
      assert.equal(data.order.durationSeconds, 30);
      assert.ok(data.order.entryPrice > 0);
      assert.ok(data.wallet.totalBalance > 0);
      orderId = data.orderId;
    });

    test('POST /api/admin/orders/update changes payout %, time and currency anytime', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders/update`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'ADMIN777', orderId, payoutPercent: 50, durationSeconds: 120, currency: 'USDT' }),
      });
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.order.payoutPercent, 50);
      assert.equal(data.order.durationSeconds, 120);
      assert.equal(data.order.currency, 'USDT');
      assert.equal(data.wallet.frozenUsdtBalance, 300);
      // switch back for the settle test
      const back = await fetch(`${BASE_URL}/api/admin/orders/update`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'MUDREXX-SUPER', orderId, currency: 'INR' }),
      });
      assert.equal((await back.json()).order.currency, 'INR');
    });

    test('POST /api/admin/orders/control forces a WIN with payout to wallet', async () => {
      const before = await (await fetch(`${BASE_URL}/api/wallet/summary?email=${encodeURIComponent(testEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })).json();
      const res = await fetch(`${BASE_URL}/api/admin/orders/control`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'ADMIN777', orderId, action: 'win' }),
      });
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.order.status, 'won');
      assert.equal(data.order.payout, 450); // 300 + 50%
      const after = await (await fetch(`${BASE_URL}/api/wallet/summary?email=${encodeURIComponent(testEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })).json();
      assert.equal(after.summary.realBalance, before.summary.realBalance + 450);
    });

    test('control on a settled order is rejected with 409', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders/control`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'ADMIN777', orderId, action: 'lose' }),
      });
      assert.equal(res.status, 409);
    });

    test('credit orders escrow credits and a forced LOSE consumes them', async () => {
      const create = await fetch(`${BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          email: testEmail, symbol: 'BTC', side: 'down', amount: 500,
          currency: 'INR', accountType: 'demo', durationSeconds: 60, payoutPercent: 20,
        }),
      });
      const created = await create.json();
      assert.equal(created.success, true);
      creditOrderId = created.orderId;
      assert.ok(created.newDemoBalance < 2000);

      const lose = await fetch(`${BASE_URL}/api/admin/orders/control`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'MUDREXX-SUPER', orderId: creditOrderId, action: 'lose' }),
      });
      const lost = await lose.json();
      assert.equal(lost.order.status, 'lost');
      assert.equal(lost.order.payout, 0);
    });

    test('GET /api/orders/list returns the full board with wallet state', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/list?email=${encodeURIComponent(testEmail)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.orders.length, 2);
      assert.ok(data.wallet.creditTotal >= 0);
      assert.ok(data.wallet.depositCredited === 0);
    });

    test('GET /api/admin/orders/all lists every order with role', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/orders/all?code=MUDREXX-SUPER`);
      const data = await res.json();
      assert.equal(data.role, 'super');
      assert.ok(data.orders.some((entry) => entry.id === orderId));
      assert.ok(data.orders.every((entry) => entry.userEmail));
    });

    test('POST /api/admin/wallet/adjust is super-admin only and commands wallet state', async () => {
      const denied = await fetch(`${BASE_URL}/api/admin/wallet/adjust`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'ADMIN777', email: testEmail, field: 'real', delta: 100 }),
      });
      assert.equal(denied.status, 403);

      const allowed = await fetch(`${BASE_URL}/api/admin/wallet/adjust`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'MUDREXX-SUPER', email: testEmail, field: 'real', delta: 1000 }),
      });
      const data = await allowed.json();
      assert.equal(data.success, true);
      assert.equal(data.field, 'real');

      const negative = await fetch(`${BASE_URL}/api/admin/wallet/adjust`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ code: 'MUDREXX-SUPER', email: testEmail, field: 'real', delta: -1000000 }),
      });
      assert.equal(negative.status, 400);
    });
  });
});
