# Mudrexx Earn

A responsive crypto market, wallet desk, and practice-trading web experience built with React, TypeScript, Vite, and Express.

## Included Features

- **Wallet Desk & Balance Breakdown**:
  - **Available Balance**: Liquid funds ready for instant trading, staking, or withdrawal.
  - **Frozen Amount Section**: Comprehensive inspection and release controls for funds locked in active limit scenarios, flexible earn vaults, or pending deposit verifications.
  - **Zero Balance for New Registrations**: New accounts initialize with strictly **₹0.00** real balance and receive 10,000 linked demo practice credits.
- **Demo to Real Conversion Desk**:
  - Convert practice demo earnings into real wallet INR at an indicative 10:1 ratio.
  - Quick percentage selectors (`25%`, `50%`, `75%`, `MAX`) and global conversion modal.
  - Demo-to-Real profile link status indicator and practice credit top-ups.
- **Persistent Sessions**:
  - Safe session persistence in `localStorage`. Logged-in users are never repeatedly prompted for login when navigating or taking actions.
- **Home Landing Page**: With a 10-second exchange-style launch animation and live portfolio overview.
- **Live Market Desk**: Spot, Futures, and DeFi Staking tabs with live Coinbase public market feeds across 32 assets, INR/USDT price views, category filters, and A-tier flexible + B-tier locked 30-day staking vaults.
- **Instant Order Desk & Flight Lab**: Live chart scenarios, buy up / buy down controls, and multiplier mini-game.
- **Deposit Experience**: UPI / Bank transfer (INR) and TRC20 (USDT) funding flows recorded in the Frozen Amount section.

## Frontend ↔ Backend Integration

The React frontend (`src/`) is fully driven by the Mudrexx Express backend (`server.mjs`) — the backend is the single source of truth for all trading and wallet controls:

- **Auth & sessions**: sign-up / sign-in run through `POST /api/auth/register` and `POST /api/auth/login`; the session token is persisted in `localStorage` and re-validated against `GET /api/auth/me` on every visit.
- **Wallet controls**: demo-to-real conversion, deposits, approvals, frozen releases, orders, staking vaults, demo grants and Flight Lab wagers all execute as backend calls via the typed client in `src/api.ts`. The UI refreshes from the backend after every mutation, so balances and the Frozen Amount section always reflect server state.
- **Markets**: live quotes and klines are served from Coinbase Exchange public feeds with built-in warm-cache fallback. The Cloudflare Worker serves `/api/markets`, `/api/market/klines` and `/api/health` natively (no backend needed); `server.mjs` implements the same endpoints for local development.
- **Persistence**: user state is stored on disk at `server/data/users.json` (gitignored), so accounts survive backend restarts and redeploys.

In development, Vite proxies `/api` (and V2 `/a`, `/s` access links) to the Express server (`:8080`); in production the Cloudflare Worker serves the built frontend and proxies those paths to `BACKEND_ORIGIN`.

### Live `mudrexxback` (V2 private mode)

The deployed worker can point at live **mudrexxback**, which speaks the V2 `mudrexx-control` contract — not the local Earn API in `server.mjs`.

| Call | V2 private-mode result |
| --- | --- |
| `GET /api/auth/me` | `{ "ok": true, "type": "anonymous" }` until a source/access grant exists |
| Protected Earn routes (`/api/auth/register`, `/api/wallet/*`, …) | `ACCESS_REQUIRED` |

The frontend now:

1. Sends cookies (`credentials: include`) plus any stored bearer token.
2. Detects Earn vs V2 from `/api/auth/me` instead of treating `{ ok: true, type: "anonymous" }` as a broken Earn payload.
3. Redeems V2 **source/access links** at `/a/:code` and `/s/:code` (also `?access=`, `?src=`).
4. Surfaces a private-mode banner and an access-code field instead of a generic backend error.

Old Earn register/login/wallet calls still work against local `server.mjs`. They will not succeed against live private-mode mudrexxback until a V2 access grant is present **and** the Earn wallet surface exists on that contract.

## Student desk extensions (backend-driven)

The public website never computes authoritative values. These features read their
data from backend endpoints (locally `server.mjs`, in production the worker
passes them through to the bound backend / `mudrexxback` via the existing
`BACKEND` service binding or `BACKEND_ORIGIN`):

| Feature | Endpoints |
| --- | --- |
| Instant Order desk config (assets, currencies, durations, payout %, limits) | `GET /api/order/config` (+ `/api/order/assets`, `/api/order/currencies`, `/api/order/durations`) |
| Order history page | `GET /api/orders/list` (existing route) |
| Tasks page | `GET /api/tasks` |
| Credit score & user category badge | `GET /api/credit-score`, `GET /api/credit-score/history` |
| Profile account overview (User ID, username, invitation code, admin relationship, status, last activity) | `GET /api/user/account` |
| Market detail, OHLCV & backend analysis (RSI, MACD, SMA/EMA, momentum, support/resistance, volatility, trend) | `GET /api/markets/:symbol`, `GET /api/markets/:symbol/ohlcv`, `GET /api/markets/:symbol/analysis` |
| Customer Support tickets | `GET/POST /api/support/tickets` |
| Withdrawals (never executed by the website — reviewed by support) | `POST /api/withdrawal/support` |
| Notifications | `GET /api/notifications` |
| Document catalog & invoices (PDF values generated by the backend) | `GET /api/documents`, `GET /api/account/invoice` |
| NOVA copilot | `GET /api/nova/status`, `POST /api/nova/chat` |

Market data freshness (Live / Delayed / Cached / Unavailable) is shown exactly
as the backend reports it, the browser never calls a market provider directly,
and features that a connected backend does not yet implement degrade to honest
"unavailable" states instead of falling back to frontend values.


---

## Local Development

```bash
# Install dependencies
npm install

# Start Vite dev server and Express API concurrently
npm run dev
```

- Web application: `http://localhost:5173`
- API server: `http://localhost:8080`

## Production Build & Run

```bash
# Type check and build frontend into /dist
npm run build

# Start production Express server
npm start
```

## Deploy Frontend to Cloudflare Workers

The `trading-worker/` directory contains a Cloudflare Worker that serves the
built frontend and proxies `/api/*` to the Express backend. Wrangler is a root
`devDependency`, so a single command from the repository root builds the frontend
into `dist/` and deploys the Worker (its `assets.directory` points at `../dist`):

```bash
npm run deploy
```

Deploys the Worker from `trading-worker/wrangler.jsonc`. Equivalent manual steps:

```bash
npm run build                       # build frontend into dist/
npx wrangler deploy -c trading-worker/wrangler.jsonc
```

### Automatic deploy on push to `main` (Cloudflare Workers Builds)

Cloudflare's **Workers Builds** git integration automatically builds and deploys
on every push to your production branch — no workflow file or GitHub Actions
needed. Set it up in the Cloudflare dashboard:

1. Go to **Workers & Pages**, then either:
   - **Create application -> Get started -> Import a repository**, selecting this
     repo and the `main` branch, or
   - For an existing Worker, open it -> **Settings -> Builds -> Connect**.
2. Make sure the Worker name in the dashboard matches `mudrex-earn` (the name
   in `trading-worker/wrangler.jsonc`), or the build will fail. Note: the worker
   was previously named `trading` — the first deploy under `mudrex-earn` creates
   a new Worker (`mudrex-earn.<subdomain>.workers.dev`); delete or redirect the
   old one if you had it deployed.
3. In **Settings -> Build**, set:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy -c trading-worker/wrangler.jsonc`
   - **Root directory**: leave blank (repo root)
   - **Production branch**: `main`
4. Configure the backend origin and any runtime secrets under
   **Settings -> Variables & Secrets** (see `BACKEND_ORIGIN` below). Build-time
   secrets (your own API token) go under **Settings -> Build -> Build variables
   and secrets**. By default Cloudflare auto-generates the build API token.

Notes:

- The committed `trading-worker/wrangler.jsonc` is intentionally minimal (name,
  `assets` SPA binding, observability). It has no backend wiring by default —
  everything backend-related is optional and can be added in the dashboard
  (**Settings -> Bindings / Variables & Secrets**) or appended to the config:
  a **Service Binding** (`services` entry bound to `BACKEND`), the
  `BACKEND_ORIGIN` var, or KV `config:backend-url`. Without any of these, the
  worker still serves the SPA and the native `/api/markets`,
  `/api/market/klines` and `/api/health` endpoints; other `/api/*` calls return
  `503` with a setup hint.
- API calls are same-origin (`/api/*`), so no CORS changes are needed when the
  worker proxies to the backend.
- `not_found_handling: "single-page-application"` makes every non-asset path
  (e.g. `/login`, `/dashboard`) serve `dist/index.html`, so client-side routing
  works on hard refresh and direct links.

## App Routes

| Route | Page |
| --- | --- |
| `/` (also `/dashboard`) | Home / portfolio dashboard |
| `/login` | Opens the sign-in modal (redirects to `/dashboard` when already signed in) |
| `/trading` (also `/market`) | Live market desk — spot, futures, DeFi staking |
| `/instant-order` (also `/instant order`) | Instant order desk & Flight Lab |
| `/profile` | Profile & settings |
| `/wallet`, `/deposit` | Wallet desk, deposit flows |
| `/support`, `/community` | Support, community |
| `/admin/users` | Admin users console |
| `/a/:code`, `/s/:code` | V2 access / source link redemption |

## Environment Variables & Bindings

| Variable / Binding | Type | Description |
| --- | --- | --- |
| `BACKEND` | Service Binding | Cloudflare Worker Service Binding to route backend API requests directly to another Worker |
| `BACKEND_ORIGIN` | Cloudflare Worker Var | Origin URL of the Express API that the worker proxies `/api/*` to (fallback if no service binding) |
| `PORT` | Runtime | Port Express listens on (defaults to `process.env.PORT` or `8080`) |
| `NODE_ENV` | Runtime | `production` in deployed environments |
| `VITE_TELEGRAM_URL` | Build-time | Telegram support channel link |
