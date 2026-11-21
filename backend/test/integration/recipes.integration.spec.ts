import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { down as rollbackCategories } from '../../src/database/seeders/001-categorias';

interface AuthBody {
  expiresIn: number;
  csrfToken: string;
  user: {
    id: number;
    name: string | null;
    login: string;
    createdAt: string;
  };
}

interface CsrfBody {
  csrfToken: string;
}

interface MeBody {
  user: AuthBody['user'];
  csrfToken: string;
}

interface CategoryBody {
  id: number;
  name: string | null;
}

interface RecipeBody {
  id: number;
  name: string | null;
  category: CategoryBody | null;
  preparationTimeMinutes: number | null;
  servings: number | null;
  ingredients: string | null;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedRecipesBody {
  data: RecipeBody[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  path: string;
}

type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrfToken: string;
  user: AuthBody['user'];
}

const PASSWORD = 'Senha@123';

describe('Recipes API (MySQL integration)', () => {
  let app: INestApplication;
  let server: Server;
  let sequelize: Sequelize;
  let sessionA: Session;
  let sessionB: Session;
  let categoryBolos: CategoryBody;
  let categorySopas: CategoryBody;
  let recipeBoloId: number;
  let recipeSopaId: number;

  const loginA = `integracao.a.${Date.now()}`;
  const loginB = `integracao.b.${Date.now()}`;

  const csrfHeader = (session: Session) => ({ 'X-CSRF-Token': session.csrfToken });

  const freshAgent = async (): Promise<{ agent: Agent; csrfToken: string }> => {
    const agent = request.agent(server);
    const response = await agent.get('/api/auth/csrf').expect(200);
    return { agent, csrfToken: (response.body as CsrfBody).csrfToken };
  };

  const register = async (login: string, name: string): Promise<Session> => {
    const { agent, csrfToken } = await freshAgent();
    const response = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({ name, login, password: PASSWORD, confirmPassword: PASSWORD })
      .expect(201);

    const body = response.body as AuthBody;
    expect(body).not.toHaveProperty('accessToken');
    return { agent, csrfToken: body.csrfToken, user: body.user };
  };

  const createRecipe = async (
    session: Session,
    payload: Record<string, unknown>,
  ): Promise<RecipeBody> => {
    const response = await session.agent
      .post('/api/recipes')
      .set(csrfHeader(session))
      .send(payload)
      .expect(201);

    return response.body as RecipeBody;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    sequelize = app.get(Sequelize);

    sessionA = await register(loginA, 'Usuária A');
    sessionB = await register(loginB, 'Usuário B');

    const categoriesResponse = await sessionA.agent.get('/api/categories').expect(200);

    const categories = categoriesResponse.body as CategoryBody[];
    const bolos = categories.find((category) => category.name === 'Bolos e tortas doces');
    const sopas = categories.find((category) => category.name === 'Sopas');

    if (!bolos || !sopas) {
      throw new Error('As categorias iniciais não foram carregadas pelo script SQL.');
    }

    categoryBolos = bolos;
    categorySopas = sopas;
  });

  afterAll(async () => {
    await app.close();
  });

  it('protects private routes and standardizes the 401', async () => {
    const response = await request(server).get('/api/recipes').expect(401);
    const body = response.body as ErrorBody;

    expect(body.statusCode).toBe(401);
    expect(body.message).toBeTruthy();
    expect(body.path).toBe('/api/recipes');
  });

  it('stores the password only as a bcrypt hash', async () => {
    const rows = await sequelize.query<{ senha: string }>(
      'SELECT senha FROM usuarios WHERE login = ?',
      { replacements: [loginA], type: QueryTypes.SELECT },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].senha).toMatch(/^\$2[aby]\$/);
    expect(rows[0].senha).not.toBe(PASSWORD);
    expect(rows[0].senha.length).toBeGreaterThan(50);
  });

  it('rejects a duplicate login with 409', async () => {
    const { agent, csrfToken } = await freshAgent();
    const response = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Outra pessoa',
        login: loginA.toUpperCase(),
        password: PASSWORD,
        confirmPassword: PASSWORD,
      })
      .expect(409);

    expect((response.body as ErrorBody).message).toContain('já está em uso');
  });

  it('validates registration and password confirmation in the backend', async () => {
    const { agent, csrfToken } = await freshAgent();
    const response = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'A',
        login: 'in valido',
        password: '123',
        confirmPassword: '456',
      })
      .expect(400);

    const body = response.body as ErrorBody;
    expect(body.errors?.length).toBeGreaterThan(0);
    expect(body.errors?.join(' ')).toContain('As senhas não conferem');
  });

  it('authenticates with cookies and rejects an incorrect password', async () => {
    const { agent, csrfToken } = await freshAgent();
    const success = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ login: loginA.toUpperCase(), password: PASSWORD })
      .expect(200);

    const authBody = success.body as AuthBody;
    expect(authBody).not.toHaveProperty('accessToken');
    expect(authBody.csrfToken).toBeTruthy();
    expect(authBody.user.id).toBe(sessionA.user.id);

    const cookies = (success.headers['set-cookie'] ?? []) as unknown as string[];
    const allCookies = cookies.join(';');
    expect(allCookies).toContain('rg_auth=');
    expect(allCookies).toContain('HttpOnly');
    expect(allCookies).toContain('Path=/api');

    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', authBody.csrfToken)
      .send({ login: loginA, password: 'SenhaErrada@1' })
      .expect(401);

    const me = await agent.get('/api/auth/me').expect(200);
    const meBody = me.body as MeBody;
    expect(meBody.user.login).toBe(loginA);
    expect(meBody.user).not.toHaveProperty('passwordHash');
    expect(meBody.user).not.toHaveProperty('senha');
    expect(meBody.csrfToken).toBe(authBody.csrfToken);
  });

  it('lists the 13 database categories in alphabetical order', async () => {
    const response = await sessionA.agent.get('/api/categories').expect(200);

    const categories = response.body as CategoryBody[];
    expect(categories).toHaveLength(13);
    expect(categories[0].name).toBe('Alimentação Saudável');
  });

  it('creates recipes for the session user and rejects client-supplied userId', async () => {
    await sessionA.agent
      .post('/api/recipes')
      .set(csrfHeader(sessionA))
      .send({
        name: 'Tentativa de forjar dono',
        categoryId: categoryBolos.id,
        preparationTimeMinutes: 10,
        servings: 1,
        ingredients: 'Nada',
        instructions: 'Nada',
        userId: sessionB.user.id,
      })
      .expect(400);

    const bolo = await createRecipe(sessionA, {
      name: 'Bolo de cenoura integração',
      categoryId: categoryBolos.id,
      preparationTimeMinutes: 45,
      servings: 8,
      ingredients: '3 cenouras\n3 ovos\n2 xícaras de farinha',
      instructions: 'Bata tudo e asse por 40 minutos.',
    });

    expect(bolo.id).toBeGreaterThan(0);
    expect(bolo.category?.id).toBe(categoryBolos.id);
    expect(bolo.name).toBe('Bolo de cenoura integração');

    const sopa = await createRecipe(sessionA, {
      name: 'Sopa de legumes integração',
      categoryId: categorySopas.id,
      preparationTimeMinutes: 30,
      servings: 4,
      ingredients: 'Legumes variados\nÁgua\nSal',
      instructions: 'Cozinhe os legumes e tempere.',
    });

    recipeBoloId = bolo.id;
    recipeSopaId = sopa.id;

    const listB = await sessionB.agent.get('/api/recipes').expect(200);
    expect((listB.body as PaginatedRecipesBody).meta.total).toBe(0);
  });

  it('does not remove categories or recipes on seeder rollback', async () => {
    await sequelize.query(
      "INSERT INTO categorias (id, nome) VALUES (99, 'Categoria preexistente')",
    );

    await expect(
      rollbackCategories({ context: sequelize.getQueryInterface() }),
    ).resolves.toBeUndefined();

    const recipeRows = await sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM receitas WHERE id = ?',
      { replacements: [recipeBoloId], type: QueryTypes.SELECT },
    );
    const categoryRows = await sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM categorias WHERE id = ?',
      { replacements: [categoryBolos.id], type: QueryTypes.SELECT },
    );
    const preexistingRows = await sequelize.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM categorias WHERE id = 99',
      { type: QueryTypes.SELECT },
    );

    expect(Number(recipeRows[0].total)).toBe(1);
    expect(Number(categoryRows[0].total)).toBe(1);
    expect(Number(preexistingRows[0].total)).toBe(1);
  });

  it('validates recipe fields and category existence', async () => {
    const response = await sessionA.agent
      .post('/api/recipes')
      .set(csrfHeader(sessionA))
      .send({
        name: 'x'.repeat(46),
        categoryId: 999999,
        preparationTimeMinutes: 0,
        servings: 0,
        ingredients: '',
        instructions: '',
      })
      .expect(400);

    expect((response.body as ErrorBody).errors?.length).toBeGreaterThan(0);
  });

  it('searches, filters and sorts in the database', async () => {
    const search = await sessionA.agent.get('/api/recipes?search=cenoura').expect(200);

    const searchBody = search.body as PaginatedRecipesBody;
    expect(searchBody.meta.total).toBe(1);
    expect(searchBody.data[0].id).toBe(recipeBoloId);

    const filter = await sessionA.agent
      .get(`/api/recipes?categoryId=${categorySopas.id}`)
      .expect(200);

    const filterBody = filter.body as PaginatedRecipesBody;
    expect(filterBody.meta.total).toBe(1);
    expect(filterBody.data[0].id).toBe(recipeSopaId);

    const sorted = await sessionA.agent.get('/api/recipes?sortBy=name&order=asc').expect(200);

    const sortedBody = sorted.body as PaginatedRecipesBody;
    expect(sortedBody.data).toHaveLength(2);
    expect(sortedBody.data[0].name).toBe('Bolo de cenoura integração');

    for (const term of ['%', '_', "' OR 1=1 -- "]) {
      const wildcard = await sessionA.agent
        .get(`/api/recipes?search=${encodeURIComponent(term)}`)
        .expect(200);

      expect((wildcard.body as PaginatedRecipesBody).meta.total).toBe(0);
    }
  });

  it('responds in Portuguese to an invalid identifier', async () => {
    const response = await sessionA.agent.get('/api/recipes/abc').expect(400);

    expect((response.body as ErrorBody).message).toBe('Identificador da receita inválido.');
  });

  it('reads and edits the owned recipe', async () => {
    const detail = await sessionA.agent.get(`/api/recipes/${recipeBoloId}`).expect(200);
    expect((detail.body as RecipeBody).id).toBe(recipeBoloId);

    const updated = await sessionA.agent
      .patch(`/api/recipes/${recipeBoloId}`)
      .set(csrfHeader(sessionA))
      .send({ name: 'Bolo de cenoura atualizado', servings: 10 })
      .expect(200);

    const body = updated.body as RecipeBody;
    expect(body.name).toBe('Bolo de cenoura atualizado');
    expect(body.servings).toBe(10);
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.createdAt).getTime(),
    );
  });

  it('blocks another user from reading, editing and deleting the recipe', async () => {
    await sessionB.agent.get(`/api/recipes/${recipeBoloId}`).expect(404);

    await sessionB.agent
      .patch(`/api/recipes/${recipeBoloId}`)
      .set(csrfHeader(sessionB))
      .send({ name: 'Tentativa de invasão' })
      .expect(404);

    await sessionB.agent
      .delete(`/api/recipes/${recipeBoloId}`)
      .set(csrfHeader(sessionB))
      .expect(404);

    const stillThere = await sessionA.agent.get(`/api/recipes/${recipeBoloId}`).expect(200);
    expect((stillThere.body as RecipeBody).name).not.toBe('Tentativa de invasão');
  });

  it('deletes the owned recipe and no longer finds it', async () => {
    await sessionA.agent
      .delete(`/api/recipes/${recipeBoloId}`)
      .set(csrfHeader(sessionA))
      .expect(204);

    await sessionA.agent.get(`/api/recipes/${recipeBoloId}`).expect(404);

    await sessionA.agent
      .delete(`/api/recipes/${recipeSopaId}`)
      .set(csrfHeader(sessionA))
      .expect(204);

    const stats = await sessionA.agent.get('/api/recipes/stats').expect(200);
    expect(stats.body).toMatchObject({ totalRecipes: 0, categoriesUsed: 0 });
  });

  it('ends the session and rejects the revoked cookie', async () => {
    await sessionA.agent.post('/api/auth/logout').set(csrfHeader(sessionA)).expect(200);

    await sessionA.agent.get('/api/auth/me').expect(401);

    const response = await request(server)
      .get('/api/auth/me')
      .set({ Cookie: 'rg_auth=token-invalido' })
      .expect(401);

    expect((response.body as ErrorBody).statusCode).toBe(401);
  });
});
