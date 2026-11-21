import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { recipesApi } from '../api/services';
import { useToast } from '../hooks/useToast';
import type { Recipe } from '../types/api';
import { RecipeDetailPage } from './RecipeDetailPage';

vi.mock('../api/services', () => ({
  recipesApi: { get: vi.fn(), remove: vi.fn() },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: vi.fn(),
}));

const mockRecipesApi = vi.mocked(recipesApi);
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() };

const recipe: Recipe = {
  id: 10,
  name: 'Bolo de cenoura',
  category: { id: 1, name: 'Bolos e tortas doces' },
  preparationTimeMinutes: 45,
  servings: 8,
  ingredients: '- 3 cenouras\n- 3 ovos',
  instructions: 'Bata tudo.\nAsse por 40 minutos.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/recipes/10']}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="*" element={<span>Início</span>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

describe('RecipeDetailPage', () => {
  beforeEach(() => {
    mockRecipesApi.get.mockReset().mockResolvedValue(recipe);
    mockRecipesApi.remove.mockReset();
    vi.mocked(useToast).mockReturnValue(toast);
    window.print = vi.fn();
  });

  it('shows print content and calls window.print()', async () => {
    renderDetail();

    await screen.findAllByRole('heading', { name: 'Bolo de cenoura' });
    const printArea = document.querySelector('article.print-only');
    expect(printArea).toHaveTextContent('Bolo de cenoura');
    expect(printArea).toHaveTextContent('Ingredientes');
    expect(printArea).toHaveTextContent('3 cenouras');
    expect(printArea).toHaveTextContent('Modo de preparo');
    expect(printArea).toHaveTextContent('Bata tudo.');
    expect(printArea).toHaveTextContent('Tempo de preparo:');

    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('stays on the page and reports an error when deletion fails', async () => {
    mockRecipesApi.remove.mockRejectedValueOnce(new Error('Falha ao excluir'));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir receita' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByTestId('location')).toHaveTextContent('/recipes/10');
  });

  it('navigates to the list after successful deletion', async () => {
    mockRecipesApi.remove.mockResolvedValueOnce(undefined);
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir receita' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    expect(toast.success).toHaveBeenCalledWith('Receita excluída do seu caderno.');
  });

  it('shows the not-found state for a 404', async () => {
    mockRecipesApi.get.mockRejectedValueOnce(new ApiError(404, 'Não encontrado'));
    renderDetail();

    expect(await screen.findByText('Receita não encontrada')).toBeInTheDocument();
  });

  it('shows a load error with retry', async () => {
    mockRecipesApi.get.mockRejectedValueOnce(new Error('servidor indisponível'));
    renderDetail();

    expect(await screen.findByText('Não foi possível carregar a receita')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });
});
