import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { categoriesApi, recipesApi } from '../api/services';
import { ToastProvider } from '../contexts/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import type { PaginatedRecipes, Recipe } from '../types/api';
import { RecipesPage } from './RecipesPage';

vi.mock('../api/services', () => ({
  categoriesApi: { list: vi.fn() },
  recipesApi: { list: vi.fn(), stats: vi.fn() },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockCategoriesApi = vi.mocked(categoriesApi);
const mockRecipesApi = vi.mocked(recipesApi);
const mockUseAuth = vi.mocked(useAuth);

const recipe: Recipe = {
  id: 10,
  name: 'Bolo de cenoura',
  category: { id: 1, name: 'Bolos e tortas doces' },
  preparationTimeMinutes: 45,
  servings: 8,
  ingredients: '3 cenouras',
  instructions: 'Bata e asse.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const page = (data: Recipe[], totalPages: number, total = data.length): PaginatedRecipes => ({
  data,
  meta: { page: 1, limit: 12, total, totalPages },
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

const renderPage = (entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <RecipesPage />
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('RecipesPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 1, name: 'Maria', login: 'maria', createdAt: '2026-01-01T00:00:00.000Z' },
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      retryRestore: vi.fn(),
    });
    mockCategoriesApi.list.mockReset().mockResolvedValue([
      { id: 1, name: 'Bolos e tortas doces' },
      { id: 7, name: 'Massas' },
    ]);
    mockRecipesApi.list.mockReset().mockResolvedValue(page([recipe], 1));
    mockRecipesApi.stats.mockReset().mockResolvedValue({
      totalRecipes: 1,
      categoriesUsed: 1,
      lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    window.scrollTo = vi.fn();
  });

  it('shows an empty state when filters have no results', async () => {
    mockRecipesApi.list.mockResolvedValueOnce(page([], 0, 0));
    renderPage('/?search=curry');

    expect(await screen.findByText('Nenhuma receita encontrada')).toBeInTheDocument();
    expect(screen.getByText('Pesquisa por')).toBeInTheDocument();
  });

  it('shows an HTTP error with a retry action', async () => {
    mockRecipesApi.list.mockRejectedValueOnce(new Error('500'));
    renderPage();

    expect(await screen.findByText('Não foi possível carregar suas receitas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('navigates to the next page via pagination', async () => {
    mockRecipesApi.list.mockResolvedValue(page([recipe], 3, 30));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Próxima página' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?page=2'));
  });

  it('applies the category filter in the URL', async () => {
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Categoria'), '7');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?category=7'));
    expect(mockRecipesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 7 }),
      expect.anything(),
    );
  });
});
