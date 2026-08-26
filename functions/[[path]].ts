// Cloudflare Pages Function: catch-all
//
// Cloudflare Pages serves real static files first, so the assets in
// dist/ are untouched. This catch-all only runs for paths that do not
// match a static file. It mirrors the standalone Worker's routing for
// the remaining dynamic paths and falls back to index.html so
// client-side routing keeps working (same behavior as the Express
// server's `app.get('*')`).

import worker from '../trading-worker/src/index.ts';
import type { Env } from '../trading-worker/src/index.ts';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Backend proxy paths (V2 access links and verification) — delegate to
  // the shared Worker handler, exactly like the standalone deployment.
  if (
    url.pathname.startsWith('/a/') ||
    url.pathname.startsWith('/s/') ||
    url.pathname.startsWith('/verify')
  ) {
    return worker.fetch(context.request, context.env as unknown as Env, context);
  }

  // SPA fallback: let the asset pipeline answer first (defensive —
  // asset paths are normally excluded from Functions routing already).
  const asset = await context.env.ASSETS.fetch(context.request);
  if (asset.status !== 404) return asset;

  const lastSegment = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  // Real missing files (e.g. /favicon.ico) should stay 404, not become HTML.
  if (lastSegment.includes('.')) return asset;

  const index = await context.env.ASSETS.fetch(new Request(`${url.origin}/index.html`, context.request));
  if (!index.ok) return index;
  return new Response(index.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
};
