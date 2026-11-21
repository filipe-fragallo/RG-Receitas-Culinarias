import { Server } from 'node:http';

import { ConfigService } from '@nestjs/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getStorageToken, ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { THROTTLE_ERROR_MESSAGE, buildThrottlerOptions } from '../../src/config/throttler.config';

interface Limits {
  loginLimit: number;
  loginTtl: number;
  registerLimit: number;
  registerTtl: number;
}

const DEFAULT_LIMITS: Limits = {
  loginLimit: 5,
  loginTtl: 60_000,
  registerLimit: 3,
  registerTtl: 3_600_000,
};

const user = {
  id: 1,
  name: 'Maria Silva',
  login: 'maria.silva',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const issued = {
  token: 'jwt-de-teste',
  csrfToken: 'csrf-de-teste-com-mais-de-32-caracteres',
  expiresIn: 3600,
  user,
};

function serverOf(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

const loginBody = (login = 'maria.silva') => ({ login, password: 'Senha@123' });
const registerBody = (login: string) => ({
  name: 'Maria Silva',
  login,
  password: 'Senha@123',
  confirmPassword: 'Senha@123',
});

describe('rate limiting independente de login e cadastro', () => {
  let app: INestApplication | undefined;

  async function createApp(limits: Limits = DEFAULT_LIMITS): Promise<INestApplication> {
    const throttlerConfig = {
      get: jest.fn((name: string) => {
        const values: Record<string, number> = {
          LOGIN_RATE_LIMIT_LIMIT: limits.loginLimit,
          LOGIN_RATE_LIMIT_TTL_MS: limits.loginTtl,
          REGISTER_RATE_LIMIT_LIMIT: limits.registerLimit,
          REGISTER_RATE_LIMIT_TTL_MS: limits.registerTtl,
        };
        return values[name];
      }),
    } as unknown as ConfigService;

    const controllerConfig = {
      get: jest.fn((name: string, fallback?: unknown) => {
        if (name === 'COOKIE_SECURE') return false;
        if (name === 'COOKIE_SAME_SITE') return 'lax';
        if (name === 'JWT_EXPIRES_IN_SECONDS') return '3600';
        return fallback;
      }),
    } as unknown as ConfigService;

    const authService = {
      login: jest.fn().mockResolvedValue(issued),
      register: jest.fn().mockResolvedValue(issued),
    };

    const builder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions(throttlerConfig))],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: controllerConfig },
      ],
    })
      // Cada cenário precisa de contadores próprios: o módulo é global e o
      // armazenamento em memória pode ser reaproveitado entre aplicações.
      .overrideProvider(getStorageToken())
      .useValue(new ThrottlerStorageService());

    const moduleRef = await builder.compile();

    const testApp = moduleRef.createNestApplication();
    testApp.setGlobalPrefix('api');
    testApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await testApp.init();
    return testApp;
  }

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
  });

  it('aplica somente as políticas de login e bloqueia a sexta tentativa', async () => {
    app = await createApp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    }

    const blocked = await request(serverOf(app))
      .post('/api/auth/login')
      .send(loginBody())
      .expect(429);

    expect((blocked.body as { message: string }).message).toContain(THROTTLE_ERROR_MESSAGE);
  });

  it('logins não consomem o limite de cadastro', async () => {
    app = await createApp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(serverOf(app))
        .post('/api/auth/register')
        .send(registerBody(`usuario${attempt}`))
        .expect(201);
    }

    await request(serverOf(app))
      .post('/api/auth/register')
      .send(registerBody('usuario3'))
      .expect(429);
  });

  it('cadastros não consomem o limite de login', async () => {
    app = await createApp();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(serverOf(app))
        .post('/api/auth/register')
        .send(registerBody(`usuario${attempt}`))
        .expect(201);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    }

    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(429);
  });

  it('respeita limites configurados de forma independente', async () => {
    app = await createApp({ ...DEFAULT_LIMITS, loginLimit: 2, registerLimit: 4 });

    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(429);

    // As duas tentativas de login não decrementaram a cota de cadastro (4).
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(serverOf(app))
        .post('/api/auth/register')
        .send(registerBody(`usuario${attempt}`))
        .expect(201);
    }
  });

  it('libera o bloqueio quando a janela expira', async () => {
    app = await createApp({ ...DEFAULT_LIMITS, loginLimit: 1, loginTtl: 150 });

    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(429);

    await new Promise((resolve) => setTimeout(resolve, 220));

    await request(serverOf(app)).post('/api/auth/login').send(loginBody()).expect(200);
  });

  it('mantém IP e login normalizados como identificadores', () => {
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
    const options = buildThrottlerOptions(config) as unknown as {
      throttlers: Array<{ name: string; getTracker: (request: unknown) => string }>;
    };
    const ip = options.throttlers.find((item) => item.name === 'login-ip');
    const identity = options.throttlers.find((item) => item.name === 'login-identity');
    if (!ip || !identity) throw new Error('políticas não encontradas');

    const forged = { ip: '10.0.0.8', headers: { 'x-forwarded-for': '203.0.113.9' } };
    expect(ip.getTracker(forged)).toBe('10.0.0.8');
    expect(identity.getTracker({ ip: '10.0.0.8', body: { login: '  MARIA.SILVA ' } })).toBe(
      identity.getTracker({ ip: '10.0.0.8', body: { login: 'maria.silva' } }),
    );
  });

  it('não permite bypass por X-Forwarded-For não confiável', async () => {
    app = await createApp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(serverOf(app))
        .post('/api/auth/login')
        .set('X-Forwarded-For', `203.0.113.${attempt + 1}`)
        .send(loginBody())
        .expect(200);
    }

    await request(serverOf(app))
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.99')
      .send(loginBody())
      .expect(429);
  });
});
