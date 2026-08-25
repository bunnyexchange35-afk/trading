export interface Env {
  ASSETS: Fetcher;
  KV: KVNamespace;
  BACKEND_ORIGIN?: string;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy backend API calls
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/a/') || url.pathname.startsWith('/s/')) {
      let backend;

      // Check KV first (change URL without redeploy)
      try {
        const kvValue = await env.KV?.get('config:backend-url');
        if (kvValue && kvValue.trim()) {
          backend = kvValue.trim();
        }
      } catch {}

      // Fall back to env var
      if (!backend) {
        backend = env.BACKEND_ORIGIN?.trim();
      }

      if (!backend) {
        return jsonResponse(
          { error: 'Backend URL not configured. Set config:backend-url in mudrexx KV or BACKEND_ORIGIN var.' },
          503
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

    // Serve the frontend
    return env.ASSETS.fetch(request);
  },
};
