/** Shared tiny utilities. */

export const nowIso = () => new Date().toISOString();

export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randFloat = (min: number, max: number, decimals = 2) => {
  const v = Math.random() * (max - min) + min;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/** Crude deterministic slug. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
