import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'rg_auth';
export const CSRF_COOKIE_NAME = 'rg_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export interface CookieSettings {
  secure: boolean;
  sameSite: 'lax' | 'strict';
}

export interface SessionCookieSettings extends CookieSettings {
  maxAgeSeconds: number;
}

/** Caminho restrito à API; o frontend nunca precisa ler o cookie de sessão. */
const COOKIE_PATH = '/api';

function baseCookieOptions(settings: CookieSettings): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: COOKIE_PATH,
    // Sem `domain`: o cookie fica vinculado exatamente ao host da requisição.
  };
}

export function authCookieOptions(settings: SessionCookieSettings): CookieOptions {
  return {
    ...baseCookieOptions(settings),
    maxAge: settings.maxAgeSeconds * 1000,
  };
}

export function csrfCookieOptions(settings: SessionCookieSettings): CookieOptions {
  return {
    ...baseCookieOptions(settings),
    maxAge: settings.maxAgeSeconds * 1000,
  };
}

/**
 * O token CSRF é derivado do `jti` da sessão com uma chave HMAC separada,
 * derivada do próprio JWT_SECRET. O JWT nunca é exposto ao JavaScript.
 */
export function deriveCsrfToken(jwtSecret: string, jti: string): string {
  const key = createHmac('sha256', jwtSecret).update('rg-csrf-session').digest();
  return createHmac('sha256', key).update(jti).digest('base64url');
}

export function timingSafeEqualText(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
