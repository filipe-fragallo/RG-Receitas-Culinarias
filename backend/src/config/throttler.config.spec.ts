import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

import { THROTTLE_ERROR_MESSAGE, buildThrottlerOptions } from './throttler.config';

interface ThrottlerWithGetTracker {
  name?: string;
  limit: number;
  ttl: number;
  getTracker?: (request: Record<string, unknown>) => string | Promise<string>;
}

function trackerFor(options: ThrottlerModuleOptions, name: string): ThrottlerWithGetTracker {
  const throttlers = Array.isArray(options) ? options : options.throttlers;
  const found = throttlers.find((item) => item.name === name) as ThrottlerWithGetTracker;
  if (!found?.getTracker) throw new Error(`Tracker ${name} não encontrado.`);
  return found;
}

describe('throttler configuration', () => {
  const config = {
    get: jest.fn((name: string) => {
      const values: Record<string, string> = {
        LOGIN_RATE_LIMIT_LIMIT: '5',
        LOGIN_RATE_LIMIT_TTL_MS: '60000',
        REGISTER_RATE_LIMIT_LIMIT: '3',
        REGISTER_RATE_LIMIT_TTL_MS: '3600000',
      };
      return values[name];
    }),
  } as unknown as ConfigService;

  it('uses distinct policies for login and registration', () => {
    const options = buildThrottlerOptions(config) as {
      errorMessage: string;
      throttlers: ThrottlerWithGetTracker[];
    };

    expect(options.errorMessage).toBe(THROTTLE_ERROR_MESSAGE);
    expect(options.throttlers.map((item) => item.name)).toEqual([
      'login-ip',
      'login-identity',
      'register-ip',
      'register-identity',
    ]);
    expect(options.throttlers[0]).toMatchObject({ limit: 5, ttl: 60_000 });
    expect(options.throttlers[2]).toMatchObject({ limit: 3, ttl: 3_600_000 });
  });

  it('derives the IP tracker from req.ip and ignores forwarded headers', () => {
    const options = buildThrottlerOptions(config);
    const tracker = trackerFor(options, 'login-ip').getTracker!;

    expect(
      tracker({
        ip: '10.0.0.8',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      }),
    ).toBe('10.0.0.8');
  });

  it('combines IP with normalized login for the identity policy', () => {
    const options = buildThrottlerOptions(config);
    const tracker = trackerFor(options, 'login-identity').getTracker!;

    expect(tracker({ ip: '10.0.0.8', body: { login: '  MARIA.SILVA ' } })).toBe(
      '10.0.0.8|maria.silva',
    );
  });
});
