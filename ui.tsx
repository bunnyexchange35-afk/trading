import { useEffect, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Card({ title, subtitle, actions, children, className = '' }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-600/70 px-4 py-3 sm:px-5">
          <div>
            {title && <h3 className="font-display text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'green', onClick }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: 'green' | 'cyan' | 'purple' | 'red' | 'amber';
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    green: 'text-neon-green bg-neon-green/10 ring-neon-green/20',
    cyan: 'text-neon-cyan bg-neon-cyan/10 ring-neon-cyan/20',
    purple: 'text-neon-purple bg-neon-purple/10 ring-neon-purple/20',
    red: 'text-neon-red bg-neon-red/10 ring-neon-red/20',
    amber: 'text-neon-amber bg-neon-amber/10 ring-neon-amber/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass card-pad group text-left transition hover:border-ink-500 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <span className={`rounded-md p-1.5 ring-1 ring-inset ${tones[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={onClose} />
      <div className={`glass relative my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-ink-850/95 shadow-card fade-up`}>
        <header className="flex items-center justify-between border-b border-ink-600/70 px-5 py-3.5">
          <h3 className="font-display text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="hcc-label">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`hcc-input ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`hcc-input appearance-none ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`hcc-input min-h-[90px] ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-neon-green/80' : 'bg-ink-600'} ${disabled ? 'opacity-40' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-neon-cyan ${className}`} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({ label = 'No data yet', hint }: { label?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <div className="rounded-full bg-ink-800 p-3 text-2xl">🛰️</div>
      <p className="mt-2 text-sm text-slate-400">{label}</p>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-50 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="hcc-btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className={danger ? 'hcc-btn-danger' : 'hcc-btn-primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Data-table shell with sticky-ish header styling. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-600/70">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}
