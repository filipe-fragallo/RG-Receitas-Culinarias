import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

type TestStatus = 'authenticated' | 'anonymous';

const authState = vi.hoisted(() => ({
  status: 'anonymous' as TestStatus,
}));

vi.mock('./contexts/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    status: authState.status,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('./components/layout/AppShell', () => ({
  AppShell: () => (
    <div>
      <Outlet />
    </div>
  ),
}));

vi.mock('./pages/LoginPage', () => ({ LoginPage: () => <div>Login</div> }));
vi.mock('./pages/RegisterPage', () => ({ RegisterPage: () => <div>Cadastro</div> }));
vi.mock('./pages/RecipesPage', () => ({ RecipesPage: () => <div>Listagem de receitas</div> }));
vi.mock('./pages/NotFoundPage', () => ({ NotFoundPage: () => <div>Página não encontrada</div> }));
vi.mock('./pages/RecipeDetailPage', () => ({
  RecipeDetailPage: () => {
    const { id } = useParams();
    return <div>Detalhe da receita {id}</div>;
  },
}));
vi.mock('./pages/RecipeFormPage', () => ({
  RecipeFormPage: () => {
    const { id } = useParams();
    return <div>{id ? `Formulário de edição ${id}` : 'Formulário de criação'}</div>;
  },
}));

function renderAt(path: string, status: TestStatus = 'authenticated') {
  authState.status = status;
  window.history.pushState({}, '', path);
  render(<App />);
}

describe('App routes', () => {
  beforeEach(() => {
    authState.status = 'authenticated';
  });

  it('renders the recipe list at /', () => {
    renderAt('/');

    expect(screen.getByText('Listagem de receitas')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('renders the login page', () => {
    renderAt('/login', 'anonymous');

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders the registration page', () => {
    renderAt('/register', 'anonymous');

    expect(screen.getByText('Cadastro')).toBeInTheDocument();
  });

  it.each([
    ['/recipes/new', 'Formulário de criação'],
    ['/recipes/7', 'Detalhe da receita 7'],
    ['/recipes/7/edit', 'Formulário de edição 7'],
  ])('renders %s', (path, marker) => {
    renderAt(path);

    expect(screen.getByText(marker)).toBeInTheDocument();
  });

  it.each([
    ['/cadastro', '/register', 'Cadastro', 'anonymous' as TestStatus],
    ['/receitas/nova', '/recipes/new', 'Formulário de criação', 'authenticated' as TestStatus],
    ['/receitas/7', '/recipes/7', 'Detalhe da receita 7', 'authenticated' as TestStatus],
    [
      '/receitas/7/editar',
      '/recipes/7/edit',
      'Formulário de edição 7',
      'authenticated' as TestStatus,
    ],
  ])('redirects legacy route %s to %s', async (source, target, marker, status) => {
    renderAt(source, status);

    expect(await screen.findByText(marker)).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe(target));
  });

  it('preserves query params when redirecting a legacy recipe route', async () => {
    renderAt('/receitas/7/editar?origem=lista');

    expect(await screen.findByText('Formulário de edição 7')).toBeInTheDocument();
    await waitFor(() =>
      expect(`${window.location.pathname}${window.location.search}`).toBe(
        '/recipes/7/edit?origem=lista',
      ),
    );
  });

  it.each(['/receitas/7/desconhecido', '/receitas/7/editar/extra'])(
    'redirects invalid legacy route %s to the existing list',
    async (path) => {
      renderAt(path);

      expect(await screen.findByText('Listagem de receitas')).toBeInTheDocument();
      await waitFor(() => expect(window.location.pathname).toBe('/'));
    },
  );
});
