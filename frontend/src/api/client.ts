import type { ApiErrorBody } from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'meu-caderno:token';

export const SESSION_EXPIRED_EVENT = 'meu-caderno:session-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly errors: string[];

  constructor(status: number, message: string, errors: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

let sessionExpiredNotified = false;

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  sessionExpiredNotified = false;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function notifySessionExpired(): void {
  if (sessionExpiredNotified) {
    return;
  }

  sessionExpiredNotified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.message === 'string';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getStoredToken();

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      0,
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const rawText = await response.text();
  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      if (!response.ok) {
        throw new ApiError(response.status, 'Não foi possível interpretar a resposta do servidor.');
      }
      throw new ApiError(500, 'Resposta inesperada do servidor.');
    }
  }

  if (!response.ok) {
    const message = isApiErrorBody(payload)
      ? payload.message
      : 'Ocorreu um erro ao processar sua solicitação.';
    const errors = isApiErrorBody(payload) && payload.errors ? payload.errors : [];

    if (response.status === 401 && auth) {
      notifySessionExpired();
    }

    throw new ApiError(response.status, message, errors);
  }

  return payload as T;
}
