// Cloudflare Pages Function: /api/*
//
// Delegates every /api/* request to the same request handler used by the
// standalone Cloudflare Worker (trading-worker/src/index.ts), so the
// Pages deployment and the Worker deployment share one implementation:
//
//   - /api/markets, /api/market/klines, /api/health are served natively
//     from Coinbase public market data (no backend needed)
//   - everything else under /api/* is proxied to the Earn backend via
//     the BACKEND service binding, the `config:backend-url` KV entry, or
//     the BACKEND_ORIGIN environment variable (503 when unconfigured)
//
// On Pages, the binding/var resolution happens through the Pages project's
// environment (set BACKEND_ORIGIN in the dashboard under Settings ->
// Environment variables), and the static site itself is served by the
// Pages asset pipeline from `dist`.

import worker from '../../trading-worker/src/index.ts';
import type { Env } from '../../trading-worker/src/index.ts';

export const onRequest: PagesFunction = async (context) => {
  // The Worker handler expects (request, env, ctx-with-waitUntil); the
  // Pages EventContext itself provides waitUntil, so it is passed through
  // as the execution context.
  return worker.fetch(context.request, context.env as unknown as Env, context);
};
