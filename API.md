# Mudrexx Earn Backend API Documentation

Base URL: `http://localhost:8080` (Local) / set `BACKEND_ORIGIN` on the Cloudflare Worker (Production)

All request bodies are in `application/json` and responses return standard JSON.

---

## 1. System & Market Data APIs

### `GET /api/health`
Health check probe for uptime monitoring and hosting platforms.

**Response `200 OK`:**
```json
{
  "ok": true,
  "service": "mudrexx-earn",
  "status": "healthy",
  "timestamp": "2026-08-24T05:25:05.741Z",
  "uptime": 45.2
}
```

---

### `GET /api/markets`
Fetches live 24-hour ticker quotes and staking APYs for tracked cryptocurrency assets (BTC, ETH, BNB, SOL, XRP, ETC, ADA, DOGE) from Binance public data feeds with built-in cache and fallback.

**Response `200 OK`:**
```json
{
  "source": "binance",
  "cached": false,
  "data": [
    {
      "symbol": "BTC",
      "name": "Bitcoin",
      "color": "#f7931a",
      "soft": "#fff4e4",
      "mark": "₿",
      "stakingApy": 2.8,
      "price": 116430.2,
      "change": 2.84,
      "high": 120505.25,
      "low": 112704.43,
      "volume": 3310692737
    }
  ]
}
```

---

### `GET /api/market/klines`
Fetches candlestick chart data for live charting.

**Query Parameters:**
- `symbol` (e.g. `BTC`, `ETH`, `SOL`)
- `interval` (`1m`, `5m`, `15m`, `1h`)

**Response `200 OK`:**
```json
{
  "source": "binance",
  "data": [
    {
      "time": 1787548000000,
      "open": 116400.0,
      "high": 116450.0,
      "low": 116380.0,
      "close": 116430.2,
      "volume": 142.5
    }
  ]
}
```

---

## 2. Authentication & Profile APIs

### `POST /api/auth/register`
Registers a new user. **Newly registered users initialize with strictly ₹0.00 balance** and receive 10,000 demo practice credits.

**Request Body:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "+91 98765 43210",
  "preferredCurrency": "INR"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "User registered successfully with ₹0.00 initial balance",
  "user": {
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "phone": "+91 98765 43210",
    "preferredCurrency": "INR",
    "registeredAt": "2026-08-24T05:25:08.439Z",
    "wallet": {
      "realBalance": 0,
      "realUsdtBalance": 0,
      "frozenBalance": 0,
      "frozenUsdtBalance": 0,
      "demoBalance": 10000,
      "demoLinked": true,
      "conversionRate": 0.1,
      "totalConverted": 0,
      "assetHoldings": { "BTC": 0, "ETH": 0, "BNB": 0, "SOL": 0, "XRP": 0, "ETC": 0, "ADA": 0, "DOGE": 0 },
      "frozenItems": [],
      "transactions": []
    }
  },
  "token": "mudrexx_jwt_..."
}
```

---

### `POST /api/auth/login`
Signs in an existing user session.

**Request Body:**
```json
{
  "email": "rahul@example.com"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Welcome back",
  "user": { ... },
  "token": "mudrexx_jwt_..."
}
```

---

### `GET /api/auth/me`
Retrieves the current authenticated user profile and wallet state.

**Query Parameters / Header:**
`?email=rahul@example.com` or header `X-User-Email`

---

## 3. Wallet & Balance APIs

### `GET /api/wallet/summary`
Returns the balance breakdown (Available Real, Frozen, Total Net, Demo).

**Query Parameters:**
`?email=rahul@example.com`

**Response `200 OK`:**
```json
{
  "success": true,
  "summary": {
    "realBalance": 200,
    "realUsdtBalance": 0,
    "frozenBalance": 5000,
    "frozenUsdtBalance": 0,
    "totalNetRealBalance": 5200,
    "demoBalance": 8000,
    "demoLinked": true,
    "conversionRate": 0.1,
    "totalConverted": 2000,
    "assetHoldings": { "BTC": 0, "ETH": 0, "SOL": 0 },
    "frozenItemsCount": 1
  }
}
```

---

### `GET /api/wallet/transactions`
Returns the full ledger audit log.

---

## 4. Frozen Amount & Escrow APIs

### `GET /api/wallet/frozen`
Returns all funds currently locked in orders, pending deposits, or earn vaults.

**Response `200 OK`:**
```json
{
  "success": true,
  "frozenBalance": 5000,
  "frozenUsdtBalance": 0,
  "items": [
    {
      "id": "dep-1787549112194",
      "title": "INR Deposit (UPI)",
      "category": "deposit",
      "reason": "Ref: UPI-884920",
      "amount": 5000,
      "currency": "INR",
      "date": "Just now",
      "status": "processing",
      "canRelease": true
    }
  ]
}
```

---

### `POST /api/wallet/frozen/release`
Releases or cancels a frozen fund hold, refunding the amount back into the user's liquid Available Balance.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "id": "ord-1787549121580"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "₹1,000 released to Available Balance",
  "releasedAmount": 1000,
  "newRealBalance": 3200,
  "newFrozenBalance": 2000
}
```

---

### `POST /api/wallet/deposit/approve`
Simulates sandbox verification of a pending deposit, moving the funds from Frozen into Available Balance.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "id": "dep-1787549112194"
}
```

---

## 5. Demo to Real Conversion APIs

### `POST /api/wallet/convert-demo`
Converts practice demo credits into Real INR wallet funds at a 10:1 ratio ($100\text{ Demo} = ₹10\text{ Real INR}$).

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "demoCredits": 2000
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Converted 2,000 Demo Credits to ₹200.00 Real INR",
  "convertedCredits": 2000,
  "realGain": 200,
  "newDemoBalance": 8000,
  "newRealBalance": 200
}
```

---

### `POST /api/wallet/claim-demo`
Claims a free demo practice grant (+5,000 credits).

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "amount": 5000
}
```

---

### `POST /api/wallet/link-demo`
Toggles demo account linking status.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "linked": true
}
```

---

### `POST /api/wallet/demo/adjust`
Adjusts the demo practice balance (used by the Flight Lab game for wagers and cash-outs). Negative deltas are rejected when they exceed the available demo credits.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "delta": -250
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Demo balance adjusted by -250 credits",
  "delta": -250,
  "newDemoBalance": 9750
}
```

---

## 6. Deposits & Withdrawals APIs

### `POST /api/deposit/submit`
Submits an INR (UPI / Bank) or USDT (TRC20) deposit request. **Funds are recorded in the Frozen Amount section until verified.**

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "amount": 5000,
  "rail": "inr",
  "method": "upi",
  "reference": "UPI-884920"
}
```

---

### `POST /api/withdraw/submit`
Submits a withdrawal request from liquid Available Balance. Frozen funds cannot be withdrawn.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "amount": 1000,
  "destination": "user@bank"
}
```

---

## 7. Orders & Staking Vaults APIs

### `POST /api/orders/create`
Places a trading scenario order. Real orders place the required amount into **Frozen Balance escrow**.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "symbol": "BTC",
  "side": "up",
  "amount": 1000,
  "currency": "INR",
  "accountType": "real"
}
```

---

### `POST /api/staking/stake`
Locks funds in a flexible staking vault earning daily APY yield in the Frozen Amount section.

**Request Body:**
```json
{
  "email": "rahul@example.com",
  "asset": "ETH",
  "amount": 2000,
  "apy": 4.7
}
```

---

## 8. Data Store & Persistence

The backend keeps all user accounts, wallets, transactions and frozen items in an in-memory store that is **persisted to disk at `server/data/users.json`** (gitignored) with debounced atomic writes. State therefore survives backend restarts and redeploys. The frontend treats the backend as the single source of truth: every wallet control (deposits, conversions, orders, staking, releases, demo grants, Flight Lab wagers) executes through the endpoints above, and the UI re-syncs from `GET /api/auth/me` after every mutation.
