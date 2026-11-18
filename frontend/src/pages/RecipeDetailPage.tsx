import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  Clock,
  FileQuestion,
  ListChecks,
  Pencil,
  Printer,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { recipesApi } from '../api/services';
import { BrandMark } from '../components/layout/Logo';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { getErrorMessage, isAbortError } from '../lib/errors';
import { formatDate, formatMinutes, formatPortions, splitLines } from '../lib/format';
import type { Recipe } from '../types/api';

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-5 w-40" />
      <div className="paper-card p-8">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="mt-6 h-12 w-3/4" />
        <Skeleton className="mt-4 h-4 w-1/2" />
        <div className="mt-7 flex gap-3">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-36" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-olive-100 bg-cream-50/80 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-olive-700 shadow-sm">
        <Icon size={17} aria-hidden />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const recipeId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useDocumentTitle(recipe?.nome ?? 'Receita');

  useEffect(() => {
    if (!Number.isInteger(recipeId) || recipeId < 1) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setNotFound(false);

    recipesApi
      .get(recipeId, controller.signal)
      .then(setRecipe)
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;

        if (requestError instanceof ApiError && requestError.status === 404) {
          setNotFound(true);
          return;
        }

        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [recipeId, loadKey]);

  const handlePrint = async () => {
    await document.fonts.ready;
    window.print();
  };

  const handleDelete = async () => {
    if (!recipe) return;

    setIsDeleting(true);

    try {
      await recipesApi.remove(recipe.id);
      toast.success('Receita excluída do seu caderno.');
      navigate('/', { replace: true });
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
      setIsDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-soft transition hover:text-olive-800"
        >
          <ArrowLeft size={16} aria-hidden />
          Voltar para minhas receitas
        </Link>
        <EmptyState
          icon={<FileQuestion size={30} aria-hidden />}
          title="Receita não encontrada"
          description="Ela pode ter sido excluída ou não pertence à sua conta. Por segurança, não revelamos receitas de outros usuários."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-olive-800 px-4 py-2.5 text-sm font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900"
            >
              Voltar para minhas receitas
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-soft transition hover:text-olive-800"
        >
          <ArrowLeft size={16} aria-hidden />
          Voltar para minhas receitas
        </Link>
        <ErrorState
          title="Não foi possível carregar a receita"
          description={error ?? 'Tente novamente em instantes.'}
          onRetry={() => setLoadKey((current) => current + 1)}
        />
      </div>
    );
  }

  const title = recipe.nome?.trim() || 'Receita sem título';
  const categoryName = recipe.categoria?.nome ?? 'Sem categoria';
  const ingredients = splitLines(recipe.ingredientes).map((line) => line.replace(/^[-•*]\s*/, ''));
  const steps = splitLines(recipe.modoPreparo);

  return (
    <div className="space-y-6">
      <div className="screen-only flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-soft transition hover:text-olive-800 focus-visible:ring-2 focus-visible:ring-olive-500"
        >
          <ArrowLeft size={16} aria-hidden />
          Minhas receitas
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/receitas/${recipe.id}/editar`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-olive-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-olive-300 hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-olive-500"
          >
            <Pencil size={16} aria-hidden />
            Editar
          </Link>
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer size={16} aria-hidden />}
            onClick={() => void handlePrint()}
            className="py-2.5"
          >
            Imprimir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={16} aria-hidden />}
            onClick={() => setIsDeleteOpen(true)}
            className="py-2.5 text-terracotta-700 hover:bg-terracotta-50 hover:text-terracotta-800"
          >
            Excluir
          </Button>
        </div>
      </div>

      <article className="screen-only overflow-hidden rounded-2xl border border-olive-100/80 bg-white/85 shadow-card">
        <div className="h-1.5 bg-gradient-to-r from-olive-800 via-olive-500 to-terracotta-500" />
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="terracotta">{categoryName}</Badge>
            <Badge variant="neutral">
              <CalendarDays size={12} aria-hidden />
              Atualizada em {formatDate(recipe.alteradoEm)}
            </Badge>
          </div>

          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl">
            {title}
          </h1>

          <div className="mt-7 flex flex-wrap gap-3">
            <MetaItem
              icon={Clock}
              label="Tempo de preparo"
              value={formatMinutes(recipe.tempoPreparoMinutos)}
            />
            <MetaItem icon={Users} label="Porções" value={formatPortions(recipe.porcoes)} />
            <MetaItem icon={CalendarDays} label="Criada em" value={formatDate(recipe.criadoEm)} />
          </div>
        </div>
      </article>

      <div className="screen-only grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <section
          className="paper-card p-6 lg:sticky lg:top-6"
          aria-labelledby="titulo-ingredientes"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="titulo-ingredientes"
              className="flex items-center gap-2 font-display text-xl font-semibold text-ink"
            >
              <ListChecks size={19} className="text-terracotta-600" aria-hidden />
              Ingredientes
            </h2>
            {ingredients.length > 0 && (
              <span className="rounded-full bg-cream-200/80 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                {ingredients.length}
              </span>
            )}
          </div>

          {ingredients.length > 0 ? (
            <ul className="mt-4 divide-y divide-olive-100/80">
              {ingredients.map((ingredient, index) => (
                <li
                  key={`${ingredient}-${index}`}
                  className="flex items-start gap-3 py-2.5 text-sm leading-relaxed text-ink-soft"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta-500"
                    aria-hidden
                  />
                  {ingredient}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Ingredientes não informados.</p>
          )}
        </section>

        <section className="paper-card p-6 sm:p-8" aria-labelledby="titulo-preparo">
          <h2
            id="titulo-preparo"
            className="flex items-center gap-2 font-display text-2xl font-semibold text-ink"
          >
            <ChefHat size={21} className="text-terracotta-600" aria-hidden />
            Modo de preparo
          </h2>

          {steps.length > 1 ? (
            <ol className="mt-6 space-y-5">
              {steps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive-100 text-xs font-bold text-olive-800">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-[15px] leading-7 text-ink-soft">{step}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 whitespace-pre-line text-[15px] leading-8 text-ink-soft">
              {recipe.modoPreparo}
            </p>
          )}
        </section>
      </div>

      <article className="print-only print-recipe">
        <header className="print-avoid-break flex items-start justify-between gap-6 border-b-2 border-[#363c2b] pb-4">
          <div>
            <p className="text-[9pt] font-semibold uppercase tracking-[0.18em] text-[#555]">
              Meu Caderno de Receitas
            </p>
            <h1 className="mt-2 font-display text-[26pt] font-semibold leading-tight text-[#111]">
              {title}
            </h1>
            <p className="mt-1 text-[11pt] font-medium text-[#444]">{categoryName}</p>
          </div>
          <BrandMark className="h-14 w-14" />
        </header>

        <section className="print-avoid-break mt-5 grid grid-cols-2 gap-3 text-[11pt]">
          <p>
            <strong>Tempo de preparo:</strong> {formatMinutes(recipe.tempoPreparoMinutos)}
          </p>
          <p>
            <strong>Porções:</strong> {formatPortions(recipe.porcoes)}
          </p>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-[#ccc] pb-1 text-[13pt] font-semibold text-[#111]">
            Ingredientes
          </h2>
          {ingredients.length > 0 ? (
            <ul className="mt-3 space-y-1.5 pl-4 text-[11pt] leading-relaxed">
              {ingredients.map((ingredient, index) => (
                <li key={`print-ingredient-${index}`} className="list-disc">
                  {ingredient}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11pt]">Ingredientes não informados.</p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="border-b border-[#ccc] pb-1 text-[13pt] font-semibold text-[#111]">
            Modo de preparo
          </h2>
          {steps.length > 1 ? (
            <ol className="mt-3 space-y-2 pl-5 text-[11pt] leading-relaxed">
              {steps.map((step, index) => (
                <li key={`print-step-${index}`} className="list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 whitespace-pre-line text-[11pt] leading-relaxed">
              {recipe.modoPreparo}
            </p>
          )}
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-[#ccc] pt-3 text-[9pt] text-[#666]">
          <span>Meu Caderno de Receitas</span>
          <span>Atualizada em {formatDate(recipe.alteradoEm, true)}</span>
        </footer>
      </article>

      <ConfirmDialog
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Excluir esta receita?"
        description={`A receita “${title}” será removida do seu caderno. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir receita"
        isLoading={isDeleting}
      />
    </div>
  );
}
