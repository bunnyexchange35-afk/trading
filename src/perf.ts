/**
 * Mudrexx Earn — mobile CPU / battery / thermal guards.
 *
 * Everything in here is purely operational: it decides WHEN background work
 * (polling, CSS animation loops) is allowed to run. No visual design, data
 * flow or backend contract is changed.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

export const DOCUMENT_VISIBLE_EVENT = 'mudrexx:document-visible';
export const DOCUMENT_HIDDEN_EVENT = 'mudrexx:document-hidden';

/** True while the tab is foregrounded (works on iOS Safari + Android Chrome). */
export function isPageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** True while the browser reports a network connection. */
export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Live loops may only run while the tab is visible and the browser is online. */
export function pollAllowed(): boolean {
  return isPageVisible() && isBrowserOnline();
}

type PollOptions = {
  /** Interval between runs while the tab is eligible. */
  intervalMs: number;
  /** Extra gate (e.g. "only on a route that shows this data"). */
  enabled?: boolean;
  /**
   * When the tab returns to the foreground, refresh immediately if the last
   * run is older than `intervalMs`. Default true.
   */
  refreshOnVisible?: boolean;
};

/**
 * Shared visibility-aware poller:
 *  - runs `task` once when enabled, then on `intervalMs` while eligible;
 *  - pauses completely when the tab is hidden or the browser is offline;
 *  - refreshes once when returning to a visible tab (if stale);
 *  - never overlaps two runs of the same task (stale-response storms);
 *  - always cleans up its interval + listeners on disable/unmount.
 */
export function useSmartPolling(task: () => unknown | Promise<unknown>, { intervalMs, enabled = true, refreshOnVisible = true }: PollOptions): void {
  const taskRef = useRef(task);
  taskRef.current = task;
  const lastRunRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    let disposed = false;
    let timer: number | undefined;

    const run = async (force: boolean) => {
      if (disposed || busyRef.current) return;
      if (!force && Date.now() - lastRunRef.current < 1000) return;
      busyRef.current = true;
      lastRunRef.current = Date.now();
      try {
        await taskRef.current();
      } finally {
        busyRef.current = false;
      }
    };

    const sync = () => {
      if (disposed) return;
      if (pollAllowed()) {
        if (timer === undefined) timer = window.setInterval(() => void run(false), intervalMs);
      } else if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (refreshOnVisible && Date.now() - lastRunRef.current >= intervalMs) void run(true);
        window.dispatchEvent(new Event(DOCUMENT_VISIBLE_EVENT));
      } else {
        window.dispatchEvent(new Event(DOCUMENT_HIDDEN_EVENT));
      }
      sync();
    };

    void run(true); // initial load — the page needs data for first paint
    sync();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [enabled, intervalMs, refreshOnVisible]);
}

/**
 * True while the referenced element intersects the viewport.
 * `sticky: true` keeps it true once seen (used for sections whose data should
 * keep refreshing after the user has opened them, e.g. the order board).
 */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = '150px', sticky = false }: { rootMargin?: string; sticky?: boolean } = {}
): boolean {
  const [inView, setInView] = useState(() => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry?.isIntersecting) setInView(true);
        else if (!sticky) setInView(false);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, sticky]);
  return inView;
}

