import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

interface AuthBody {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: number;
    nome: string | null;
    login: string;
    criadoEm: string;
  };
}

interface CategoryBody {
  id: number;
  nome: string | null;
}

interface RecipeBody {
  id: number;
  nome: string | null;
  categoria: CategoryBody | null;
  tempoPreparoMinutos: number | null;
  porcoes: number | null;
  ingredientes: string | null;
  modoPreparo: string;
  criadoEm: string;
  alteradoEm: string;
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

const PASSWORD = 'Senha@123';

describe('API de receitas (integração com MySQL)', () => {
  let app: INestApplication;
  let server: Server;
  let tokenA: string;
  let tokenB: string;
  let userA: AuthBody['user'];
  let userB: AuthBody['user'];
  let categoryBolos: CategoryBody;
  let categorySopas: CategoryBody;
  let recipeBoloId: number;
  let recipeSopaId: number;

  const loginA = `integracao.a.${Date.now()}`;
  const loginB = `integracao.b.${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const register = async (login: string, nome: string): Promise<AuthBody> => {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ nome, login, senha: PASSWORD, confirmarSenha: PASSWORD })
      .expect(201);

    return response.body as AuthBody;
  };

  const createRecipe = async (
    token: string,
    payload: Record<string, unknown>,
  ): Promise<RecipeBody> => {
    const response = await request(server)
      .post('/api/recipes')
      .set(auth(token))
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

    const authA = await register(loginA, 'Usuária A');
    const authB = await register(loginB, 'Usuário B');
    tokenA = authA.accessToken;
    tokenB = authB.accessToken;
    userA = authA.user;
    userB = authB.user;

    const categoriesResponse = await request(server)
      .get('/api/categories')
      .set(auth(tokenA))
      .expect(200);

    const categories = categoriesResponse.body as CategoryBody[];
    const bolos = categories.find((category) => category.nome === 'Bolos e tortas doces');
    const sopas = categories.find((category) => category.nome === 'Sopas');

    if (!bolos || !sopas) {
      throw new Error('As categorias iniciais não foram carregadas pelo script SQL.');
    }

    categoryBolos = bolos;
    categorySopas = sopas;
  });

  afterAll(async () => {
    await app.close();
  });

  it('protege as rotas privadas e padroniza o 401', async () => {
    const response = await request(server).get('/api/recipes').expect(401);
    const body = response.body as ErrorBody;

    expect(body.statusCode).toBe(401);
    expect(body.message).toBeTruthy();
    expect(body.path).toBe('/api/recipes');
  });

  it('rejeita login duplicado com 409', async () => {
    const response = await request(server)
      .post('/api/auth/register')
      .send({
        nome: 'Outra pessoa',
        login: loginA.toUpperCase(),
        senha: PASSWORD,
        confirmarSenha: PASSWORD,
      })
      .expect(409);

    expect((response.body as ErrorBody).message).toContain('já está em uso');
  });

  it('valida o cadastro e a confirmação de senha no backend', async () => {
    const response = await request(server)
      .post('/api/auth/register')
      .send({
        nome: 'A',
        login: 'in valido',
        senha: '123',
        confirmarSenha: '456',
      })
      .expect(400);

    const body = response.body as ErrorBody;
    expect(body.errors?.length).toBeGreaterThan(0);
    expect(body.errors?.join(' ')).toContain('As senhas não conferem');
  });

  it('autentica com credenciais válidas e rejeita senha incorreta', async () => {
    const success = await request(server)
      .post('/api/auth/login')
      .send({ login: loginA.toUpperCase(), senha: PASSWORD })
      .expect(200);

    const authBody = success.body as AuthBody;
    expect(authBody.accessToken).toBeTruthy();
    expect(authBody.user.id).toBe(userA.id);

    await request(server)
      .post('/api/auth/login')
      .send({ login: loginA, senha: 'SenhaErrada@1' })
      .expect(401);

    const me = await request(server).get('/api/auth/me').set(auth(tokenA)).expect(200);
    const meBody = me.body as AuthBody['user'];
    expect(meBody.login).toBe(loginA);
    expect(meBody).not.toHaveProperty('senha');
  });

  it('lista as 13 categorias do banco em ordem alfabética', async () => {
    const response = await request(server).get('/api/categories').set(auth(tokenA)).expect(200);

    const categories = response.body as CategoryBody[];
    expect(categories).toHaveLength(13);
    expect(categories[0].nome).toBe('Alimentação Saudável');
  });

  it('cria receitas sempre com o usuário do token e rejeita id_usuarios do cliente', async () => {
    await request(server)
      .post('/api/recipes')
      .set(auth(tokenA))
      .send({
        nome: 'Tentativa de forjar dono',
        categoriaId: categoryBolos.id,
        tempoPreparoMinutos: 10,
        porcoes: 1,
        ingredientes: 'Nada',
        modoPreparo: 'Nada',
        idUsuarios: userB.id,
      })
      .expect(400);

    const bolo = await createRecipe(tokenA, {
      nome: 'Bolo de cenoura integração',
      categoriaId: categoryBolos.id,
      tempoPreparoMinutos: 45,
      porcoes: 8,
      ingredientes: '3 cenouras\n3 ovos\n2 xícaras de farinha',
      modoPreparo: 'Bata tudo e asse por 40 minutos.',
    });

    expect(bolo.id).toBeGreaterThan(0);
    expect(bolo.categoria?.id).toBe(categoryBolos.id);
    expect(bolo.nome).toBe('Bolo de cenoura integração');

    const sopa = await createRecipe(tokenA, {
      nome: 'Sopa de legumes integração',
      categoriaId: categorySopas.id,
      tempoPreparoMinutos: 30,
      porcoes: 4,
      ingredientes: 'Legumes variados\nÁgua\nSal',
      modoPreparo: 'Cozinhe os legumes e tempere.',
    });

    recipeBoloId = bolo.id;
    recipeSopaId = sopa.id;

    const listB = await request(server).get('/api/recipes').set(auth(tokenB)).expect(200);

    expect((listB.body as PaginatedRecipesBody).meta.total).toBe(0);
  });

  it('valida os campos da receita e a existência da categoria', async () => {
    const response = await request(server)
      .post('/api/recipes')
      .set(auth(tokenA))
      .send({
        nome: 'x'.repeat(46),
        categoriaId: 999999,
        tempoPreparoMinutos: 0,
        porcoes: 0,
        ingredientes: '',
        modoPreparo: '',
      })
      .expect(400);

    expect((response.body as ErrorBody).errors?.length).toBeGreaterThan(0);
  });

  it('pesquisa, filtra e ordena no banco', async () => {
    const search = await request(server)
      .get('/api/recipes?search=cenoura')
      .set(auth(tokenA))
      .expect(200);

    const searchBody = search.body as PaginatedRecipesBody;
    expect(searchBody.meta.total).toBe(1);
    expect(searchBody.data[0].id).toBe(recipeBoloId);

    const filter = await request(server)
      .get(`/api/recipes?categoriaId=${categorySopas.id}`)
      .set(auth(tokenA))
      .expect(200);

    const filterBody = filter.body as PaginatedRecipesBody;
    expect(filterBody.meta.total).toBe(1);
    expect(filterBody.data[0].id).toBe(recipeSopaId);

    const sorted = await request(server)
      .get('/api/recipes?sortBy=nome&order=asc')
      .set(auth(tokenA))
      .expect(200);

    const sortedBody = sorted.body as PaginatedRecipesBody;
    expect(sortedBody.data).toHaveLength(2);
    expect(sortedBody.data[0].nome).toBe('Bolo de cenoura integração');
  });

  it('consulta e edita a própria receita', async () => {
    const detail = await request(server)
      .get(`/api/recipes/${recipeBoloId}`)
      .set(auth(tokenA))
      .expect(200);

    expect((detail.body as RecipeBody).id).toBe(recipeBoloId);

    const updated = await request(server)
      .patch(`/api/recipes/${recipeBoloId}`)
      .set(auth(tokenA))
      .send({ nome: 'Bolo de cenoura atualizado', porcoes: 10 })
      .expect(200);

    const body = updated.body as RecipeBody;
    expect(body.nome).toBe('Bolo de cenoura atualizado');
    expect(body.porcoes).toBe(10);
    expect(new Date(body.alteradoEm).getTime()).toBeGreaterThanOrEqual(
      new Date(body.criadoEm).getTime(),
    );
  });

  it('BLOQUEIA outro usuário de consultar, editar e excluir a receita', async () => {
    await request(server).get(`/api/recipes/${recipeBoloId}`).set(auth(tokenB)).expect(404);

    await request(server)
      .patch(`/api/recipes/${recipeBoloId}`)
      .set(auth(tokenB))
      .send({ nome: 'Tentativa de invasão' })
      .expect(404);

    await request(server).delete(`/api/recipes/${recipeBoloId}`).set(auth(tokenB)).expect(404);

    const stillThere = await request(server)
      .get(`/api/recipes/${recipeBoloId}`)
      .set(auth(tokenA))
      .expect(200);

    expect((stillThere.body as RecipeBody).nome).not.toBe('Tentativa de invasão');
  });

  it('exclui a própria receita e deixa de encontrá-la', async () => {
    await request(server).delete(`/api/recipes/${recipeBoloId}`).set(auth(tokenA)).expect(204);

    await request(server).get(`/api/recipes/${recipeBoloId}`).set(auth(tokenA)).expect(404);

    await request(server).delete(`/api/recipes/${recipeSopaId}`).set(auth(tokenA)).expect(204);

    const stats = await request(server).get('/api/recipes/stats').set(auth(tokenA)).expect(200);

    expect(stats.body).toMatchObject({ totalReceitas: 0, categoriasUtilizadas: 0 });
  });

  it('encerra a sessão do cliente sem expor dados privados', async () => {
    await request(server).post('/api/auth/logout').set(auth(tokenA)).expect(200);

    const response = await request(server)
      .get('/api/auth/me')
      .set({ Authorization: 'Bearer token-invalido' })
      .expect(401);

    expect((response.body as ErrorBody).statusCode).toBe(401);
  });
});
