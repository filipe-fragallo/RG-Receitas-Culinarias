import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ToastContext, type ToastItem, type ToastVariant } from './toast-context';

const TOAST_DURATION_MS = 4800;

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: LucideIcon; container: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    container: 'border-olive-200 bg-white',
    iconClass: 'text-olive-600',
  },
  error: {
    icon: AlertCircle,
    container: 'border-terracotta-200 bg-white',
    iconClass: 'text-terracotta-600',
  },
  info: {
    icon: Info,
    container: 'border-cream-300 bg-white',
    iconClass: 'text-ink-soft',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (variant: ToastVariant, message: string) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      setToasts((current) => [...current.slice(-2), { id, variant, message }]);

      const timer = window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const currentTimers = timers.current;

    return () => {
      currentTimers.forEach((timer) => window.clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      success: (message: string) => show('success', message),
      error: (message: string) => show('error', message),
      info: (message: string) => show('info', message),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-4 top-4 z-[90] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end"
        aria-live="off"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          const Icon = style.icon;

          return (
            <div
              key={toast.id}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3.5 shadow-lift animate-toast-in ${style.container}`}
            >
              <Icon size={20} className={`mt-0.5 shrink-0 ${style.iconClass}`} aria-hidden />
              <p className="flex-1 text-sm font-medium leading-relaxed text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-ink-muted transition hover:bg-cream-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-olive-500"
                aria-label="Fechar mensagem"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
