# Mudrexx Earn — Full Site Summary & Deployment Guide

Everything you need to understand the site and deploy it **with the backend code**, in one place.

---

## 1. What this app is

A India-first crypto earn/trading desk: live Coinbase-powered prices across 32 assets, an instant-order trading desk with a Flight Lab mini-game, UPI/USDT deposit flows, a wallet with frozen-funds escrow, demo-to-real conversion (10:1), and an admin console. Demo trading only — no real exchange keys are involved anywhere.

**No third-party API keys are required.** Market data comes from Coinbase's **public** endpoints (no key, no auth). The only secrets are ones you define yourself (admin codes) and your Cloudflare account token (handled by `wrangler login`).

---

## 2. Architecture

**The Cloudflare Worker is static-only.** `npm run deploy` ships the built SPA to the `trading` Worker (assets + single-page-application fallback) — and nothing else. The in-Worker API handler was removed on purpose (audit: *"API handler in trading Worker — should be removed, static only"*): no Worker script runs, there is no API on the Worker, and no storage exists at the edge. The backend is `server.mjs` (Express) — deployed separately or self-hosted on the same server that serves `dist/`.

```
   ┌──────────────────────────────┐        ┌──────────────────────────────┐
   │  Cloudflare Worker (trading) │        │  Express backend (server.mjs)│
   │  STATIC ONLY                 │        │  separate host / Docker      │
   │                              │        │                              │
   │  • serves dist/ SPA          │  CORS  │  • auth, wallets, deposits   │
   │  • SPA fallback (all routes) │ ─────► │  • orders, staking, admin    │
   │  • no script, no /api        │        │  • Coinbase market endpoints │
   │                              │        │  • server/data/users.json    │
   └──────────────────────────────┘        └──────────────────────────────┘
```

The frontend reaches the API two ways:

- **Same-origin** — serve `dist/` from Express itself (`npm start`, Option A). No extra config.
- **Split deploy** — static Worker + remote API: build with `VITE_API_URL=https://<api-origin>` so the SPA calls the backend cross-origin (Option B).

Requests that hit the static Worker expecting an API get the SPA fallback: `GET /api/health` → `index.html`, `POST /api/auth/register` → `405 Method Not Allowed`. That is the intended contract (`npm run verify:deployed` asserts it).

The Express server (`server.mjs`) implements the full API — see [`ADMIN-CONTROL.md`](ADMIN-CONTROL.md) for the admin command summary.

Repo layout:

| Path | What it is |
|---|---|
| `src/` | React + TypeScript frontend (Vite) |
| `dist/` | Built frontend output (`npm run build`) — served by worker or Express |
| `server.mjs` | The Express **backend code** — all wallet/auth/order APIs + the order engine (see [`ADMIN-CONTROL.md`](ADMIN-CONTROL.md) for the admin command summary) |
| `server/data/users.json` | Persistent user store (gitignored — mount a volume in prod) |
| `wrangler.jsonc` | Static Worker config: name `trading`, assets `dist/`, SPA fallback — no `main`, no script |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | One-command backend deploy (builds frontend, serves SPA + API) |
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

Base URL: the **backend origin** — same origin when Express serves the SPA, or the `VITE_API_URL` origin on a split deploy. The static Cloudflare Worker serves **no** API. Full request/response examples live in [`API.md`](API.md).

### 4.1 Served by the backend (`server.mjs`)

**Markets (Coinbase public, keyless)**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Uptime probe |
| GET | `/api/markets` | Live 24h quotes + staking APYs for 32 assets (Coinbase, warm fallback) |
| GET | `/api/market/klines?symbol=BTC&interval=1m` | Candles for charts (`1m 5m 15m 1h`) |

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
| `SUPER_ADMIN_CODES` | Backend env | No | Super admin codes (order control + wallet state commands). Defaults: `MUDREXX-SUPER, SUPER-2024`. See [`ADMIN-CONTROL.md`](ADMIN-CONTROL.md). |
| `PORT` | Backend env | No | Defaults to `8080` |
| `VITE_API_URL` | Build-time (frontend) | Split deploy | API origin the SPA calls, e.g. `https://your-backend.onrender.com`. Leave empty when Express serves the SPA (same-origin). |
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

#### Docker (one command)

A multi-stage `Dockerfile` (node:22-alpine) and `docker-compose.yml` are included — it builds the frontend, installs only production deps, serves SPA + API on `:8080`, persists users to the `mudrex-data` volume, and self-health-checks `/api/health`:

```bash
# one command — build + run with persistent storage
ADMIN_CODES="YOUR-CODE1,YOUR-CODE2" docker compose up -d --build

# verify
curl http://localhost:8080/api/health
```

Or plain Docker / a platform that builds Dockerfiles (Cloud Run, Fly, Render, Railway):

```bash
docker build -t mudrex-earn .
docker run -d --name mudrex-earn -p 8080:8080 \
  -e ADMIN_CODES="YOUR-CODE1,YOUR-CODE2" \
  -v mudrex-data:/app/server/data \
  mudrex-earn
```

Notes: `PORT` is respected (platforms that inject it work as-is); user data lives at `/app/server/data` (declared `VOLUME`); admin codes default to a placeholder in compose — **always pass your own**.

### Option B — Cloudflare Worker, static site (recommended for the frontend)

The Worker serves the SPA only — one deploy, nothing else to host, and nothing to keep updated at the edge:

```bash
npx wrangler login            # first time only
npm install
VITE_API_URL=https://<your-backend-origin> npm run deploy
                              # = npm run build && wrangler deploy -c wrangler.jsonc
```

The Worker lands at `https://trading.rufflocrm.workers.dev` serving the SPA (all page routes, deep links). Every `/api/*` call goes to the backend origin from `VITE_API_URL` (set it at build time — the Worker itself cannot proxy anything).

Verify the deployment is the static-only contract:

```bash
npm run verify:deployed                      # defaults to https://trading.rufflocrm.workers.dev
node scripts/verify-deployed-worker.mjs https://<worker>.<subdomain>.workers.dev
curl https://trading.rufflocrm.workers.dev/api/health   # -> index.html (SPA fallback), NOT JSON
curl -X POST https://trading.rufflocrm.workers.dev/api/auth/register   # -> 405, NOT a register handler
```

**If `/api/health` returns JSON or `POST /api/auth/register` is answered** (anything but `405`), an API handler is (still / again) deployed on this Worker — that must not happen: the Worker must be static only, with the API owned by `server.mjs` on its own host. Make sure `wrangler.jsonc` has no `main` entry point and redeploy (`npm run deploy`). Also make sure the build is a **production** build (non-production branches run `npx wrangler versions upload`, which creates a preview version and leaves production untouched).

1. **Codes**: `ADMIN_CODES` / `SUPER_ADMIN_CODES` belong to the **backend** environment now (not the Worker — the Worker has no variables).
2. **Persistence**: the backend stores users at `server/data/users.json`; mount a persistent disk on the backend host.
3. **Admin commands**: drive everything from the backend origin — see [`ADMIN-CONTROL.md`](ADMIN-CONTROL.md) and [`api.json`](api.json).
4. **Auto-deploy on push** (optional): Workers & Pages → `trading` → Settings → Builds → Connect repo, build command `npm run build`, deploy command `npx wrangler deploy -c wrangler.jsonc`, production branch `main`. The dashboard Worker name must equal the `name` in `wrangler.jsonc` (`trading`). A manual, verified alternative ships in `scripts/github-workflows/deploy-worker.yml` — copy it to `.github/workflows/deploy-worker.yml` to enable it (Actions → Deploy Worker → Run workflow; needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets).

### Local development

```bash
npm install
npm run dev           # Vite dev server :5173 + Express API :8080 (proxied)
npm test              # 20 backend tests
```

---

## 7. Post-deploy verification checklist

```bash
WORKER="https://trading.rufflocrm.workers.dev"   # static SPA
API="https://<your-backend-origin>"              # server.mjs

# Static Worker: SPA up, deep links work, NO API handler
curl $WORKER/                          # index.html
curl $WORKER/auth/register             # index.html (SPA fallback)
npm run verify:deployed $WORKER        # all PASS

# Backend: API live
curl $API/api/health                   # {"ok":true,...}
curl $API/api/markets                  # 32 assets, "source":"coinbase" (or "fallback")
curl "$API/api/market/klines?symbol=BTC&interval=1m"
curl -X POST $API/api/auth/register -H 'content-type: application/json' \
  -d '{"name":"Test","email":"t@t.co","phone":"+91","preferredCurrency":"INR"}'
curl "$API/api/auth/me?email=t@t.co"
```

Then in a browser (served by the Worker, talking to the API): `/login` → register → `/dashboard` shows ₹0.00 + 10,000 demo → `/trading`, `/instant-order`, `/deposit`, `/profile`, `/admin/users` with your admin code.

---

## 8. Security notes

- **Override `ADMIN_CODES`** in every deployed environment — the defaults are public in this repo.
- Login is email-only (demo product); add real auth before handling real funds.
- All amounts are sandbox/demo logic; deposits are recorded, never actually processed.
- Never commit `server/data/users.json` (already gitignored) or Cloudflare tokens.
