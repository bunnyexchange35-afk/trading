# Mudrexx Earn — Full Site Summary & Deployment Guide

Everything you need to understand the site and deploy it **with the backend code**, in one place.

---

## 1. What this app is

A India-first crypto earn/trading desk: live Coinbase-powered prices across 32 assets, an instant-order trading desk with a Flight Lab mini-game, UPI/USDT deposit flows, a wallet with frozen-funds escrow, demo-to-real conversion (10:1), and an admin console. Demo trading only — no real exchange keys are involved anywhere.

**No third-party API keys are required.** Market data comes from Coinbase's **public** endpoints (no key, no auth). The only secrets are ones you define yourself (admin codes) and your Cloudflare account token (handled by `wrangler login`).

---

## 2. Architecture

```
                        ┌─────────────────────────────────────────┐
   Browser ───────────▶ │  Cloudflare Worker  (mudrex-earn)       │
                        │                                         │
                        │  • serves dist/ SPA (all page routes)   │
                        │  • /api/markets, /api/market/klines,    │
                        │    /api/health  → served NATIVELY       │
                        │    (live Coinbase fetch, edge-cached)   │
                        │  • other /api/*, /a/*, /s/*, /verify    │
                        │    → proxied to BACKEND_ORIGIN          │
                        └───────────────────┬─────────────────────┘
                                            │  (only if configured)
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │  Express backend  (server.mjs)          │
                        │  • auth, wallet, orders, staking,       │
                        │    deposits, admin APIs                 │
                        │  • same market endpoints for local dev  │
                        │  • persists to server/data/users.json   │
                        │  • can also serve dist/ itself          │
                        └─────────────────────────────────────────┘
```

Repo layout:

| Path | What it is |
|---|---|
| `src/` | React + TypeScript frontend (Vite) |
| `dist/` | Built frontend output (`npm run build`) — served by worker or Express |
| `server.mjs` | The Express **backend code** — all wallet/auth/order APIs |
| `server/data/users.json` | Persistent user store (gitignored — mount a volume in prod) |
| `trading-worker/` | Cloudflare Worker (SPA host + native market API + proxy) |
| `trading-worker/wrangler.jsonc` | Worker config: `mudrex-earn`, assets `../dist`, SPA fallback |
| `test/api.test.mjs` | 20 backend tests (`npm test`) |

---

## 3. Website pages & routes

### Primary routes

| Route | Page | What's on it |
|---|---|---|
| `/login` | Sign-in | Opens the auth modal (register/sign-in tabs). Already signed in → redirects to `/dashboard`. Registration can carry an invitation code (admin or referral). |
| `/dashboard` (also `/`) | Home / portfolio | Launch animation, live portfolio card, market ticker, product/earn sections. Real balances, frozen amounts, demo credits at a glance. |
| `/trading` (also `/market`) | Market desk | Live 32-asset table (Coinbase), Spot / Futures / DeFi Staking tabs, INR⇄USDT view, search & filters, A-tier flexible + B-tier locked 30-day staking vaults with stake action. |
| `/instant-order` (also `/instant order`) | Instant Order + Flight Lab | Live candle chart (1m/5m/15m/1h), buy-up/buy-down scenario orders with real (escrowed) or demo funds, and the Flight Lab multiplier mini-game wagering demo credits. |
| `/profile` | Profile & settings | Identity, demo-to-real link status, security settings, sign out. |

### Secondary routes

| Route | Page |
|---|---|
| `/wallet` | Wallet desk — balance breakdown, conversion desk (100 demo = ₹10), frozen-funds inspector with release controls, full transaction ledger |
| `/deposit` | UPI / bank INR and TRC20 USDT deposit flows (recorded as frozen until verified) |
| `/support` | Support center + Telegram contact |
| `/community` | Community hub |
| `/admin/users` | Admin console — every account, balances, orders (requires admin code) |
| `/a/:code`, `/s/:code` | V2 private-mode access / source link redemption (also `?access=`, `?src=`) |

---

## 4. Complete API reference

Base URL: **same origin** (`/api/...`). Full request/response examples live in [`API.md`](API.md).

### 4.1 Served natively by the Cloudflare Worker (no backend needed)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Uptime probe |
| GET | `/api/markets` | Live 24h quotes + staking APYs for 32 assets (Coinbase, edge-cached, warm fallback) |
| GET | `/api/market/klines?symbol=BTC&interval=1m` | Candles for charts (`1m 5m 15m 1h`) |

### 4.2 Served by the backend (`server.mjs`) — proxied through the worker

**Auth & profile**

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name,email,phone,preferredCurrency,invitationCode?}` → user + token. New users start at **₹0.00** + 10,000 demo credits |
| POST | `/api/auth/login` | `{email}` → user + token |
| GET | `/api/auth/me` | `?email=` or `X-User-Email` header → user + wallet |
| PUT | `/api/user/profile` | Update profile fields |
| GET | `/verify`, `/api/verify` | Deployment/diagnostics info |

**Wallet, frozen funds & conversion**

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/wallet/summary` | Available / frozen / total net / demo breakdown |
| GET | `/api/wallet/transactions` | Full ledger |
| GET | `/api/wallet/frozen` | All frozen items (orders, pending deposits, vaults) |
| POST | `/api/wallet/frozen/release` | Release/cancel a hold → back to available |
| POST | `/api/wallet/deposit/approve` | Sandbox deposit verification (frozen → available) |
| POST | `/api/wallet/convert-demo` | Demo → real at 10:1 |
| POST | `/api/wallet/claim-demo` | +5,000 demo grant |
| POST | `/api/wallet/link-demo` | Toggle demo/real link |
| POST | `/api/wallet/demo/adjust` | ± demo delta (Flight Lab wagers/cashouts) |

**Deposits, withdrawals, orders, staking**

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/deposit/submit` | `{email,amount,rail:inr|usdt,method,reference}` → frozen until verified |
| POST | `/api/withdraw/submit` | From available balance only |
| POST | `/api/orders/create` | `{email,symbol,side:up|down,amount,currency,accountType}` — real orders escrow funds |
| GET | `/api/orders/status` | Order state |
| POST | `/api/staking/stake` | `{email,asset,amount,apy}` → locked vault, yields in frozen |

**Admin (requires `?code=` admin code)**

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/admin/users` | Full user directory |
| GET | `/api/admin/invited-users` | Accounts attached to an admin code |
| GET | `/api/admin/orders` | Orders per user |

---

## 5. Keys, codes & environment variables

**There are no external API keys.** Coinbase market data is public and keyless. What exists:

| Variable | Where | Required | Description |
|---|---|---|---|
| `ADMIN_CODES` | Backend env | **Set this in production** | Comma-separated admin/invitation codes. **Defaults if unset: `MUDREXX-ADMIN, ADMIN-2024, ADMIN777, MEDRIX888, ADMIN`** — always override. |
| `PORT` | Backend env | No | Defaults to `8080` |
| `BACKEND_ORIGIN` | Worker var (CF dashboard) | For Option B | e.g. `https://your-backend.onrender.com` — worker proxies non-native `/api/*` here |
| `BACKEND` | Worker service binding | Optional | Alternative to `BACKEND_ORIGIN`: bind directly to another Worker |
| (KV) `config:backend-url` | Worker KV binding | Optional | Change backend URL from the dashboard without redeploying |
| `VITE_TELEGRAM_URL` | Build-time (frontend) | No | Telegram link for the contact button (default `https://t.me/MEDRIXEARN`) |
| Cloudflare token | `wrangler login` or CF Builds | For deploy | Never commit this; Workers Builds auto-generates its own |

Persistence note: the backend stores users at `server/data/users.json`. On hosted platforms mount a **persistent disk** at `server/data/` (or accept ephemeral resets).

---

## 6. Deploying

### Option A — one server, backend serves everything (simplest "with backend code")

`server.mjs` serves both the API and the built SPA on one port.

```bash
npm install
npm run build        # type-checks + builds frontend into dist/
ADMIN_CODES="YOUR-SECRET-CODES" PORT=8080 npm start
```

App + API on `http://<host>:8080`. Works on Render / Railway / Fly.io / any VPS / Docker (`node:20`+ image, command `npm start`, expose `$PORT`, persist `server/data/`). Health check: `GET /api/health`.

### Option B — Cloudflare Worker (fast, global) + backend origin

1. **Deploy the backend** (Option A steps) to any Node host → note its public URL, e.g. `https://mudrex-earn-api.onrender.com`.
2. **Deploy the worker** from the repo root:

   ```bash
   npm install
   npm run deploy      # = npm run build && wrangler deploy -c trading-worker/wrangler.jsonc
   ```

   First-time: run `npx wrangler login` before deploying. Worker lands at `https://mudrex-earn.<your-subdomain>.workers.dev`.

3. **Wire the backend** in the Cloudflare dashboard → Worker `mudrex-earn` → **Settings → Variables & Secrets**:
   - `BACKEND_ORIGIN` = `https://mudrex-earn-api.onrender.com` (plaintext var is fine),
   - *or* **Settings → Bindings** → add a Service Binding named `BACKEND` to a backend Worker,
   - *or* bind a KV namespace and set key `config:backend-url`.

   Without any of these, the site + market pages still work; auth/wallet calls return `503` with a setup hint.

4. **Auto-deploy on push** (optional): Workers & Pages → `mudrex-earn` → Settings → Builds → Connect repo, build command `npm run build`, deploy command `npx wrangler deploy -c trading-worker/wrangler.jsonc`, production branch `main`.

### Local development

```bash
npm install
npm run dev           # Vite dev server :5173 + Express API :8080 (proxied)
npm test              # 20 backend tests
```

---

## 7. Post-deploy verification checklist

```bash
BASE="https://your-deployed-url"

curl $BASE/api/health                 # {"ok":true,...}
curl $BASE/api/markets                # 32 assets, "source":"coinbase" (or "fallback")
curl "$BASE/api/market/klines?symbol=BTC&interval=1m"
curl -X POST $BASE/api/auth/register -H 'content-type: application/json' \
  -d '{"name":"Test","email":"t@t.co","phone":"+91","preferredCurrency":"INR"}'
curl "$BASE/api/auth/me?email=t@t.co"
```

Then in a browser: `/login` → register → `/dashboard` shows ₹0.00 + 10,000 demo → `/trading`, `/instant-order`, `/deposit`, `/profile`, `/admin/users` with your admin code.

---

## 8. Security notes

- **Override `ADMIN_CODES`** in every deployed environment — the defaults are public in this repo.
- Login is email-only (demo product); add real auth before handling real funds.
- All amounts are sandbox/demo logic; deposits are recorded, never actually processed.
- Never commit `server/data/users.json` (already gitignored) or Cloudflare tokens.
