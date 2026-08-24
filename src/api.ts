/**
 * Mudrexx Earn Backend API Client
 * Typed helper functions for connecting to the Express backend.
 */

export const API_BASE = ''; // Uses relative URL in Vite/browser or set to custom backend URL

export type ApiResponse<T> = {
  success?: boolean;
  error?: string;
  message?: string;
} & T;

// 1. Health & Markets
export async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function getMarkets() {
  const res = await fetch(`${API_BASE}/api/markets`);
  return res.json();
}

export async function getKlines(symbol = 'BTC', interval = '1m') {
  const res = await fetch(`${API_BASE}/api/market/klines?symbol=${symbol}&interval=${interval}`);
  return res.json();
}

// 2. Authentication
export async function registerUser(data: { name: string; email: string; phone?: string; preferredCurrency?: string }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function loginUser(email: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function getCurrentUser(email: string) {
  const res = await fetch(`${API_BASE}/api/auth/me?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function updateProfile(data: { email: string; name?: string; phone?: string; preferredCurrency?: string }) {
  const res = await fetch(`${API_BASE}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 3. Wallet & Balance
export async function getWalletSummary(email: string) {
  const res = await fetch(`${API_BASE}/api/wallet/summary?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function getTransactions(email: string) {
  const res = await fetch(`${API_BASE}/api/wallet/transactions?email=${encodeURIComponent(email)}`);
  return res.json();
}

// 4. Frozen Amount & Escrow
export async function getFrozenItems(email: string) {
  const res = await fetch(`${API_BASE}/api/wallet/frozen?email=${encodeURIComponent(email)}`);
  return res.json();
}

export async function releaseFrozenItem(email: string, id: string) {
  const res = await fetch(`${API_BASE}/api/wallet/frozen/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, id }),
  });
  return res.json();
}

export async function approveDepositItem(email: string, id: string) {
  const res = await fetch(`${API_BASE}/api/wallet/deposit/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, id }),
  });
  return res.json();
}

// 5. Demo to Real Conversion
export async function convertDemoCredits(email: string, demoCredits: number) {
  const res = await fetch(`${API_BASE}/api/wallet/convert-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, demoCredits }),
  });
  return res.json();
}

export async function claimDemoCreditsApi(email: string, amount = 5000) {
  const res = await fetch(`${API_BASE}/api/wallet/claim-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount }),
  });
  return res.json();
}

export async function setDemoLinkStatus(email: string, linked: boolean) {
  const res = await fetch(`${API_BASE}/api/wallet/link-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, linked }),
  });
  return res.json();
}

// 6. Deposits & Withdrawals
export async function submitDeposit(data: {
  email: string;
  amount: number;
  rail: 'inr' | 'usdt';
  method: string;
  reference?: string;
}) {
  const res = await fetch(`${API_BASE}/api/deposit/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function submitWithdrawal(data: { email: string; amount: number; destination: string }) {
  const res = await fetch(`${API_BASE}/api/withdraw/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 7. Orders & Staking
export async function createOrder(data: {
  email: string;
  symbol: string;
  side: 'up' | 'down';
  amount: number;
  currency: 'INR' | 'USDT';
  accountType: 'real' | 'demo';
}) {
  const res = await fetch(`${API_BASE}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function stakeInVault(data: { email: string; asset: string; amount: number; apy: number }) {
  const res = await fetch(`${API_BASE}/api/staking/stake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
