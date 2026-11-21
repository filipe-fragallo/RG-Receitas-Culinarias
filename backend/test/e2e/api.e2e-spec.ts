import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { setupSwagger } from '../../src/config/swagger';

interface AuthBody {
  expiresIn: number;
  csrfToken: string;
  user: { id: number; login: string };
}

interface CsrfBody {
  csrfToken: string;
}

interface RecipeBody {
  id: number;
  name: string | null;
  category: { id: number; name: string | null } | null;
}

interface PaginatedBody {
  data: RecipeBody[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface SwaggerDoc {
  info: { title: string };
  paths: Record<string, unknown>;
  components?: {
    securitySchemes?: Record<string, { type?: string; in?: string; name?: string }>;
  };
}

interface ErrorBody {
  statusCode: number;
  path: string;
  timestamp: string;
}

type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrfToken: string;
}

const PASSWORD = 'Senha@123';

describe('API E2E (HTTP + MySQL + Swagger)', () => {
  let app: INestApplication;
  let server: Server;

  const login = `e2e.api.${Date.now()}`;

  const freshAgent = async (): Promise<Session> => {
    const agent = request.agent(server);
    const response = await agent.get('/api/auth/csrf').expect(200);
    return { agent, csrfToken: (response.body as CsrfBody).csrfToken };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a public healthcheck that queries MySQL', async () => {
    const response = await request(server).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('applies configured security headers, CORS credentials and cookies', async () => {
    const response = await request(server)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('publishes an OpenAPI contract based on cookies and CSRF', async () => {
    const response = await request(server).get('/api/docs-json').expect(200);
    const document = response.body as SwaggerDoc;

    expect(document.info.title).toContain('Meu Caderno de Receitas');
    expect(document.paths).toHaveProperty('/api/recipes');
    expect(document.paths).toHaveProperty('/api/auth/login');
    expect(document.components?.securitySchemes).toMatchObject({
      'auth-cookie': { type: 'apiKey', in: 'cookie', name: 'rg_auth' },
      'csrf-token': { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
    });

    const description = JSON.stringify(document.paths['/api/auth/login']);
    expect(description).not.toContain('accessToken');
    expect(description).toContain('X-CSRF-Token');
  });

  it('responds with a standardized 404 for unknown routes', async () => {
    const response = await request(server).get('/api/nonexistent-route').expect(404);
    const body = response.body as ErrorBody;

    expect(body).toMatchObject({ statusCode: 404, path: '/api/nonexistent-route' });
    expect(body.timestamp).toBeTruthy();
  });

  it('walks through registration, CRUD, stats and deletion with cookies', async () => {
    const session = await freshAgent();
    const register = await session.agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', session.csrfToken)
      .send({ name: 'Usuária E2E', login, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);

    const authBody = register.body as AuthBody;
    expect(authBody).not.toHaveProperty('accessToken');
    session.csrfToken = authBody.csrfToken;

    const categories = await session.agent.get('/api/categories').expect(200);
    const category = (categories.body as { id: number; name: string }[]).find(
      (item) => item.name === 'Massas',
    );

    if (!category) throw new Error('Categoria "Massas" não encontrada.');

    const created = await session.agent
      .post('/api/recipes')
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        name: 'Macarrão E2E',
        categoryId: category.id,
        preparationTimeMinutes: 20,
        servings: 2,
        ingredients: 'Macarrão\nMolho',
        instructions: 'Cozinhe e misture o molho.',
      })
      .expect(201);

    const recipe = created.body as RecipeBody;
    expect(recipe.category?.id).toBe(category.id);

    const stats = await session.agent.get('/api/recipes/stats').expect(200);
    expect(stats.body).toMatchObject({ totalRecipes: 1, categoriesUsed: 1 });

    const updated = await session.agent
      .patch(`/api/recipes/${recipe.id}`)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ name: 'Macarrão E2E atualizado' })
      .expect(200);

    expect((updated.body as RecipeBody).name).toBe('Macarrão E2E atualizado');

    await session.agent
      .delete(`/api/recipes/${recipe.id}`)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(204);

    await session.agent.get(`/api/recipes/${recipe.id}`).expect(404);
  });

  it('validates pagination limits and returns an empty out-of-range page', async () => {
    const session = await freshAgent();
    const loginBody = await session.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', session.csrfToken)
      .send({ login, password: PASSWORD })
      .expect(200);

    session.csrfToken = (loginBody.body as AuthBody).csrfToken;

    await session.agent.get('/api/recipes?page=0').expect(400);
    await session.agent.get('/api/recipes?limit=51').expect(400);

    const outOfRange = await session.agent.get('/api/recipes?page=99&limit=9').expect(200);
    const body = outOfRange.body as PaginatedBody;
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('rejects an expired token cookie with a standardized 401', async () => {
    const jwtService = app.get(JwtService);
    const expiredToken = await jwtService.signAsync(
      { sub: 1, login: 'expirado', name: 'Expirado', jti: 'sessao-expirada' },
      { expiresIn: -10 },
    );

    const response = await request(server)
      .get('/api/auth/me')
      .set({ Cookie: `rg_auth=${expiredToken}` })
      .expect(401);

    expect(response.body).toMatchObject({ statusCode: 401 });
  });
});
