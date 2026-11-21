import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import { ToastProvider } from '../contexts/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { RegisterPage } from './RegisterPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const registerMock = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <ToastProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<span>Início</span>} />
        </Routes>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );

const fillForm = async () => {
  await userEvent.type(screen.getByLabelText('Nome'), 'Maria Silva');
  await userEvent.type(screen.getByLabelText('Login'), 'maria');
  await userEvent.type(screen.getByLabelText('Senha', { exact: true }), 'Senha@123');
  await userEvent.type(screen.getByLabelText('Confirmar senha'), 'Senha@123');
};

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
    mockUseAuth.mockReturnValue({
      status: 'anonymous',
      user: null,
      login: vi.fn(),
      register: registerMock,
      logout: vi.fn(),
    });
  });

  it('does not submit an invalid form', async () => {
    renderRegister();
    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows a duplicate-login error while preserving entered data', async () => {
    registerMock.mockRejectedValueOnce(new ApiError(409, 'Login já cadastrado'));
    renderRegister();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    expect(
      await screen.findByText('Este login já está em uso. Escolha outro.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria Silva');
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveValue('Senha@123');
  });

  it('shows the friendly throttling message returned by the API', async () => {
    registerMock.mockRejectedValueOnce(
      new ApiError(429, 'Muitas tentativas. Aguarde um momento e tente novamente.'),
    );
    renderRegister();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    expect(await screen.findByText(/Muitas tentativas\. Aguarde um momento/)).toBeInTheDocument();
  });

  it('redirects to the recipe list after successful registration', async () => {
    registerMock.mockResolvedValueOnce(undefined);
    renderRegister();

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  });

  it('prevents duplicate submissions', async () => {
    registerMock.mockImplementationOnce(() => new Promise(() => undefined));
    renderRegister();

    await fillForm();
    const form = screen.getByRole('button', { name: 'Criar minha conta' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(registerMock).toHaveBeenCalledTimes(1);
  });
});
