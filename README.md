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
- **Live Market Desk**: Spot, Futures, and Staking tabs with Binance public market feeds.
- **Instant Order Desk & Flight Lab**: Live chart scenarios, buy up / buy down controls, and multiplier mini-game.
- **Deposit Experience**: UPI / Bank transfer (INR) and TRC20 (USDT) funding flows recorded in the Frozen Amount section.

## Frontend ↔ Backend Integration

The React frontend (`src/`) is fully driven by the Mudrexx Express backend (`server.mjs`) — the backend is the single source of truth for all trading and wallet controls:

- **Auth & sessions**: sign-up / sign-in run through `POST /api/auth/register` and `POST /api/auth/login`; the session token is persisted in `localStorage` and re-validated against `GET /api/auth/me` on every visit.
- **Wallet controls**: demo-to-real conversion, deposits, approvals, frozen releases, orders, staking vaults, demo grants and Flight Lab wagers all execute as backend calls via the typed client in `src/api.ts`. The UI refreshes from the backend after every mutation, so balances and the Frozen Amount section always reflect server state.
- **Markets**: live quotes and klines are served by the backend from Binance public feeds with built-in fallback.
- **Persistence**: user state is stored on disk at `server/data/users.json` (gitignored), so accounts survive backend restarts and redeploys.

In development, Vite proxies `/api` to the Express server (`:8080`); in production, Express serves the built frontend from `dist/` on the same origin, so the frontend always talks to the backend relatively.

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
2. Make sure the Worker name in the dashboard matches `trading-worker` (the name
   in `trading-worker/wrangler.jsonc`), or the build will fail.
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

- The backend origin must be set through the `BACKEND_ORIGIN` variable; leave
  the project name and asset directory from `trading-worker/wrangler.jsonc`.
- API calls are same-origin (`/api/*`), so no CORS changes are needed when the
  worker proxies to the backend.
- You can also set `BACKEND_ORIGIN` in the Cloudflare dashboard under
  **Settings -> Variables and Secrets**.

## Environment Variables

| Variable | Type | Description |
| --- | --- | --- |
| `BACKEND_ORIGIN` | Cloudflare Worker | Origin of the Express API that the worker proxies `/api/*` to |
| `PORT` | Runtime | Port Express listens on (defaults to `process.env.PORT` or `8080`) |
| `NODE_ENV` | Runtime | `production` in deployed environments |
| `VITE_TELEGRAM_URL` | Build-time | Telegram support channel link |
