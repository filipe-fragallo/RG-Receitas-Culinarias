export interface User {
  id: number;
  nome: string | null;
  login: string;
  criadoEm: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
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
  nome: string | null;
}

export interface Recipe {
  id: number;
  nome: string | null;
  categoria: Category | null;
  tempoPreparoMinutos: number | null;
  porcoes: number | null;
  ingredientes: string | null;
  modoPreparo: string;
  criadoEm: string;
  alteradoEm: string;
}

export interface RecipeInput {
  nome: string;
  categoriaId: number;
  tempoPreparoMinutos: number;
  porcoes: number;
  ingredientes: string;
  modoPreparo: string;
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
  totalReceitas: number;
  categoriasUtilizadas: number;
  atualizadaEm: string | null;
}

export type RecipeSortField = 'nome' | 'criadoEm' | 'alteradoEm';
export type SortOrder = 'asc' | 'desc';

export interface RecipeQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoriaId?: number;
  sortBy?: RecipeSortField;
  order?: SortOrder;
}

export interface RegisterInput {
  nome: string;
  login: string;
  senha: string;
  confirmarSenha: string;
}

export interface LoginInput {
  login: string;
  senha: string;
}
