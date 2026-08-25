/**
 * Cloudflare Worker for Mudrexx Earn.
 *
 * Responsibilities:
 *  1. Serve the built Vite frontend from static assets (`../dist`).
 *  2. Proxy `/api/*` requests to the Express backend so relative API calls
 *     continue to work when the frontend is hosted separately on Cloudflare.
 *
 * The backend origin is configured through the `BACKEND_ORIGIN` environment
 * variable, for example:
 *
 *   npx wrangler deploy --var BACKEND_ORIGIN:https://mudrexx-earn.onrender.com
 */

export interface Env {
  ASSETS: Fetcher;
  BACKEND_ORIGIN?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Proxy backend API calls to the Express service.
    if (url.pathname.startsWith('/api/')) {
      const backend = env.BACKEND_ORIGIN?.trim();
      if (!backend) {
        return jsonResponse(
          {
            error:
              'BACKEND_ORIGIN is not configured. Set it to the Mudrexx Express backend URL.',
          },
          503,
        );
      }

      const target = new URL(backend);
      target.pathname = url.pathname;
      target.search = url.search;

      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('content-length');

      return fetch(target.toString(), {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
      });
    }

    // Serve the built frontend (SPA fallback is handled by the asset config).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
