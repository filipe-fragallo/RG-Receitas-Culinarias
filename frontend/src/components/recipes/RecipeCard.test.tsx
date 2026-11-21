import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Recipe } from '../../types/api';
import { RecipeCard } from './RecipeCard';

const recipe: Recipe = {
  id: 10,
  name: 'Bolo de cenoura',
  category: { id: 1, name: 'Bolos e tortas doces' },
  preparationTimeMinutes: 45,
  servings: 8,
  ingredients: '3 cenouras médias\n3 ovos\n2 xícaras de farinha',
  instructions: 'Bata e asse.',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

const renderCard = (value: Recipe) =>
  render(
    <MemoryRouter>
      <RecipeCard recipe={value} />
    </MemoryRouter>,
  );

describe('RecipeCard', () => {
  it('shows the main data and links to the detail page', () => {
    renderCard(recipe);

    expect(
      screen.getByRole('link', { name: 'Ver detalhes da receita Bolo de cenoura' }),
    ).toHaveAttribute('href', '/recipes/10');
    expect(screen.getByRole('heading', { name: 'Bolo de cenoura' })).toBeInTheDocument();
    expect(screen.getByText('Bolos e tortas doces')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('8 porções')).toBeInTheDocument();
    expect(screen.getByText('3 cenouras médias · 3 ovos')).toBeInTheDocument();
  });

  it('applies fallbacks for an incomplete recipe', () => {
    renderCard({
      ...recipe,
      name: null,
      category: null,
      ingredients: null,
      preparationTimeMinutes: null,
      servings: null,
    });

    expect(screen.getByRole('heading', { name: 'Receita sem título' })).toBeInTheDocument();
    expect(screen.getByText('Sem categoria')).toBeInTheDocument();
    expect(screen.getByText('Ingredientes não informados')).toBeInTheDocument();
    expect(screen.getByText('Tempo não informado')).toBeInTheDocument();
    expect(screen.getByText('Porções não informadas')).toBeInTheDocument();
  });
});
