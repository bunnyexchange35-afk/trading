/**
 * Canonical API transport for Mudrexx Earn.
 *
 * ONE client, ONE contract: the `server.mjs` envelope
 *   success → { success: true, ...payload }
 *   failure → { error: string }            (plus a non-2xx status)
 *
 * A few read-only market endpoints predate that envelope and return
 * `{ data: [...] }` directly; those are handled explicitly in `./index.ts`.
 *
 * Deliberately NOT ported from the previous `src/api.ts`:
 *   - no `earn | v2 | unknown` contract sniffing
 *   - no ACCESS_REQUIRED / interpretAuthBody / followLink
 *   - no /a/:code or /s/:code access-link routes
 * No backend in this repository emits those shapes.
 *
 * Identity: the bearer token is attached to EVERY request. All routes under
 * /api/{wallet,orders,deposit,withdraw,staking,user,account} are token-gated by
 * a prefix mount (server.mjs:681), and `requireAuth` answers 403 if the `email`
 * does not belong to the token — so user-scoped calls resolve `email` from the
 * session here and callers can never pass someone else's.
 */

/** Same-origin by default; override with VITE_API_URL for a split deploy. */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';

/**
 * Optional gateway key for hosted API deployments. This is intentionally a
 * separate header from the user's bearer session: the bearer identifies the
 * signed-in account, while the API key identifies the API consumer/application.
 */
const API_KEY: string = (import.meta.env.VITE_API_KEY as string | undefined)?.trim() ?? '';

const STORAGE_KEY = 'mudrexx.session.v1';

export type StoredSession = { email: string; token: string; name?: string };

export function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — session stays in memory only */
  }
}

/** Normalised API failure. `status === 0` means the request never completed. */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;

  constructor(message: string, status: number, kind: ApiErrorKind = 'api') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

export type ApiErrorKind =
  | 'network' // fetch threw / timeout — backend unreachable
  | 'timeout'
  | 'auth' // 401 — session missing, invalid or rotated away
  | 'forbidden' // 403 — invitation code, cross-account, admin code
  | 'missing-route' // 404 on a path the backend never had
  | 'not-found' // 404 on a real resource id
  | 'conflict' // 409
  | 'validation' // 400 / 422
  | 'rate-limited' // 429
  | 'server' // 5xx
  | 'malformed' // 2xx but body is not usable
  | 'api'; // anything else the backend chose to report

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/** True when the session must be re-established. */
export const isAuthError = (error: unknown): boolean =>
  isApiError(error) && (error.kind === 'auth' || error.status === 401);

/** True when a route is absent from this deployment (see the Worker gap). */
export const isMissingRoute = (error: unknown): boolean =>
  isApiError(error) && error.kind === 'missing-route';

const kindFor = (status: number): ApiErrorKind => {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'api';
};

/** Pull a human message out of whatever the backend actually returned. */
function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['error', 'message', 'detail']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 300);
  if (status === 404) return 'Not found.';
  return `Request failed (${status}).`;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  /** ms before the request is abandoned. 0 disables the timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT = 20_000;

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  // API_BASE may be absolute; rebuild without the synthetic origin.
  return path.startsWith('http') || API_BASE ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Low-level request. Resolves with the parsed JSON body for 2xx, throws
 * ApiError otherwise. Never resolves with a backend `{ error }` body as if it
 * were a success.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = DEFAULT_TIMEOUT, signal } = options;
  const token = options.token !== undefined ? options.token : readSession()?.token ?? null;

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort('timeout'), timeoutMs) : null;
  const onOuterAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      // Cookies are not part of this contract; the bearer token is.
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // A non-JSON body on an API path means we hit the SPA fallback or a proxy.
        if (response.ok) {
          throw new ApiError(
            'The backend returned an unexpected response. Check that the API is reachable.',
            response.status,
            'malformed',
          );
        }
        parsed = text;
      }
    }

    if (!response.ok) {
      const kind = kindFor(response.status);
      throw new ApiError(messageFromBody(parsed, response.status), response.status, kind);
    }

    // Some backends answer 200 with { success:false, error }. Treat as failure.
    if (parsed && typeof parsed === 'object' && 'success' in parsed) {
      const record = parsed as Record<string, unknown>;
      if (record.success === false) {
        throw new ApiError(
          messageFromBody(parsed, response.status),
          response.status === 200 ? 422 : response.status,
          'api',
        );
      }
    }

    return parsed as T;
  } catch (error) {
    if (isApiError(error)) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      const timedOut = controller.signal.reason === 'timeout';
      throw new ApiError(
        timedOut ? 'The request timed out.' : 'Request cancelled.',
        0,
        timedOut ? 'timeout' : 'network',
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError('Cannot reach the backend. Check your connection.', 0, 'network');
    }
    throw new ApiError(errorMessage(error), 0, 'network');
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

export const get = <T>(path: string, query?: RequestOptions['query'], opts?: RequestOptions) =>
  request<T>(path, { ...opts, method: 'GET', query });

export const post = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>(path, { ...opts, method: 'POST', body });

export const put = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>(path, { ...opts, method: 'PUT', body });
