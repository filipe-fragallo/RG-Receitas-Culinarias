import * as Joi from 'joi';

import {
  assertDatabaseSslHost,
  DB_SSL_CA_REQUIRED_MESSAGE,
  DB_SSL_HOST_MESSAGE,
} from './database-ssl';

const KNOWN_INSECURE_JWT_SECRETS = [
  'troque-este-segredo-por-uma-string-aleatoria-com-32-caracteres',
  'troque-este-segredo-por-uma-string-aleatoria-com-32-caracteres-ou-mais',
];

const JWT_SECRET_MESSAGE =
  'JWT_SECRET deve ser explícito, com pelo menos 32 caracteres. Gere com: openssl rand -hex 32';
const CORS_MESSAGE =
  'CORS_ORIGIN deve listar origens explícitas; com COOKIE_SECURE=false use apenas loopback.';
const COOKIE_SECURE_MESSAGE =
  'COOKIE_SECURE deve ser true em produção, com HTTPS e CORS_ORIGIN explícito.';

function isLoopbackOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().min(1).default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_LOGGING: Joi.boolean().default(false),
  // Pool configurável: em Functions use DB_POOL_MAX=1 para não esgotar conexões
  // quando várias instâncias frias iniciam ao mesmo tempo.
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_POOL_MIN: Joi.number().integer().min(0).max(100).default(0),
  DB_POOL_ACQUIRE_MS: Joi.number().integer().min(1000).default(30_000),
  DB_POOL_IDLE_MS: Joi.number().integer().min(0).default(10_000),

  // TLS é desligado por padrão para preservar o MySQL 8.4 local. Quando ligado,
  // exige CA explícita e um hostname DNS (validado abaixo); nunca IP.
  DB_SSL: Joi.boolean().default(false),
  // DB_SSL_CA é o PEM inline usado no Vercel; DB_SSL_CA_PATH continua disponível
  // para desenvolvimento/CI com arquivo. Um dos dois é obrigatório com TLS.
  DB_SSL_CA: Joi.string().trim().allow('').default(''),
  DB_SSL_CA_PATH: Joi.string().trim().allow('').default(''),

  // Controles explícitos de segurança. Por padrão: sem migrações automáticas
  // em produção/host remoto e sem autorização de operações destrutivas.
  DB_MIGRATIONS_AUTO: Joi.boolean(),
  DB_ALLOW_REMOTE: Joi.boolean().default(false),
  DB_ALLOWED_HOST: Joi.string().allow('').default(''),
  DB_ALLOW_PRODUCTION_MIGRATIONS: Joi.boolean().default(false),

  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().invalid(...KNOWN_INSECURE_JWT_SECRETS),
    })
    .messages({
      'any.required': JWT_SECRET_MESSAGE,
      'string.empty': JWT_SECRET_MESSAGE,
      'string.min': JWT_SECRET_MESSAGE,
      'any.invalid': JWT_SECRET_MESSAGE,
    }),
  JWT_EXPIRES_IN_SECONDS: Joi.number().integer().min(60).default(3600),

  // Cookies: Secure é obrigatório em produção. Fora dela, false só é aceito
  // quando todas as origens CORS são loopback (HTTP local/Vite/Docker).
  COOKIE_SECURE: Joi.boolean()
    .default(false)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.boolean().valid(true).required(),
    })
    .messages({
      'any.only': COOKIE_SECURE_MESSAGE,
      'any.required': COOKIE_SECURE_MESSAGE,
    }),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict').default('lax'),

  TRUST_PROXY: Joi.boolean().default(false),
  TRUST_PROXY_HOPS: Joi.number().integer().min(1).max(10).default(1),

  LOGIN_RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(5),
  LOGIN_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  REGISTER_RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(3),
  REGISTER_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(3_600_000),

  CORS_ORIGIN: Joi.string()
    .default('http://localhost:3000,http://localhost:5173,http://localhost:8080')
    .custom((value: string, helpers: Joi.CustomHelpers) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
      const ancestors = helpers.state.ancestors as unknown as Record<string, unknown>[];
      const secure = ancestors[0]?.['COOKIE_SECURE'] === true;

      if (
        origins.length === 0 ||
        origins.includes('*') ||
        (!secure && !origins.every(isLoopbackOrigin))
      ) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({ 'any.invalid': CORS_MESSAGE }),
})
  .custom((value: Record<string, unknown>, helpers: Joi.CustomHelpers) => {
    if (value['DB_SSL'] === true) {
      const inlineCa = trimmedString(value['DB_SSL_CA']);
      const caPath = trimmedString(value['DB_SSL_CA_PATH']);
      if (!inlineCa && !caPath) {
        return helpers.error('dbSsl.caRequired');
      }

      if (typeof value['DB_HOST'] === 'string') {
        try {
          assertDatabaseSslHost(value['DB_HOST']);
        } catch {
          return helpers.error('dbSsl.hostInvalid');
        }
      }
    }
    return value;
  })
  .messages({
    'dbSsl.caRequired': DB_SSL_CA_REQUIRED_MESSAGE,
    'dbSsl.hostInvalid': DB_SSL_HOST_MESSAGE,
  })
  .unknown(true);
