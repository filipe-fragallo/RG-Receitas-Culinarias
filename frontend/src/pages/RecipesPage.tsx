import { BookOpenText, Plus, SearchX, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { categoriesApi, recipesApi } from '../api/services';
import { RecipeCard, RecipeCardSkeleton } from '../components/recipes/RecipeCard';
import { RecipeFilters } from '../components/recipes/RecipeFilters';
import { RecipeStatsCards } from '../components/recipes/RecipeStatsCards';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Pagination } from '../components/ui/Pagination';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { getErrorMessage, isAbortError } from '../lib/errors';
import { getFirstName } from '../lib/format';
import type {
  Category,
  PaginatedRecipes,
  RecipeSortField,
  RecipeStats,
  SortOrder,
} from '../types/api';

const PAGE_SIZE = 9;

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseCategoryId(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSort(value: string | null): RecipeSortField {
  return value === 'nome' || value === 'alteradoEm' ? value : 'criadoEm';
}

function currentGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function RecipesPage() {
  useDocumentTitle('Minhas receitas');
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get('pagina'));
  const search = searchParams.get('busca')?.trim() ?? '';
  const categoriaId = parseCategoryId(searchParams.get('categoria'));
  const sortBy = parseSort(searchParams.get('ordenar'));
  const order: SortOrder = searchParams.get('direcao') === 'asc' ? 'asc' : 'desc';

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<PaginatedRecipes | null>(null);
  const [stats, setStats] = useState<RecipeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const hasFilters = Boolean(search || categoriaId);

  const updateParams = useCallback(
    (changes: Record<string, string | null>, options?: { replace?: boolean }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          Object.entries(changes).forEach(([key, value]) => {
            if (value === null || value === '') {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          });

          return next;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const normalized = debouncedSearch.trim();

    // Enquanto o usuário ainda está digitando, o valor debounced fica atrás do
    // input. Isso evita que um "Limpar filtros" reaplique a busca antiga.
    if (debouncedSearch !== searchInput) {
      return;
    }

    if (normalized === search) {
      return;
    }

    updateParams({ busca: normalized || null, pagina: null }, { replace: true });
  }, [debouncedSearch, searchInput, search, updateParams]);

  useEffect(() => {
    const controller = new AbortController();

    categoriesApi
      .list(controller.signal)
      .then(setCategories)
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;
        toast.error('Não foi possível carregar as categorias.');
      });

    return () => controller.abort();
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    recipesApi
      .list(
        {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          categoriaId: categoriaId ?? undefined,
          sortBy,
          order,
        },
        controller.signal,
      )
      .then(setRecipes)
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, search, categoriaId, sortBy, order, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setIsStatsLoading(true);

    recipesApi
      .stats(controller.signal)
      .then(setStats)
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;
        setStats(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsStatsLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadKey]);

  const reload = () => setReloadKey((current) => current + 1);

  const handlePageChange = (nextPage: number) => {
    updateParams({ pagina: nextPage > 1 ? String(nextPage) : null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchInput('');
    updateParams({ busca: null, categoria: null, pagina: null });
  };

  const firstName = getFirstName(user?.nome ?? user?.login);
  const total = recipes?.meta.total ?? 0;

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta-700">
            {currentGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Minhas receitas
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Tudo o que você cozinhou, anotou e quer guardar — organizado em um só lugar.
          </p>
        </div>

        <Link
          to="/receitas/nova"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-olive-800 px-5 py-3.5 text-sm font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900 focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 sm:w-auto"
        >
          <Plus size={19} aria-hidden />
          Nova receita
        </Link>
      </section>

      <RecipeStatsCards stats={stats} isLoading={isStatsLoading} />

      <RecipeFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        categories={categories}
        categoriaId={categoriaId}
        onCategoryChange={(value) =>
          updateParams({ categoria: value ? String(value) : null, pagina: null })
        }
        sortBy={sortBy}
        order={order}
        onSortChange={(nextSortBy, nextOrder) =>
          updateParams({
            ordenar: nextSortBy === 'criadoEm' ? null : nextSortBy,
            direcao: nextOrder === 'desc' ? null : nextOrder,
            pagina: null,
          })
        }
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted" role="status" aria-live="polite">
          {isLoading
            ? 'Buscando receitas…'
            : `${total} ${total === 1 ? 'receita encontrada' : 'receitas encontradas'}`}
          {hasFilters && !isLoading && (
            <span className="text-ink-muted/80"> com os filtros atuais</span>
          )}
        </p>
        {search && !isLoading && (
          <p className="text-xs text-ink-muted">
            Pesquisa por <span className="font-semibold text-ink">“{search}”</span>
          </p>
        )}
      </div>

      <section aria-busy={isLoading} aria-label="Lista de receitas">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <RecipeCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar suas receitas"
            description={error}
            onRetry={reload}
          />
        ) : recipes && recipes.data.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recipes.data.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={recipes.meta.totalPages}
              total={recipes.meta.total}
              onPageChange={handlePageChange}
            />
          </>
        ) : hasFilters ? (
          <EmptyState
            icon={<SearchX size={30} aria-hidden />}
            title="Nenhuma receita encontrada"
            description="Tente outro termo de pesquisa ou escolha uma categoria diferente. Seus filtros continuam salvos na URL."
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-olive-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500"
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<BookOpenText size={30} aria-hidden />}
            title="Seu caderno está em branco"
            description="Comece registrando a primeira receita. Pode ser aquele prato simples que sempre dá certo — ou a receita de família que ninguém quer perder."
            action={
              <Link
                to="/receitas/nova"
                className="inline-flex items-center gap-2 rounded-xl bg-olive-800 px-5 py-3 text-sm font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900 focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2"
              >
                <Plus size={18} aria-hidden />
                Criar primeira receita
              </Link>
            }
          />
        )}
      </section>

      {!isLoading && !error && total > 0 && (
        <p className="flex items-center justify-center gap-2 text-xs text-ink-muted">
          <Sparkles size={13} className="text-terracotta-500" aria-hidden />
          Cada receita guardada é uma história que continua viva.
        </p>
      )}
    </div>
  );
}
