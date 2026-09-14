/**
 * Data-fetching and timing hooks.
 *
 * `useAsync` is the single way pages load data: it tracks loading / error /
 * data, supports cancellation, and exposes `refresh()` for the post-action
 * refetch the order flow depends on.
 *
 * `useOrderPolling` implements the polling rule from audit F13: settlement is
 * lazy and only advances when the order list is READ, so we poll while orders
 * are open, stop when none are, and back off on hidden tabs.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, isApiError, type ApiError } from '../api/client';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** True when the failure is a route this deployment does not serve. */
  unavailable: boolean;
};

type UseAsyncOptions = {
  /** Skip the request entirely (e.g. no session yet). */
  enabled?: boolean;
  /** Poll interval in ms. 0 disables polling. */
  intervalMs?: number;
  /** Refetch when the tab becomes visible again. */
  refetchOnFocus?: boolean;
};

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
): AsyncState<T> & { refresh: () => void; setData: (updater: (prev: T | null) => T | null) => void } {
  const { enabled = true, intervalMs = 0, refetchOnFocus = true } = options;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: enabled,
    error: null,
    unavailable: false,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null, unavailable: false });
      return;
    }

    const controller = new AbortController();
    let active = true;

    const run = async (isBackground: boolean) => {
      if (!isBackground) setState((prev) => ({ ...prev, loading: true }));
      try {
        const data = await fnRef.current();
        if (!active || !mounted.current) return;
        setState({ data, loading: false, error: null, unavailable: false });
      } catch (error) {
        if (!active || !mounted.current) return;
        if (controller.signal.aborted) return;
        const apiError = isApiError(error) ? error : null;
        setState((prev) => ({
          data: prev.data,
          loading: false,
          error: apiError ?? (error instanceof Error ? Object.assign(error, {}) as never : null),
          unavailable: apiError?.kind === 'missing-route' || apiError?.status === 404,
        }));
      }
    };

    void run(false);

    const timer =
      intervalMs > 0
        ? setInterval(() => {
            // Do not hammer a hidden tab.
            if (document.visibilityState === 'visible') void run(true);
          }, intervalMs)
        : null;

    const onFocus = () => {
      if (document.visibilityState === 'visible') void run(true);
    };
    if (refetchOnFocus) document.addEventListener('visibilitychange', onFocus);

    return () => {
      active = false;
      controller.abort();
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, refetchOnFocus, nonce, ...deps]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (updater: (prev: T | null) => T | null) =>
      setState((prev) => ({ ...prev, data: updater(prev.data) })),
    [],
  );

  return { ...state, refresh, setData };
}

/** Ticks every second while `until` is in the future. Display-only (F13). */
export function useCountdown(until: number | undefined, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(() => (until ? until - Date.now() : 0));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const left = until - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) expireRef.current?.();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);

  return remaining;
}

/**
 * Polls the order list only while at least one order is open.
 * Returns the number of open orders so callers can decide to keep polling.
 */
export function useOrderPolling(openCount: number, poll: () => void, intervalMs = 3000) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    if (openCount <= 0) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') pollRef.current();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [openCount, intervalMs]);
}

export function useSafeErrorMessage(error: unknown): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setMessage(error ? errorMessage(error) : null);
  }, [error]);
  return message;
}
