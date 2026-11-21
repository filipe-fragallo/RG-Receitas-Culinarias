import { Search, SlidersHorizontal, X } from 'lucide-react';

import type { Category, RecipeSortField, SortOrder } from '../../types/api';
import { SelectField } from '../ui/SelectField';

interface SortOption {
  value: string;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigas' },
  { value: 'updatedAt:desc', label: 'Atualizadas recentemente' },
  { value: 'name:asc', label: 'Nome (A–Z)' },
  { value: 'name:desc', label: 'Nome (Z–A)' },
];

interface RecipeFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: Category[];
  categoryId: number | null;
  onCategoryChange: (value: number | null) => void;
  sortBy: RecipeSortField;
  order: SortOrder;
  onSortChange: (sortBy: RecipeSortField, order: SortOrder) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export function RecipeFilters({
  search,
  onSearchChange,
  categories,
  categoryId,
  onCategoryChange,
  sortBy,
  order,
  onSortChange,
  onClear,
  hasFilters,
}: RecipeFiltersProps) {
  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name ?? `Categoria ${category.id}`,
  }));

  const currentSort = `${sortBy}:${order}`;

  return (
    <section
      className="rounded-2xl border border-olive-100/80 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-5"
      aria-label="Pesquisa e filtros de receitas"
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        <SlidersHorizontal size={14} aria-hidden />
        Encontre uma receita
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
        <div className="space-y-1.5">
          <label htmlFor="recipe-search" className="block text-sm font-semibold text-ink">
            Pesquisar
          </label>
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              id="recipe-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Pesquisar pelo nome…"
              className="input-base pl-11 pr-10"
              autoComplete="off"
              maxLength={100}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted transition hover:bg-cream-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-olive-500"
                aria-label="Limpar pesquisa"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <SelectField
          id="category-filter"
          label="Categoria"
          placeholder="Todas as categorias"
          options={categoryOptions}
          value={categoryId ? String(categoryId) : ''}
          onChange={(event) =>
            onCategoryChange(event.target.value ? Number(event.target.value) : null)
          }
        />

        <SelectField
          id="recipe-sort"
          label="Ordenar por"
          options={SORT_OPTIONS}
          value={currentSort}
          onChange={(event) => {
            const [nextSort, nextOrder] = event.target.value.split(':');
            const validSort: RecipeSortField =
              nextSort === 'name' || nextSort === 'updatedAt' ? nextSort : 'createdAt';
            onSortChange(validSort, nextOrder === 'asc' ? 'asc' : 'desc');
          }}
        />

        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-olive-200 bg-white px-3.5 py-3 text-sm font-semibold text-ink-soft shadow-sm transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500 disabled:cursor-not-allowed disabled:opacity-40 lg:mb-0"
        >
          <X size={15} aria-hidden />
          Limpar
        </button>
      </div>
    </section>
  );
}
