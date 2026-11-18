import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-olive-200 bg-white/60 px-6 py-14 text-center sm:py-16',
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-olive-100 text-olive-700 shadow-sm">
        {icon}
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
