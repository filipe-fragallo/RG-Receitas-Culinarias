import { ArrowLeft, Check, ChefHat, ListChecks, Loader2, NotebookPen, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { categoriesApi, recipesApi } from '../api/services';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { SelectField } from '../components/ui/SelectField';
import { Skeleton } from '../components/ui/Skeleton';
import { TextAreaField } from '../components/ui/TextAreaField';
import { TextField } from '../components/ui/TextField';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { getErrorDetails, getErrorMessage, isAbortError } from '../lib/errors';
import { hasErrors, validateRecipeForm, type FormErrors } from '../lib/validation';
import type { Category, RecipeInput } from '../types/api';
import { EMPTY_RECIPE_FORM, type RecipeFormValues } from '../types/forms';

const CHECKLIST = [
  'Nome curto e fácil de reconhecer',
  'Ingredientes em linhas separadas',
  'Passos na ordem em que você cozinha',
];

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof NotebookPen;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive-100 text-olive-700">
        <Icon size={19} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="paper-card space-y-5 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="paper-card space-y-4 p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const recipeId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentTitle(isEditing ? 'Editar receita' : 'Nova receita');

  const [values, setValues] = useState<RecipeFormValues>(EMPTY_RECIPE_FORM);
  const [errors, setErrors] = useState<FormErrors<keyof RecipeFormValues>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsCategoriesLoading(true);

    categoriesApi
      .list(controller.signal)
      .then(setCategories)
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;
        toast.error('Não foi possível carregar as categorias.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCategoriesLoading(false);
      });

    return () => controller.abort();
  }, [toast]);

  useEffect(() => {
    if (!isEditing) {
      setIsLoading(false);
      return;
    }

    if (!Number.isInteger(recipeId) || recipeId < 1) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    setNotFound(false);

    recipesApi
      .get(recipeId, controller.signal)
      .then((recipe) => {
        setValues({
          nome: recipe.nome ?? '',
          categoriaId: recipe.categoria ? String(recipe.categoria.id) : '',
          tempoPreparoMinutos:
            recipe.tempoPreparoMinutos !== null ? String(recipe.tempoPreparoMinutos) : '',
          porcoes: recipe.porcoes !== null ? String(recipe.porcoes) : '',
          ingredientes: recipe.ingredientes ?? '',
          modoPreparo: recipe.modoPreparo,
        });
      })
      .catch((requestError: unknown) => {
        if (isAbortError(requestError)) return;

        if (requestError instanceof ApiError && requestError.status === 404) {
          setNotFound(true);
          return;
        }

        setLoadError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isEditing, recipeId, loadKey]);

  const handleChange = (field: keyof RecipeFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setServerDetails([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerDetails([]);

    const validationErrors = validateRecipeForm(values);
    setErrors(validationErrors);

    if (hasErrors(validationErrors)) {
      return;
    }

    const payload: RecipeInput = {
      nome: values.nome.trim(),
      categoriaId: Number(values.categoriaId),
      tempoPreparoMinutos: Number(values.tempoPreparoMinutos),
      porcoes: Number(values.porcoes),
      ingredientes: values.ingredientes.trim(),
      modoPreparo: values.modoPreparo.trim(),
    };

    setIsSubmitting(true);

    try {
      const saved = isEditing
        ? await recipesApi.update(recipeId, payload)
        : await recipesApi.create(payload);

      toast.success(isEditing ? 'Receita atualizada com sucesso.' : 'Receita criada. Bom apetite!');
      navigate(`/receitas/${saved.id}`, { replace: true });
    } catch (requestError) {
      setServerError(getErrorMessage(requestError));
      setServerDetails(getErrorDetails(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    navigate(isEditing && Number.isInteger(recipeId) ? `/receitas/${recipeId}` : '/');
  };

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.nome ?? `Categoria ${category.id}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={isEditing ? `/receitas/${recipeId}` : '/'}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-ink-soft transition hover:text-olive-800 focus-visible:ring-2 focus-visible:ring-olive-500"
        >
          <ArrowLeft size={16} aria-hidden />
          {isEditing ? 'Voltar para a receita' : 'Voltar para minhas receitas'}
        </Link>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink">
          {isEditing ? 'Editar receita' : 'Nova receita'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {isEditing
            ? 'Ajuste os detalhes com calma. As alterações aparecem imediatamente no seu caderno.'
            : 'Registre os detalhes do prato. Você poderá editar tudo depois, sempre que quiser.'}
        </p>
      </div>

      {isLoading ? (
        <FormSkeleton />
      ) : notFound ? (
        <EmptyState
          icon={<NotebookPen size={30} aria-hidden />}
          title="Receita não encontrada"
          description="Ela pode ter sido excluída ou não pertence à sua conta."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-olive-800 px-4 py-2.5 text-sm font-semibold text-cream-50 shadow-sm transition hover:bg-olive-900"
            >
              Voltar para minhas receitas
            </Link>
          }
        />
      ) : loadError ? (
        <ErrorState
          title="Não foi possível carregar a receita"
          description={loadError}
          onRetry={() => setLoadKey((current) => current + 1)}
        />
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          aria-busy={isSubmitting}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start"
        >
          <div className="space-y-5">
            {(serverError || serverDetails.length > 0) && (
              <div
                role="alert"
                className="rounded-xl border border-terracotta-200 bg-terracotta-50/80 px-4 py-3.5 text-sm text-terracotta-800"
              >
                <p className="font-semibold">
                  {serverError ?? 'Dados inválidos. Revise os campos.'}
                </p>
                {serverDetails.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-terracotta-700">
                    {serverDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <section className="paper-card space-y-5 p-5 sm:p-7">
              <SectionHeader
                icon={NotebookPen}
                title="Sobre a receita"
                description="As informações que aparecem primeiro no seu caderno."
              />

              <TextField
                id="nome-receita"
                label="Nome da receita"
                value={values.nome}
                onChange={(event) => handleChange('nome', event.target.value)}
                error={errors.nome}
                hint={`${values.nome.length}/45 caracteres`}
                placeholder="Ex.: Bolo de cenoura da vó"
                maxLength={45}
                required
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  id="categoria-receita"
                  label="Categoria"
                  placeholder={
                    isCategoriesLoading ? 'Carregando categorias…' : 'Selecione uma categoria'
                  }
                  options={categoryOptions}
                  value={values.categoriaId}
                  onChange={(event) => handleChange('categoriaId', event.target.value)}
                  error={errors.categoriaId}
                  disabled={isCategoriesLoading}
                  required
                />

                <TextField
                  id="tempo-preparo"
                  label="Tempo de preparo"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100000}
                  value={values.tempoPreparoMinutos}
                  onChange={(event) => handleChange('tempoPreparoMinutos', event.target.value)}
                  error={errors.tempoPreparoMinutos}
                  hint="Em minutos. Ex.: 45"
                  placeholder="45"
                  required
                />

                <TextField
                  id="porcoes"
                  label="Porções"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={values.porcoes}
                  onChange={(event) => handleChange('porcoes', event.target.value)}
                  error={errors.porcoes}
                  hint="Quantas pessoas serve?"
                  placeholder="8"
                  required
                />
              </div>
            </section>

            <section className="paper-card space-y-5 p-5 sm:p-7">
              <SectionHeader
                icon={ListChecks}
                title="Ingredientes"
                description="Uma linha por ingrediente deixa a leitura mais clara."
              />
              <TextAreaField
                id="ingredientes"
                label="O que vai na receita"
                value={values.ingredientes}
                onChange={(event) => handleChange('ingredientes', event.target.value)}
                error={errors.ingredientes}
                hint="Ex.: 3 cenouras médias · 3 ovos · 2 xícaras de farinha"
                placeholder={'3 cenouras médias\n3 ovos\n2 xícaras de farinha de trigo'}
                rows={8}
                maxLength={5000}
                showCount
                required
              />
            </section>

            <section className="paper-card space-y-5 p-5 sm:p-7">
              <SectionHeader
                icon={ChefHat}
                title="Modo de preparo"
                description="Descreva o passo a passo, inclusive os detalhes que fazem diferença."
              />
              <TextAreaField
                id="modo-preparo"
                label="Como preparar"
                value={values.modoPreparo}
                onChange={(event) => handleChange('modoPreparo', event.target.value)}
                error={errors.modoPreparo}
                hint="Você pode usar uma linha por etapa ou escrever em parágrafos."
                placeholder={
                  'Bata as cenouras, os ovos e o óleo no liquidificador.\nMisture os ingredientes secos e asse por 40 minutos.'
                }
                rows={12}
                maxLength={10000}
                showCount
                required
              />
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="paper-card p-5">
              <h2 className="font-display text-lg font-semibold text-ink">Antes de salvar</h2>
              <ul className="mt-3 space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-olive-100 text-olive-700">
                      <Check size={11} aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                type="submit"
                size="lg"
                fullWidth
                className="mt-5"
                isLoading={isSubmitting}
                icon={<Save size={18} aria-hidden />}
              >
                {isSubmitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar receita'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                className="mt-2"
                onClick={goBack}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>

            <div className="rounded-xl border border-cream-300/80 bg-cream-200/50 p-4 text-xs leading-relaxed text-ink-soft">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Loader2 size={13} className="text-terracotta-600" aria-hidden />
                Salvamento seguro
              </p>
              <p className="mt-1.5">
                O servidor valida todos os campos novamente e garante que a receita pertence à sua
                conta.
              </p>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
