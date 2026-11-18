import { ApiError } from '../api/client';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export function getErrorDetails(error: unknown): string[] {
  if (error instanceof ApiError) {
    return error.errors;
  }

  return [];
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
