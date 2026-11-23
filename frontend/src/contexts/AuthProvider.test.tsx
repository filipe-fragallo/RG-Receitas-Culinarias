import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, SESSION_EXPIRED_EVENT } from '../api/client';
import { authApi } from '../api/services';
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from './AuthProvider';
import { ToastProvider } from './ToastProvider';

vi.mock('../api/services', () => ({
  authApi: {
    csrf: vi.fn(),
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockAuthApi = vi.mocked(authApi);
const user = { id: 1, name: 'Maria Silva', login: 'maria', createdAt: '2026-01-01T00:00:00.000Z' };
const authResponse = {
  expiresIn: 3600,
  csrfToken: 'csrf-de-teste-com-mais-de-32-caracteres',
  user,
};

function Probe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="login">{auth.user?.login ?? '-'}</span>
      <button
        type="button"
        onClick={() => void auth.login({ login: 'maria', password: 'Senha@123' })}
      >
        Entrar
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        Sair
      </button>
      <button type="button" onClick={auth.retryRestore}>
        Tentar novamente
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <ToastProvider>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </ToastProvider>,
  );

describe('AuthProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAuthApi.me.mockReset().mockRejectedValue(new ApiError(401, 'Sessão não informada'));
    mockAuthApi.login.mockReset();
    mockAuthApi.register.mockReset();
    mockAuthApi.logout.mockReset();
  });

  it('always calls /auth/me on restore and stays anonymous without a toast', async () => {
    renderProvider();

    await waitFor(() => expect(mockAuthApi.me).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
  });

  it.each([0, 500])(
    'preserves the session on restore failure %i and allows retry',
    async (statusCode) => {
      mockAuthApi.me
        .mockRejectedValueOnce(new ApiError(statusCode, 'Servidor temporariamente indisponível'))
        .mockResolvedValueOnce(user);

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
      expect(screen.getByTestId('login')).toHaveTextContent('-');

      await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
      expect(screen.getByTestId('login')).toHaveTextContent('maria');
      expect(mockAuthApi.me).toHaveBeenCalledTimes(2);
    },
  );

  it('migrates the legacy token by removing only its own key', async () => {
    window.localStorage.setItem('meu-caderno:token', 'jwt-antigo');
    window.localStorage.setItem('unrelated:keep-me', 'preservado');

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(window.localStorage.getItem('meu-caderno:token')).toBeNull();
    expect(window.localStorage.getItem('unrelated:keep-me')).toBe('preservado');
    expect(screen.getByText(/Sua sessão anterior foi encerrada/)).toBeInTheDocument();
  });

  it('keeps the session authenticated when logout fails and allows a retry', async () => {
    mockAuthApi.login.mockResolvedValueOnce(authResponse);
    mockAuthApi.logout
      .mockRejectedValueOnce(new Error('servidor fora do ar'))
      .mockResolvedValueOnce({ message: 'Sessão encerrada com sucesso.' });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    const logoutButton = screen.getByRole('button', { name: 'Sair' });
    await userEvent.click(logoutButton);

    await waitFor(() =>
      expect(
        screen.getByText(/Não foi possível encerrar a sessão no servidor/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('login')).toHaveTextContent('maria');
    expect(screen.queryByText(/Você saiu da sua conta/)).not.toBeInTheDocument();

    await userEvent.click(logoutButton);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByText(/Você saiu da sua conta/)).toBeInTheDocument();
    expect(mockAuthApi.logout).toHaveBeenCalledTimes(2);
  });

  it('shows a warning when an authenticated request receives a 401', async () => {
    mockAuthApi.login.mockResolvedValueOnce(authResponse);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

    await waitFor(() => expect(screen.getByText(/Sua sessão expirou/)).toBeInTheDocument());
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  });

  it('ignores duplicate logout while the first is in progress', async () => {
    let resolveLogout: (() => void) | undefined;
    mockAuthApi.logout.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogout = () => resolve({ message: 'ok' });
        }),
    );

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    const button = screen.getByRole('button', { name: 'Sair' });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(mockAuthApi.logout).toHaveBeenCalledTimes(1);
    resolveLogout?.();
  });
});
