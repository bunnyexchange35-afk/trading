import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 8799;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

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

describe('Mudrexx Earn Backend Test Suite', () => {
  before(async () => {
    serverProcess = spawn('node', [path.join(__dirname, '..', 'server.mjs')], {
      env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' },
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

  describe('Auth and User Flow', () => {
    const testEmail = `testuser_${Date.now()}@mudrexx.com`;

    test('POST /api/auth/register creates user with ₹0 real balance and 10,000 demo credits', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Trader',
          email: testEmail,
          phone: '+91 98765 43210',
          inviteCode: 'ADMIN777',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.wallet.realBalance, 0);
      assert.equal(data.user.wallet.demoBalance, 10000);
      assert.equal(data.user.invitedBy, 'ADMIN777');
    });

    test('POST /api/auth/login logs in user', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.email, testEmail);
      assert.ok(data.token);
    });

    test('GET /api/auth/me returns user profile', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me?email=${encodeURIComponent(testEmail)}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.email, testEmail);
    });

    test('PUT /api/user/profile updates user details', async () => {
      const res = await fetch(`${BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, name: 'Updated Trader', preferredCurrency: 'INR' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.name, 'Updated Trader');
    });
  });

  describe('Wallet, Demo Conversion, and Escrow Controls', () => {
    const testEmail = `walletuser_${Date.now()}@mudrexx.com`;

    before(async () => {
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Wallet User', email: testEmail }),
      });
    });

    test('POST /api/wallet/convert-demo converts practice credits to real balance', async () => {
      const res = await fetch(`${BASE_URL}/api/wallet/convert-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      const frozenRes = await fetch(`${BASE_URL}/api/wallet/frozen?email=${encodeURIComponent(testEmail)}`);
      const frozenData = await frozenRes.json();
      const depositItem = frozenData.items.find((i) => i.category === 'deposit' && i.canApprove);
      assert.ok(depositItem);

      const res = await fetch(`${BASE_URL}/api/wallet/deposit/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    let placedOrderId;

    before(async () => {
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Order Trader', email: testEmail, inviteCode: 'MEDRIX888' }),
      });
      // Convert demo credits to have real balance
      await fetch(`${BASE_URL}/api/wallet/convert-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, demoCredits: 5000 }),
      });
    });

    test('POST /api/orders/create places real order into frozen escrow', async () => {
      const res = await fetch(`${BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res1 = await fetch(`${BASE_URL}/api/orders/status?orderId=${placedOrderId}`);
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.success, true);
      assert.equal(data1.order.id, placedOrderId);
      assert.equal(data1.status, 'locked');

      const res2 = await fetch(`${BASE_URL}/api/orders/status?email=${encodeURIComponent(testEmail)}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, id: placedOrderId }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.releasedAmount, 200);
    });
  });
});
