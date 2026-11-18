import { BrandMark } from './Logo';

export function PageLoader({ label = 'Preparando seu caderno…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cream-100 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-olive-200/50" aria-hidden />
        <BrandMark className="relative h-16 w-16 shadow-soft" />
      </div>
      <div>
        <p className="font-display text-xl font-semibold text-ink">Meu Caderno de Receitas</p>
        <p className="mt-1 text-sm text-ink-muted" role="status">
          {label}
        </p>
      </div>
    </div>
  );
}
