import { ArrowUpRight, Clock, UtensilsCrossed, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatDate, formatMinutes, formatPortions, splitLines } from '../../lib/format';
import type { Recipe } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const title = recipe.name?.trim() || 'Receita sem título';
  const categoryName = recipe.category?.name ?? 'Sem categoria';
  const ingredientPreview = splitLines(recipe.ingredients)
    .map((line) => line.replace(/^[-•*]\s*/, ''))
    .slice(0, 2)
    .join(' · ');

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group block h-full rounded-2xl focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2"
      aria-label={`Ver detalhes da receita ${title}`}
    >
      <article className="paper-card flex h-full flex-col p-5 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-olive-200 group-hover:shadow-lift sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="terracotta">{categoryName}</Badge>
          <span className="rounded-full border border-olive-100 bg-cream-50 p-1.5 text-ink-muted transition group-hover:border-olive-200 group-hover:bg-olive-800 group-hover:text-cream-50">
            <ArrowUpRight size={15} aria-hidden />
          </span>
        </div>

        <h3 className="mt-4 line-clamp-2 font-display text-[1.55rem] font-semibold leading-snug text-ink">
          {title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-olive-500" aria-hidden />
            {formatMinutes(recipe.preparationTimeMinutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} className="text-olive-500" aria-hidden />
            {formatPortions(recipe.servings)}
          </span>
        </div>

        {ingredientPreview ? (
          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-soft">
            {ingredientPreview}
          </p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <UtensilsCrossed size={14} aria-hidden />
            Ingredientes não informados
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-olive-100 pt-4 text-xs text-ink-muted">
          <span>Atualizada em {formatDate(recipe.updatedAt)}</span>
          <span className="font-semibold text-olive-700 transition group-hover:text-olive-900">
            Ver receita
          </span>
        </div>
      </article>
    </Link>
  );
}

export function RecipeCardSkeleton() {
  return (
    <div className="paper-card flex h-full flex-col p-5 sm:p-6" aria-hidden>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-7 w-4/5" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-5 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-7 flex items-center justify-between border-t border-olive-100 pt-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  );
}
