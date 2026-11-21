import type {
  AuthResponse,
  Category,
  CsrfResponse,
  LoginInput,
  MeResponse,
  PaginatedRecipes,
  Recipe,
  RecipeInput,
  RecipeQuery,
  RecipeStats,
  RegisterInput,
  User,
} from '../types/api';
import { ApiError, apiRequest, setCsrfToken } from './client';

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    (candidate.name === null || typeof candidate.name === 'string') &&
    typeof candidate.login === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}

function buildQueryString(query: RecipeQuery): string {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.categoryId) params.set('categoryId', String(query.categoryId));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.order) params.set('order', query.order);

  const value = params.toString();
  return value ? `?${value}` : '';
}

export const authApi = {
  csrf(): Promise<CsrfResponse> {
    return apiRequest<CsrfResponse>('/auth/csrf').then((value) => {
      if (typeof value.csrfToken !== 'string') {
        throw new ApiError(500, 'Resposta inválida do servidor ao iniciar a proteção da sessão.');
      }
      setCsrfToken(value.csrfToken);
      return value;
    });
  },

  register(input: RegisterInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    }).then((value) => {
      setCsrfToken(value.csrfToken);
      return value;
    });
  },

  login(input: LoginInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    }).then((value) => {
      setCsrfToken(value.csrfToken);
      return value;
    });
  },

  me(): Promise<User> {
    // Além de devolver o usuário, /auth/me sincroniza o cookie HttpOnly
    // rg_csrf quando a restauração da página o perdeu. O token volta no JSON
    // apenas para a memória do cliente; o JWT continua inacessível ao JS.
    // Uma sessão expirada na restauração inicial deve gerar apenas o estado
    // anônimo, sem toast global de expiração.
    return apiRequest<MeResponse>('/auth/me', { notifyExpiry: false }).then((value) => {
      if (!isUser(value.user) || typeof value.csrfToken !== 'string') {
        throw new ApiError(500, 'Resposta inválida do servidor ao carregar o perfil.');
      }
      setCsrfToken(value.csrfToken);
      return value.user;
    });
  },

  logout(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      notifyExpiry: false,
    });
  },
};

export const categoriesApi = {
  list(signal?: AbortSignal): Promise<Category[]> {
    return apiRequest<Category[]>('/categories', { signal });
  },
};

export const recipesApi = {
  list(query: RecipeQuery, signal?: AbortSignal): Promise<PaginatedRecipes> {
    return apiRequest<PaginatedRecipes>(`/recipes${buildQueryString(query)}`, { signal });
  },

  stats(signal?: AbortSignal): Promise<RecipeStats> {
    return apiRequest<RecipeStats>('/recipes/stats', { signal });
  },

  get(id: number, signal?: AbortSignal): Promise<Recipe> {
    return apiRequest<Recipe>(`/recipes/${id}`, { signal });
  },

  create(input: RecipeInput): Promise<Recipe> {
    return apiRequest<Recipe>('/recipes', { method: 'POST', body: input });
  },

  update(id: number, input: Partial<RecipeInput>): Promise<Recipe> {
    return apiRequest<Recipe>(`/recipes/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: number): Promise<void> {
    return apiRequest<void>(`/recipes/${id}`, { method: 'DELETE' });
  },
};
