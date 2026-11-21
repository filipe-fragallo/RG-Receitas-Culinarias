import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const THROTTLE_ERROR_MESSAGE = 'Muitas tentativas. Aguarde um momento e tente novamente.';

type TrackedRequest = Record<string, unknown>;

function clientIp(request: TrackedRequest): string {
  // Com TRUST_PROXY desligado, Express ignora X-Forwarded-For enviado pelo cliente.
  const ip = request['ip'];
  return typeof ip === 'string' ? ip : 'unknown';
}

function normalizedLogin(request: TrackedRequest): string {
  const body = request['body'];
  if (!body || typeof body !== 'object' || !('login' in body)) return '';
  const login = (body as { login?: unknown }).login;
  return typeof login === 'string' ? login.trim().toLowerCase() : '';
}

function identityTracker(request: TrackedRequest): string {
  return `${clientIp(request)}|${normalizedLogin(request)}`;
}

function numberSetting(configService: ConfigService, name: string, fallback: number): number {
  const configured = Number(configService.get<string>(name));
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

export function buildThrottlerOptions(configService: ConfigService): ThrottlerModuleOptions {
  const loginLimit = numberSetting(configService, 'LOGIN_RATE_LIMIT_LIMIT', 5);
  const loginTtl = numberSetting(configService, 'LOGIN_RATE_LIMIT_TTL_MS', 60_000);
  const registerLimit = numberSetting(configService, 'REGISTER_RATE_LIMIT_LIMIT', 3);
  const registerTtl = numberSetting(configService, 'REGISTER_RATE_LIMIT_TTL_MS', 3_600_000);

  return {
    errorMessage: THROTTLE_ERROR_MESSAGE,
    throttlers: [
      { name: 'login-ip', limit: loginLimit, ttl: loginTtl, getTracker: clientIp },
      {
        name: 'login-identity',
        limit: loginLimit,
        ttl: loginTtl,
        getTracker: identityTracker,
      },
      { name: 'register-ip', limit: registerLimit, ttl: registerTtl, getTracker: clientIp },
      {
        name: 'register-identity',
        limit: registerLimit,
        ttl: registerTtl,
        getTracker: identityTracker,
      },
    ],
  };
}
