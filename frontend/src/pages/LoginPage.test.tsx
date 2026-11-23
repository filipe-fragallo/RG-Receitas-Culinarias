import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { ToastProvider } from '../contexts/ToastProvider';
import { LoginPage } from './LoginPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const loginMock = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

const renderLogin = (state: unknown = null) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<span>Página interna</span>} />
        </Routes>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );

const fillValidForm = async () => {
  await userEvent.type(screen.getByLabelText('Login'), 'maria');
  await userEvent.type(screen.getByLabelText('Senha'), 'Senha@123');
};

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    mockUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      login: loginMock,
      register: vi.fn(),
      logout: vi.fn(),
      retryRestore: vi.fn(),
    });
  });

  it('does not submit an invalid form', async () => {
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(loginMock).not.toHaveBeenCalled();
  });

  it('keeps the data and shows a field error on 401', async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, 'Credenciais inválidas'));
    renderLogin();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Verifique seu login e sua senha.')).toBeInTheDocument();
    expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    expect(screen.getByLabelText('Login')).toHaveValue('maria');
    expect(screen.getByLabelText('Senha')).toHaveValue('Senha@123');
  });

  it('shows the friendly throttling message returned by the API', async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(429, 'Muitas tentativas. Aguarde um momento e tente novamente.'),
    );
    renderLogin();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/Muitas tentativas\. Aguarde um momento/)).toBeInTheDocument();
  });

  it('redirects to an internal route and blocks protocol-relative redirects', async () => {
    loginMock.mockResolvedValue(undefined);
    const { unmount } = renderLogin({ from: '/recipes/5' });

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/recipes/5'));
    unmount();

    loginMock.mockResolvedValue(undefined);
    renderLogin({ from: '//evil.com' });
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  });

  it('prevents duplicate submissions', async () => {
    loginMock.mockImplementationOnce(() => new Promise(() => undefined));
    renderLogin();

    await fillValidForm();
    const form = screen.getByRole('button', { name: 'Entrar' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(loginMock).toHaveBeenCalledTimes(1);
  });
});
