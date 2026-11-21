import type { ApiErrorBody } from '../types/api';

const configuredBaseUrl = (import.meta.env.VITE_API_URL ?? '').trim();
const API_BASE_URL = (configuredBaseUrl || '/api').replace(/\/$/, '');
const LEGACY_TOKEN_KEY = 'meu-caderno:token';
const CSRF_PATH = '/auth/csrf';

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
let csrfToken: string | null = null;

/** Remove apenas a chave antiga de autenticação, preservando outros dados. */
export function removeLegacyToken(): boolean {
  const existed = window.localStorage.getItem(LEGACY_TOKEN_KEY) !== null;
  if (existed) window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  return existed;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  if (token) sessionExpiredNotified = false;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

function notifySessionExpired(): void {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.message !== 'string') return false;
  if (candidate.errors === undefined || candidate.errors === null) return true;

  return (
    Array.isArray(candidate.errors) &&
    candidate.errors.every((detail) => typeof detail === 'string')
  );
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${CSRF_PATH}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError(
      0,
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'Não foi possível iniciar a proteção da sessão.');
  }

  const payload = (await response.json()) as { csrfToken?: unknown };

  if (typeof payload.csrfToken !== 'string' || payload.csrfToken.length < 32) {
    throw new ApiError(500, 'Resposta inválida do servidor ao iniciar a proteção da sessão.');
  }

  setCsrfToken(payload.csrfToken);
  return payload.csrfToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Controla apenas o aviso global de 401; credenciais são sempre enviadas. */
  auth?: boolean;
  /** Desativa o aviso global de sessão expirada (ex.: restauração silenciosa). */
  notifyExpiry?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true, notifyExpiry = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (method !== 'GET') {
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;

    throw new ApiError(
      0,
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
  }

  if (response.status === 204) return undefined as T;

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

    if (response.status === 401 && auth && notifyExpiry) notifySessionExpired();

    throw new ApiError(response.status, message, errors);
  }

  return payload as T;
}
