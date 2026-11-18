import type {
  AuthResponse,
  Category,
  LoginInput,
  PaginatedRecipes,
  Recipe,
  RecipeInput,
  RecipeQuery,
  RecipeStats,
  RegisterInput,
  User,
} from '../types/api';
import { apiRequest } from './client';

function buildQueryString(query: RecipeQuery): string {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.categoriaId) params.set('categoriaId', String(query.categoriaId));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.order) params.set('order', query.order);

  const value = params.toString();
  return value ? `?${value}` : '';
}

export const authApi = {
  register(input: RegisterInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    });
  },

  login(input: LoginInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
  },

  me(): Promise<User> {
    return apiRequest<User>('/auth/me');
  },

  logout(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
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
