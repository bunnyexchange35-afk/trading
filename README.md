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

## Deploy to Cloudflare Workers

The Worker in `trading-worker/src/index.ts` **is the backend**: it serves the
built SPA, the live market endpoints, and every `/api/*` route (registration,
sign-in, wallet, deposits, orders, staking, admin/super-admin commands). One
deploy ships all of it.

- **Live Worker**: `trading` → <https://trading.rufflocrm.workers.dev>
- **Canonical config**: `wrangler.jsonc` (repo root)
- **Mirror config**: `trading-worker/wrangler.jsonc` (same Worker, paths
  relative to that directory — keep the two in sync)

```bash
npm install
npm run deploy          # npm run build && wrangler deploy -c wrangler.jsonc
npm run verify:deployed # confirms the live URL is serving the API backend
```

Manual equivalent:

```bash
npm run build                                  # type-check + build SPA into dist/
npx wrangler deploy -c wrangler.jsonc          # deploy Worker script + assets
```

> **Deploy the *script*, not just the assets.** If a deploy uploads only `dist/`
> (no `main` entry point), the Worker serves the SPA but has no API: `GET
> /api/health` returns `index.html` and `POST /api/auth/register` returns
> **405 Method Not Allowed** (static assets only allow GET/HEAD). The root
> `wrangler.jsonc` exists so Cloudflare's default deploy command
> (`npx wrangler deploy`) picks up the full Worker. Run
> `npm run verify:deployed` after any deploy to confirm.

### Automatic deploy on push to `main` (Cloudflare Workers Builds)

Cloudflare's **Workers Builds** git integration builds and deploys on every push
to the production branch — no workflow file needed. Settings live in the
dashboard under the `trading` Worker:

1. **Workers & Pages → `trading` → Settings → Builds → Connect** (this repo).
2. Keep the **Worker name in the dashboard exactly `trading`** — it must match
   `name` in `wrangler.jsonc`; a mismatch deploys to the wrong Worker and leaves
   `trading.rufflocrm.workers.dev` on an old build.
3. In **Settings → Build**, set:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy -c wrangler.jsonc`
   - **Non-production branch deploy command**: leave the default
     (`npx wrangler versions upload`) — it **does not** update production
   - **Root directory**: leave blank (repo root)
   - **Production branch**: `main`
4. After a build finishes, open the deployment and confirm it is the
   **production** deployment for the `trading` Worker, then run
   `npm run verify:deployed`.

To re-deploy the current `main` without a new commit: **Workers & Pages →
`trading` → Deployments → (latest build) → Retry deployment**, or run
`npm run deploy` locally with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
set. A ready-made manual workflow is committed at
`scripts/github-workflows/deploy-worker.yml`. Copy it to
`.github/workflows/deploy-worker.yml` (GitHub UI → **Add file** → **Create new
file**), add the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` once, then run **Actions → Deploy Worker → Run
workflow** — it deploys and verifies in a single run.

Notes:

- **Persistence**: without a `STORE` KV namespace the Worker keeps users in
  memory and **accounts reset on every deploy**. To persist:
  ```bash
  npx wrangler kv namespace create USERS
  # paste the printed id into wrangler.jsonc under kv_namespaces (binding "STORE")
  ```
- **Codes**: `ADMIN_CODES` / `SUPER_ADMIN_CODES` live in
  **Settings → Variables & Secrets** (or `wrangler secret put`); the defaults in
  the config are public. A new deployment replaces the Worker's runtime
  variables with what the config declares, so keep them in the dashboard/config.
- **Optional passthrough**: a `BACKEND` service binding or `BACKEND_ORIGIN` var
  is only needed for paths the Worker does not implement (currently none under
  `/api/*`; unknown API paths return `404`).
- API calls are same-origin (`/api/*`), so no CORS changes are needed.
- `not_found_handling: "single-page-application"` makes every non-asset path
  (e.g. `/login`, `/auth/register`) serve `dist/index.html`, so client-side
  routing works on hard refresh and direct links.

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
| `VITE_API_URL` | Build-time | Optional API origin; defaults to same-origin `/api` routes. |
| `VITE_API_KEY` | Build-time | Optional gateway key sent as `X-API-Key`; configure it in the host's build secrets, never in Git. |
| `VITE_TELEGRAM_URL` | Build-time | Telegram support channel link |
