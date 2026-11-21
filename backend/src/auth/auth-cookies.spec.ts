import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  authCookieOptions,
  csrfCookieOptions,
  deriveCsrfToken,
  timingSafeEqualText,
} from './auth-cookies';

const SECRET = 'test-only-secret-with-at-least-32-characters-long';

describe('cookie e CSRF helpers', () => {
  it('uses narrow, non-domain-scoped cookie names and paths', () => {
    const auth = authCookieOptions({ secure: true, sameSite: 'lax', maxAgeSeconds: 3600 });
    const csrf = csrfCookieOptions({ secure: true, sameSite: 'lax', maxAgeSeconds: 3600 });

    expect(AUTH_COOKIE_NAME).toBe('rg_auth');
    expect(CSRF_COOKIE_NAME).toBe('rg_csrf');
    expect(auth).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api' });
    expect(auth.maxAge).toBe(3_600_000);
    expect(csrf).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api',
      maxAge: 3_600_000,
    });
    expect(auth).not.toHaveProperty('domain');
    expect(csrf).not.toHaveProperty('domain');
  });

  it('derives a stable CSRF token per session without exposing the JWT', () => {
    const first = deriveCsrfToken(SECRET, 'jti-1');
    const second = deriveCsrfToken(SECRET, 'jti-2');

    expect(first).toBe(deriveCsrfToken(SECRET, 'jti-1'));
    expect(first).not.toBe(second);
    expect(first).not.toContain('jti-1');
    expect(first.length).toBeGreaterThan(32);
  });

  it('compares text in constant time and rejects different lengths', () => {
    expect(timingSafeEqualText('token-a', 'token-a')).toBe(true);
    expect(timingSafeEqualText('token-a', 'token-b')).toBe(false);
    expect(timingSafeEqualText('token-a', 'token-a-longer')).toBe(false);
  });
});
