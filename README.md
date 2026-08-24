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
- **Home Landing Page**: With 30-second 3D wealth-wallet intro and live portfolio overview.
- **Live Market Desk**: Spot, Futures, and Staking tabs with Binance public market feeds.
- **Instant Order Desk & Flight Lab**: Live chart scenarios, buy up / buy down controls, and multiplier mini-game.
- **Deposit Experience**: UPI / Bank transfer (INR) and TRC20 (USDT) funding flows recorded in the Frozen Amount section.

---

## Deploy to Render (render.com)

You can deploy this application on Render as a **Node.js Web Service** or a **Docker Web Service**:

### Option 1: Native Node Web Service (Recommended)

1. Log in to [Render](https://render.com) and click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Name**: `mudrexx-earn`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.mjs`
   - **Plan**: `Free` (or higher)
4. Under **Advanced**:
   - **Health Check Path**: `/api/health`
5. Click **Create Web Service**. Render will automatically build the frontend into `dist/` and start the Express server on port `$PORT`.

### Option 2: Render Blueprint (`render.yaml`)

This repository includes a `render.yaml` blueprint. On Render, click **Blueprints** -> **New Blueprint Instance**, select this repository, and Render will configure and deploy the service automatically.

### Option 3: Docker Deployment on Render

1. Click **New +** -> **Web Service**.
2. Select **Docker** as the environment.
3. Render will build using the included multi-stage `Dockerfile`.

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

## Environment Variables

| Variable | Type | Description |
| --- | --- | --- |
| `PORT` | Runtime | Port Express listens on (defaults to `process.env.PORT` or `8080`) |
| `NODE_ENV` | Runtime | `production` in deployed environments |
| `VITE_TELEGRAM_URL` | Build-time | Telegram support channel link |
