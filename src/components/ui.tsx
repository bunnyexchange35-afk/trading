/**
 * Design-system primitives. New for Mudrexx Earn — none of these are ported
 * from the previous `src/components.tsx`.
 */

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

/* ------------------------------------------------------------- buttons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost' | 'outline' | 'up' | 'down';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'ghost' && 'btn-ghost',
    variant === 'outline' && 'btn-outline',
    variant === 'up' && 'btn-up',
    variant === 'down' && 'btn-down',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------------------------------------- cards */

export function Card({
  title,
  action,
  children,
  footer,
  className = '',
  style,
  pad = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  pad?: boolean;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {title && (
        <header className="card-head">
          <h2 className="card-title">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? 'card-body' : undefined}>{children}</div>
      {footer && <footer className="card-foot">{footer}</footer>}
    </section>
  );
}

/* -------------------------------------------------------------- inputs */

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label className={`label ${required ? 'label-required' : ''}`} htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** `prefix` is omitted from the base props: React types it as `string` on all
 *  HTML attributes, which would narrow our ReactNode icon prefix. */
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  invalid?: boolean;
  prefix?: ReactNode;
};

export function Input({ invalid, prefix, className = '', id, ...rest }: InputProps) {
  const input = (
    <input
      id={id}
      className={`input ${invalid ? 'input-invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
  if (!prefix) return input;
  return (
    <span className="input-affix">
      <span className="input-prefix" aria-hidden="true">
        {prefix}
      </span>
      {input}
    </span>
  );
}

export function Textarea({
  invalid,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`textarea ${invalid ? 'input-invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={`select ${invalid ? 'input-invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/* -------------------------------------------------------------- badges */

export type Tone =
  | 'neutral'
  | 'open'
  | 'won'
  | 'lost'
  | 'cancelled'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'brand'
  | 'warn'
  | 'danger'
  | 'success'
  | 'in_progress'
  | 'failed'
  | 'overdue';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const cls = tone !== 'neutral' ? `badge-${tone.replace('_', '')}`.replace('inprogress', 'inprogress') : '';
  return <span className={`badge ${cls}`}>{children}</span>;
}

/** Maps a raw backend status string onto a badge tone. */
export function statusTone(status: string): Tone {
  const s = String(status || '').toLowerCase();
  if (s === 'open' || s === 'active') return 'open';
  if (s === 'won' || s === 'completed' || s === 'credited') return 'won';
  if (s === 'lost' || s === 'failed' || s === 'restricted') return 'lost';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'pending') return 'pending';
  if (s === 'processing' || s === 'accruing') return 'processing';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'overdue') return 'overdue';
  return 'neutral';
}

/* -------------------------------------------------------------- alerts */

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warn' | 'error';
  title?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : tone === 'error' ? XCircle : Info;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} className="alert-icon" aria-hidden="true" />
      <div className="alert-body">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- stats */

export function Stat({
  label,
  value,
  foot,
  small = false,
}: {
  label: ReactNode;
  value: ReactNode;
  foot?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value num ${small ? 'stat-value-sm' : ''}`}>{value}</span>
      {foot && <span className="stat-foot">{foot}</span>}
    </div>
  );
}

/* ----------------------------------------------------------- skeletons */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="row" style={{ gap: 12 }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="sk-line" style={{ flex: c === 0 ? 2 : 1, marginBottom: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {body && <div className="empty-body">{body}</div>}
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ id: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={value === tab.id}
          className={`tab ${value === tab.id ? 'tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {typeof tab.count === 'number' && <span className="faint"> · {tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    // Move focus into the dialog for keyboard users.
    ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <header className="card-head">
          <h2 className="card-title" id={titleId}>
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </Button>
        </header>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- meter */

export function Meter({ pct, tone = 'brand' }: { pct: number; tone?: 'brand' | 'up' }) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`meter-fill ${tone === 'up' ? 'meter-fill-up' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- key/value */

export function KeyValue({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-key">{k}</span>
      <span className="kv-val">{v}</span>
    </div>
  );
}
