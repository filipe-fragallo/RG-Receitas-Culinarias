import { Body, Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { buildThrottlerOptions } from '../../src/config/throttler.config';

interface AuthBody {
  expiresIn: number;
  csrfToken: string;
  user: { id: number; login: string };
}

interface CsrfBody {
  csrfToken: string;
}

interface SessionRow {
  token_identifier_hash: string;
  revoked_at: Date | null;
  expires_at: Date;
}

type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrfToken: string;
  cookie: string;
  user: AuthBody['user'];
}

const PASSWORD = 'Senha@123';

@Controller('throttle-probe')
class ThrottleProbeController {
  @Post()
  @HttpCode(200)
  @Throttle({ 'login-ip': {}, 'login-identity': {} })
  probe(@Body() _body: { login: string }): { ok: true } {
    return { ok: true };
  }
}

function extractSetCookie(response: request.Response, name: string): string {
  const cookies = (response.headers['set-cookie'] ?? []) as unknown as string[];
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Cookie ${name} não encontrado.`);
  return cookie;
}

function extractCookie(response: request.Response, name: string): string {
  return extractSetCookie(response, name).split(';')[0];
}

function maxAgeOf(setCookie: string): string | undefined {
  return /Max-Age=(\d+)/i.exec(setCookie)?.[1];
}

const recipePayload = (name: string) => ({
  name,
  categoryId: 1,
  preparationTimeMinutes: 10,
  servings: 1,
  ingredients: 'x',
  instructions: 'x',
});

describe('auth sessions, cookies, CSRF and throttling (MySQL integration)', () => {
  let app: INestApplication;
  let server: Server;
  let sequelize: Sequelize;
  let jwtService: JwtService;

  const loginA = `seguranca.a.${Date.now()}`;
  const loginB = `seguranca.b.${Date.now()}`;

  const createApplication = async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    sequelize = app.get(Sequelize);
    jwtService = app.get(JwtService);
  };

  const freshAgent = async (): Promise<{ agent: Agent; csrfToken: string }> => {
    const agent = request.agent(server);
    const response = await agent.get('/api/auth/csrf').expect(200);
    return { agent, csrfToken: (response.body as CsrfBody).csrfToken };
  };

  const authenticate = async (login: string): Promise<Session> => {
    const { agent, csrfToken } = await freshAgent();
    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ login, password: PASSWORD })
      .expect(200);

    const body = response.body as AuthBody;
    expect(body).not.toHaveProperty('accessToken');

    return {
      agent,
      csrfToken: body.csrfToken,
      cookie: extractCookie(response, 'rg_auth'),
      user: body.user,
    };
  };

  beforeAll(async () => {
    await createApplication();

    for (const login of [loginA, loginB]) {
      const { agent, csrfToken } = await freshAgent();
      await agent
        .post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: `Usuário ${login}`, login, password: PASSWORD, confirmPassword: PASSWORD })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a persisted session whose identifier is hashed, not stored in plain text', async () => {
    const session = await authenticate(loginA);
    const rows = await sequelize.query<SessionRow>(
      'SELECT token_identifier_hash, revoked_at, expires_at FROM auth_sessions WHERE user_id = ?',
      { replacements: [session.user.id], type: QueryTypes.SELECT },
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].token_identifier_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].revoked_at).toBeNull();
    expect(rows[0].expires_at).toBeInstanceOf(Date);

    const rawToken = session.cookie.replace('rg_auth=', '');
    const payload = await jwtService.verifyAsync<{ jti: string }>(rawToken);
    expect(payload.jti).toBeTruthy();
    expect(rows[0].token_identifier_hash).not.toBe(payload.jti);
  });

  it('rejects mutations without CSRF and with a mismatched origin or token', async () => {
    const session = await authenticate(loginA);

    await session.agent
      .post('/api/recipes')
      .send({
        name: 'Sem CSRF',
        categoryId: 1,
        preparationTimeMinutes: 10,
        servings: 1,
        ingredients: 'x',
        instructions: 'x',
      })
      .expect(403);

    await session.agent
      .post('/api/recipes')
      .set('X-CSRF-Token', 'x'.repeat(40))
      .send({
        name: 'CSRF inválido',
        categoryId: 1,
        preparationTimeMinutes: 10,
        servings: 1,
        ingredients: 'x',
        instructions: 'x',
      })
      .expect(403);

    await session.agent
      .post('/api/recipes')
      .set('X-CSRF-Token', session.csrfToken)
      .set('Origin', 'https://evil.example')
      .send({
        name: 'Origem inválida',
        categoryId: 1,
        preparationTimeMinutes: 10,
        servings: 1,
        ingredients: 'x',
        instructions: 'x',
      })
      .expect(403);

    await session.agent.get('/api/auth/me').expect(200);
  });

  it('sets auth and CSRF cookies with the same Max-Age on login', async () => {
    const { agent, csrfToken } = await freshAgent();
    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ login: loginA, password: PASSWORD })
      .expect(200);

    const authCookie = extractSetCookie(response, 'rg_auth');
    const csrfCookie = extractSetCookie(response, 'rg_csrf');

    expect(maxAgeOf(authCookie)).toBe('3600');
    expect(maxAgeOf(csrfCookie)).toBe(maxAgeOf(authCookie));

    for (const cookie of [authCookie, csrfCookie]) {
      expect(cookie).toContain('Path=/api');
      expect(cookie.toLowerCase()).toContain('httponly');
      expect(cookie.toLowerCase()).toContain('samesite=lax');
    }
  });

  it('restores a session with a missing CSRF cookie and keeps CSRF validation active', async () => {
    const session = await authenticate(loginA);

    // Browser reiniciado: rg_auth sobreviveu, rg_csrf não.
    const restored = await request(server)
      .get('/api/auth/me')
      .set('Cookie', session.cookie)
      .expect(200);

    const csrfCookie = extractSetCookie(restored, 'rg_csrf');
    const csrfToken = (restored.body as { csrfToken: string }).csrfToken;

    expect(maxAgeOf(csrfCookie)).toBeDefined();
    expect(csrfToken).toBe(session.csrfToken);

    const cookies = `${session.cookie}; ${extractCookie(restored, 'rg_csrf')}`;

    await request(server)
      .post('/api/recipes')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send(recipePayload('Receita após restauração'))
      .expect(201);

    await request(server)
      .post('/api/recipes')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', 'x'.repeat(40))
      .send(recipePayload('CSRF ainda inválido'))
      .expect(403);

    await request(server)
      .post('/api/recipes')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', csrfToken)
      .send(recipePayload('Sem cookie CSRF'))
      .expect(403);
  });

  it('rebinds the session-bound CSRF token through the public bootstrap route', async () => {
    const session = await authenticate(loginA);

    const response = await request(server)
      .get('/api/auth/csrf')
      .set('Cookie', session.cookie)
      .expect(200);

    expect((response.body as CsrfBody).csrfToken).toBe(session.csrfToken);
    expect(maxAgeOf(extractSetCookie(response, 'rg_csrf'))).toBeDefined();
  });

  it('revokes only the logged-out session and keeps other sessions valid', async () => {
    const first = await authenticate(loginA);
    const second = await authenticate(loginA);
    const otherUser = await authenticate(loginB);

    await first.agent.post('/api/auth/logout').set('X-CSRF-Token', first.csrfToken).expect(200);

    await request(server).get('/api/auth/me').set('Cookie', first.cookie).expect(401);
    await request(server).get('/api/auth/me').set('Cookie', second.cookie).expect(200);
    await request(server).get('/api/auth/me').set('Cookie', otherUser.cookie).expect(200);
  });

  it('clears both cookies on logout', async () => {
    const session = await authenticate(loginB);
    const response = await session.agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', session.csrfToken)
      .expect(200);

    const authCookie = extractSetCookie(response, 'rg_auth');
    const csrfCookie = extractSetCookie(response, 'rg_csrf');

    expect(authCookie).toMatch(/^rg_auth=;/);
    expect(csrfCookie).toMatch(/^rg_csrf=;/);
    // `clearCookie` usa Expires no passado (não Max-Age=0) para remover o cookie.
    expect(authCookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(csrfCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('rejects tampered, expired and userless tokens', async () => {
    const signs: Array<{ cookie: string; payload: Record<string, unknown>; options?: object }> = [
      { cookie: 'rg_auth=token.adulterado.invalido', payload: {}, options: undefined },
      {
        cookie: 'rg_auth=expirado',
        payload: { sub: 1, login: 'qualquer', name: null, jti: 'expirado' },
        options: { expiresIn: -10 },
      },
      {
        cookie: 'rg_auth=sem-usuario',
        payload: { sub: 999_999, login: 'inexistente', name: null, jti: 'sem-usuario' },
      },
    ];

    signs[1].cookie = `rg_auth=${await jwtService.signAsync(signs[1].payload, {
      expiresIn: -10,
    })}`;
    signs[2].cookie = `rg_auth=${await jwtService.signAsync(signs[2].payload, {
      expiresIn: 3600,
    })}`;

    for (const item of signs) {
      await request(server).get('/api/auth/me').set('Cookie', item.cookie).expect(401);
    }
  });

  it('does not count ordinary authenticated reads toward the login limit', async () => {
    const session = await authenticate(loginA);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await request(server).get('/api/categories').set('Cookie', session.cookie).expect(200);
    }
  });

  it('limits login attempts and recovers after the configured window', async () => {
    // Módulo HTTP mínimo: criar uma segunda app completa com AppModule
    // reapontaria os models Sequelize globais para outra conexão e invalidate
    // a app principal. Aqui exercitamos a mesma configuração e o mesmo guard
    // usados pelas rotas de login, sem tocar no banco.
    const config = {
      get: jest.fn((name: string) => {
        const values: Record<string, number> = {
          LOGIN_RATE_LIMIT_LIMIT: 2,
          LOGIN_RATE_LIMIT_TTL_MS: 1_000,
          REGISTER_RATE_LIMIT_LIMIT: 3,
          REGISTER_RATE_LIMIT_TTL_MS: 3_600_000,
        };
        return values[name];
      }),
    } as unknown as ConfigService;

    const throttledApp = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions(config))],
      controllers: [ThrottleProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const throttledServer = throttledApp.createNestApplication();
    await throttledServer.init();
    const throttledHttp = throttledServer.getHttpServer() as Server;

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await request(throttledHttp)
          .post('/throttle-probe')
          .send({ login: 'nao.existe' })
          .expect(200);
      }

      const blocked = await request(throttledHttp)
        .post('/throttle-probe')
        .send({ login: 'nao.existe' })
        .expect(429);

      expect((blocked.body as { message: string }).message).toContain('Muitas tentativas');

      await new Promise((resolve) => setTimeout(resolve, 1_100));

      await request(throttledHttp)
        .post('/throttle-probe')
        .send({ login: 'nao.existe' })
        .expect(200);
    } finally {
      await throttledApp.close();
    }
  });

  it('does not restore a revoked session after an API restart', async () => {
    const session = await authenticate(loginB);

    await session.agent.post('/api/auth/logout').set('X-CSRF-Token', session.csrfToken).expect(200);

    await app.close();
    await createApplication();

    await request(server).get('/api/auth/me').set('Cookie', session.cookie).expect(401);
    const renewed = await authenticate(loginB);
    await request(server).get('/api/auth/me').set('Cookie', renewed.cookie).expect(200);
  });
});
