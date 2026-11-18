import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-olive-100 bg-white/60 px-4 py-3 sm:flex-row"
      aria-label="Paginação das receitas"
    >
      <p className="text-sm text-ink-muted">
        Página <span className="font-semibold text-ink">{page}</span> de{' '}
        <span className="font-semibold text-ink">{totalPages}</span>
        <span className="mx-2 text-olive-300" aria-hidden>
          ·
        </span>
        {total} {total === 1 ? 'receita' : 'receitas'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-olive-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500',
            page <= 1 && 'cursor-not-allowed opacity-50',
          )}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} aria-hidden />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-olive-200 bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500',
            page >= totalPages && 'cursor-not-allowed opacity-50',
          )}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
