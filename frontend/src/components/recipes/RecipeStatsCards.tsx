import { BookOpenText, CalendarClock, Tags } from 'lucide-react';

import { formatDate } from '../../lib/format';
import type { RecipeStats } from '../../types/api';
import { Skeleton } from '../ui/Skeleton';

interface RecipeStatsCardsProps {
  stats: RecipeStats | null;
  isLoading: boolean;
}

export function RecipeStatsCards({ stats, isLoading }: RecipeStatsCardsProps) {
  const items = [
    {
      label: 'Receitas no caderno',
      value: stats ? String(stats.totalReceitas) : '—',
      icon: BookOpenText,
      accent: 'bg-olive-100 text-olive-700',
    },
    {
      label: 'Categorias utilizadas',
      value: stats ? String(stats.categoriasUtilizadas) : '—',
      icon: Tags,
      accent: 'bg-terracotta-50 text-terracotta-700',
    },
    {
      label: 'Última atualização',
      value: stats?.atualizadaEm ? formatDate(stats.atualizadaEm) : '—',
      icon: CalendarClock,
      accent: 'bg-cream-200 text-ink-soft',
    },
  ];

  return (
    <section aria-label="Resumo do caderno" className="grid gap-3 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, accent }) => (
        <div
          key={label}
          className="flex items-center gap-3.5 rounded-xl border border-olive-100/80 bg-white/70 px-4 py-3.5 shadow-sm backdrop-blur-sm"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}
          >
            <Icon size={19} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {label}
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-5 w-16" />
            ) : (
              <p className="mt-0.5 font-display text-lg font-semibold leading-tight text-ink sm:text-xl">
                {value}
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
