import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiRequest,
  clearCsrfToken,
  getCsrfToken,
  removeLegacyToken,
  SESSION_EXPIRED_EVENT,
  setCsrfToken,
} from './client';

const CSRF = 'csrf-de-teste-com-mais-de-32-caracteres';
const jsonResponse = (status: number, payload: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  }) as Response;

describe('api/client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearCsrfToken();
    setCsrfToken(null);
    window.localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearCsrfToken();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends credentials without reading or sending a stored JWT', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiRequest('/recipes');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('bootstraps CSRF and sends the header on modifying requests', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: CSRF }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 1 }));

    await apiRequest('/recipes', { method: 'POST', body: { name: 'Bolo' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/csrf');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ 'X-CSRF-Token': CSRF });
    expect(getCsrfToken()).toBe(CSRF);
  });

  it('removes only the legacy token key from localStorage', () => {
    window.localStorage.setItem('meu-caderno:token', 'jwt-antigo');
    window.localStorage.setItem('unrelated:keep-me', 'preservado');

    expect(removeLegacyToken()).toBe(true);
    expect(window.localStorage.getItem('meu-caderno:token')).toBeNull();
    expect(window.localStorage.getItem('unrelated:keep-me')).toBe('preservado');
    expect(removeLegacyToken()).toBe(false);
  });

  it('normalizes network errors into ApiError with a Portuguese message', async () => {
    setCsrfToken(CSRF);
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(apiRequest('/recipes')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringContaining('Não foi possível conectar'),
    });
  });

  it('rejects a payload with invalid errors without exposing non-string values', async () => {
    setCsrfToken(CSRF);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { message: 'Dados inválidos', errors: 'boom' }),
    );

    const error = await apiRequest('/recipes', { method: 'POST' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errors).toEqual([]);
  });

  it('notifies expiry once on an authenticated 401 and not when disabled', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }));
    await expect(apiRequest('/auth/me', { notifyExpiry: false })).rejects.toMatchObject({
      status: 401,
    });
    expect(listener).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }));
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }));
    await expect(apiRequest('/recipes')).rejects.toMatchObject({ status: 401 });
    await expect(apiRequest('/recipes')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
