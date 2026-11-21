export interface User {
  id: number;
  name: string | null;
  login: string;
  createdAt: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export interface AuthResponse {
  expiresIn: number;
  csrfToken: string;
  user: User;
}

export interface MeResponse {
  user: User;
  csrfToken: string;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  timestamp: string;
  path: string;
}

export interface Category {
  id: number;
  name: string | null;
}

export interface Recipe {
  id: number;
  name: string | null;
  category: Category | null;
  preparationTimeMinutes: number | null;
  servings: number | null;
  ingredients: string | null;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  name: string;
  categoryId: number;
  preparationTimeMinutes: number;
  servings: number;
  ingredients: string;
  instructions: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedRecipes {
  data: Recipe[];
  meta: PaginationMeta;
}

export interface RecipeStats {
  totalRecipes: number;
  categoriesUsed: number;
  lastUpdatedAt: string | null;
}

export type RecipeSortField = 'name' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface RecipeQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  sortBy?: RecipeSortField;
  order?: SortOrder;
}

export interface RegisterInput {
  name: string;
  login: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  login: string;
  password: string;
}
