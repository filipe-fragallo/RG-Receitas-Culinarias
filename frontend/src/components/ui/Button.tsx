import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-olive-800 text-cream-50 shadow-sm hover:bg-olive-900 active:bg-olive-950',
  secondary:
    'border border-olive-200 bg-white text-ink shadow-sm hover:border-olive-300 hover:bg-cream-50',
  ghost: 'text-ink-soft hover:bg-olive-50 hover:text-ink',
  danger: 'bg-terracotta-600 text-white shadow-sm hover:bg-terracotta-700 active:bg-terracotta-800',
  outline:
    'border border-olive-300 bg-transparent text-olive-800 hover:border-olive-500 hover:bg-olive-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE_CLASSES, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
