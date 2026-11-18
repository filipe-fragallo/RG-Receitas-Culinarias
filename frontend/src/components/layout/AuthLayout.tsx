import { ArrowRight, ChefHat, LockKeyhole, Printer, Search, Tags } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from './Logo';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

const FEATURES = [
  { icon: LockKeyhole, label: 'Receitas privadas' },
  { icon: Search, label: 'Busca e filtros' },
  { icon: Tags, label: '13 categorias' },
  { icon: Printer, label: 'Impressão A4' },
];

export function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-olive-950 px-12 py-12 text-cream-50 lg:flex xl:px-16">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-olive-700/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-terracotta-700/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-10 top-1/3 h-40 w-40 rounded-full border border-cream-200/10"
          aria-hidden
        />

        <Link
          to="/login"
          className="relative w-fit rounded-xl focus-visible:ring-cream-200 focus-visible:ring-offset-olive-950"
          aria-label="Meu Caderno de Receitas"
        >
          <Logo tone="light" />
        </Link>

        <div className="relative max-w-lg py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-200/20 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream-200">
            <ChefHat size={14} aria-hidden />
            Seu caderno digital
          </span>
          <h1 className="mt-7 font-display text-5xl font-medium leading-[1.08] text-cream-50 xl:text-[3.5rem]">
            Receitas que contam histórias.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-cream-200/75">
            Guarde os pratos que você ama, organize por categoria e leve a receita para a cozinha —
            inclusive no papel.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3"
              >
                <Icon size={16} className="shrink-0 text-terracotta-300" aria-hidden />
                <span className="text-xs font-medium text-cream-200/90">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <blockquote className="relative max-w-md border-l-2 border-terracotta-400/70 pl-4">
          <p className="font-display text-lg italic leading-relaxed text-cream-100/90">
            “Cozinhar é o ato de transformar ingredientes simples em memórias.”
          </p>
          <footer className="mt-2 text-xs uppercase tracking-[0.18em] text-cream-300/60">
            Meu Caderno de Receitas
          </footer>
        </blockquote>
      </aside>

      <main className="relative flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:min-h-0 lg:px-14 lg:py-10 xl:px-20">
        <div className="lg:hidden">
          <Logo />
        </div>

        <div className="flex flex-1 items-center justify-center py-10 lg:py-6">
          <div className="w-full max-w-md animate-fade-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-terracotta-700">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink sm:text-[2.65rem]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{description}</p>

            <div className="mt-8">{children}</div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-olive-100 pt-6 text-sm text-ink-soft">
              {footer}
              <ArrowRight size={16} className="shrink-0 text-olive-400" aria-hidden />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} Meu Caderno de Receitas
        </p>
      </main>
    </div>
  );
}
