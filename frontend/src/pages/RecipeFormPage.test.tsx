import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { categoriesApi, recipesApi } from '../api/services';
import { useToast } from '../hooks/useToast';
import type { Category, Recipe } from '../types/api';
import { RecipeFormPage } from './RecipeFormPage';

vi.mock('../api/services', () => ({
  categoriesApi: { list: vi.fn() },
  recipesApi: {
    get: vi.fn(),
    list: vi.fn(),
    stats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: vi.fn(),
}));

const mockCategoriesApi = vi.mocked(categoriesApi);
const mockRecipesApi = vi.mocked(recipesApi);
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() };

const categories: Category[] = [
  { id: 1, name: 'Bolos e tortas doces' },
  { id: 7, name: 'Massas' },
];

const savedRecipe: Recipe = {
  id: 7,
  name: 'Bolo de cenoura',
  category: categories[0],
  preparationTimeMinutes: 45,
  servings: 8,
  ingredients: '3 cenouras',
  instructions: 'Bata e asse.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <span data-testid="location">{`${location.pathname}${location.search}`}</span>
      <Link to="/recipes/new">Nova receita</Link>
    </div>
  );
}

const renderForm = (entry = '/recipes/new') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<span>Detalhe da receita</span>} />
        <Route path="*" element={<span>Início</span>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

const fillForm = async () => {
  await userEvent.type(screen.getByLabelText('Nome da receita'), 'Bolo de cenoura');
  await userEvent.selectOptions(screen.getByLabelText('Categoria'), '1');
  await userEvent.type(screen.getByLabelText('Tempo de preparo'), '45');
  await userEvent.type(screen.getByLabelText('Porções'), '8');
  await userEvent.type(screen.getByLabelText('O que vai na receita'), '3 cenouras');
  await userEvent.type(screen.getByLabelText('Como preparar'), 'Bata e asse.');
};

describe('RecipeFormPage', () => {
  beforeEach(() => {
    mockCategoriesApi.list.mockReset().mockResolvedValue(categories);
    mockRecipesApi.get.mockReset();
    mockRecipesApi.create.mockReset();
    mockRecipesApi.update.mockReset();
    vi.mocked(useToast).mockReturnValue(toast);
  });

  it('links back to the recipe detail page when editing', () => {
    mockRecipesApi.get.mockResolvedValueOnce(savedRecipe);
    renderForm('/recipes/7/edit');

    expect(screen.getByRole('link', { name: 'Voltar para a receita' })).toHaveAttribute(
      'href',
      '/recipes/7',
    );
  });

  it('links back to the recipe list when creating', () => {
    renderForm();

    expect(screen.getByRole('link', { name: 'Voltar para minhas receitas' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('creates a recipe and navigates to its detail page', async () => {
    mockRecipesApi.create.mockResolvedValueOnce(savedRecipe);
    renderForm();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar receita' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/recipes/7'));
    expect(mockRecipesApi.create).toHaveBeenCalledWith({
      name: 'Bolo de cenoura',
      categoryId: 1,
      preparationTimeMinutes: 45,
      servings: 8,
      ingredients: '3 cenouras',
      instructions: 'Bata e asse.',
    });
  });

  it('keeps the data when the API returns an error', async () => {
    mockRecipesApi.create.mockRejectedValueOnce(
      new ApiError(400, 'Dados inválidos', ['Informe uma categoria válida.']),
    );
    renderForm();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar receita' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Dados inválidos');
    expect(screen.getByText('Informe uma categoria válida.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da receita')).toHaveValue('Bolo de cenoura');
  });

  it('resets state when switching from edit to create on the same route', async () => {
    mockRecipesApi.get.mockRejectedValueOnce(new ApiError(404, 'Não encontrado'));
    renderForm('/recipes/999/edit');

    expect(await screen.findByText('Receita não encontrada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Nova receita' }));

    await waitFor(() => expect(screen.getByLabelText('Nome da receita')).toHaveValue(''));
    expect(screen.queryByText('Receita não encontrada')).not.toBeInTheDocument();
  });

  it('prevents duplicate creation from a double submit', async () => {
    mockRecipesApi.create.mockImplementationOnce(() => new Promise(() => undefined));
    renderForm();

    await fillForm();
    const form = screen.getByRole('button', { name: 'Criar receita' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(mockRecipesApi.create).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error and retry when categories fail to load', async () => {
    mockCategoriesApi.list.mockRejectedValueOnce(new Error('falha'));
    renderForm();

    expect(await screen.findByText('Não foi possível carregar as categorias.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });
});
