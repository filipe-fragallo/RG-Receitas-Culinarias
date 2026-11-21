import { envValidationSchema } from './env.validation';

const baseEnv = {
  DB_HOST: '127.0.0.1',
  DB_PORT: 3306,
  DB_USER: 'receitas',
  DB_PASSWORD: 'receitas_dev',
  DB_NAME: 'teste_receitas_rg_sistemas',
  COOKIE_SECURE: true,
};

describe('envValidationSchema', () => {
  it('accepts an explicit production JWT secret', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(64),
    });

    expect(error).toBeUndefined();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'short'],
  ])('rejects a %s JWT secret', (_label, secret) => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: secret,
    });

    expect(error?.message).toContain('openssl rand -hex 32');
  });

  it('rejects a known placeholder JWT secret in production', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'troque-este-segredo-por-uma-string-aleatoria-com-32-caracteres',
    });

    expect(error?.message).toContain('openssl rand -hex 32');
  });

  it('requires Secure cookies in production', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      COOKIE_SECURE: false,
      JWT_SECRET: 'a'.repeat(64),
    });

    expect(error?.message).toContain('COOKIE_SECURE');
  });

  it('allows non-Secure cookies only with loopback origins', () => {
    const valid = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'development',
      COOKIE_SECURE: false,
      JWT_SECRET: 'a'.repeat(64),
      CORS_ORIGIN: 'http://localhost:5173',
    });
    const invalid = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'development',
      COOKIE_SECURE: false,
      JWT_SECRET: 'a'.repeat(64),
      CORS_ORIGIN: 'https://example.com',
    });

    expect(valid.error).toBeUndefined();
    expect(invalid.error?.message).toContain('CORS_ORIGIN');
  });

  it('rejects port zero so the preflight and the real bind use a concrete port', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      JWT_SECRET: 'a'.repeat(64),
      PORT: 0,
    });

    expect(error?.message).toContain('PORT');
  });

  it('rejects wildcard CORS because cookie auth requires explicit origins', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnv,
      COOKIE_SECURE: true,
      JWT_SECRET: 'a'.repeat(64),
      CORS_ORIGIN: '*',
    });

    expect(error?.message).toContain('CORS_ORIGIN');
  });
});
