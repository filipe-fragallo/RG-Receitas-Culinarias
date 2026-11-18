import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

type BadgeVariant = 'olive' | 'terracotta' | 'cream' | 'neutral';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  olive: 'bg-olive-100 text-olive-800 ring-olive-200/70',
  terracotta: 'bg-terracotta-50 text-terracotta-700 ring-terracotta-200/70',
  cream: 'bg-cream-200/80 text-ink-soft ring-cream-300',
  neutral: 'bg-white/80 text-ink-soft ring-olive-100',
};

export function Badge({ children, variant = 'olive', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
