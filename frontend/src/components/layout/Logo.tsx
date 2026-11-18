import { cn } from '../../lib/cn';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Meu Caderno de Receitas"
    >
      <rect width="64" height="64" rx="18" fill="#363C2B" />
      <path d="M17 21.5c5-2.4 9-2.4 15 0v23c-6-2.4-10-2.4-15 0v-23Z" fill="#FAF6EC" />
      <path d="M47 21.5c-5-2.4-9-2.4-15 0v23c6-2.4 10-2.4 15 0v-23Z" fill="#E9DEC2" />
      <path d="M32 18.5c0-4 2.7-7 7-7" stroke="#D07C56" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M39 11.5c2.4.4 3.7 2 4 4.3-2.4.2-4.1-.9-4.7-2.9" fill="#D07C56" />
      <path
        d="M32 21.5v23"
        stroke="#A94A2D"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}

interface LogoProps {
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export function Logo({ tone = 'dark', compact = false, className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark className={compact ? 'h-9 w-9' : 'h-11 w-11'} />
      <div className="leading-none">
        <p
          className={cn(
            'font-display font-semibold tracking-tight',
            compact ? 'text-base' : 'text-lg',
            tone === 'light' ? 'text-cream-50' : 'text-ink',
          )}
        >
          Meu Caderno
        </p>
        <p
          className={cn(
            'mt-1 text-[10px] font-semibold uppercase tracking-[0.26em]',
            tone === 'light' ? 'text-cream-300/80' : 'text-ink-muted',
          )}
        >
          de Receitas
        </p>
      </div>
    </div>
  );
}
