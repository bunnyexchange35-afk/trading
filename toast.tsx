import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void }>({
  push: () => undefined,
});

export const useToast = () => useContext(ToastCtx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const icon = (k: ToastKind) =>
    k === 'success' ? (
      <CheckCircle2 className="h-4 w-4 text-neon-green" />
    ) : k === 'error' ? (
      <AlertTriangle className="h-4 w-4 text-neon-red" />
    ) : (
      <Info className="h-4 w-4 text-neon-cyan" />
    );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,90vw)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass pointer-events-auto flex items-start gap-3 border-ink-500 bg-ink-800/90 p-3 shadow-card fade-up"
          >
            <span className="mt-0.5 shrink-0">{icon(t.kind)}</span>
            <p className="flex-1 text-sm text-slate-200">{t.message}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
