import { expect, request, test, type Page } from '@playwright/test';

import {
  BACKEND_URL,
  apiFetch,
  authCookieValue,
  createRecipe,
  getCsrfToken,
  listCategories,
  loginAccount,
  logoutAccount,
  readAuthenticatedUser,
  readRevokedAt,
  registerAccount,
  startTemporaryBackend,
  stopBackend,
  uniqueToken,
  waitForBackend,
  type Account,
} from './helpers/e2e-support';

const cardLinks = (page: Page) => page.locator('a[aria-label^="Ver detalhes da receita "]');

test.describe('Fluxos do caderno de receitas no Chromium', () => {
  test('01 - cadastro cria conta autenticada sem expor JWT ao JavaScript', async ({ page }) => {
    const account = await registerAccount(page);

    const cookies = await page.context().cookies();
    const authCookie = cookies.find((cookie) => cookie.name === 'rg_auth');
    const csrfCookie = cookies.find((cookie) => cookie.name === 'rg_csrf');
    expect(authCookie).toMatchObject({ httpOnly: true, path: '/api' });
    expect(csrfCookie).toMatchObject({ httpOnly: true, path: '/api' });
    expect(await page.evaluate(() => window.localStorage.getItem('meu-caderno:token'))).toBeNull();
    await expect(page.locator('aside')).toContainText(account.name);
  });

  test('02 - login restaura uma conta existente pela interface', async ({ page }) => {
    const account = await registerAccount(page);
    await logoutAccount(page);
    await loginAccount(page, account);

    await expect(page.locator('aside')).toContainText(account.name);
    const user = await readAuthenticatedUser(page);
    expect(user.login).toBe(account.login);
  });

  test('03 - refresh da página preserva a sessão e as receitas', async ({ page }) => {
    await registerAccount(page);
    const name = `Receita refresh ${uniqueToken()}`;
    const [category] = await listCategories(page);
    await createRecipe(page, { name, categoryId: category.id });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Minhas receitas' })).toBeVisible();
    await expect(page.getByRole('link', { name: `Ver detalhes da receita ${name}` })).toBeVisible();
  });

  test('04 - criação de receita pelo formulário', async ({ page }) => {
    await registerAccount(page);
    const name = `Bolo de cenoura ${uniqueToken()}`;

    await page.goto('/recipes/new');
    await page.getByLabel('Nome da receita').fill(name);
    await page.getByLabel('Categoria').selectOption({ label: 'Bolos e tortas doces' });
    await page.getByLabel('Tempo de preparo').fill('45');
    await page.getByLabel('Porções').fill('8');
    await page.getByLabel('O que vai na receita').fill('3 cenouras\n3 ovos\n2 xícaras de farinha');
    await page
      .getByLabel('Como preparar')
      .fill('Bata as cenouras e os ovos.\nMisture os secos e asse por 40 minutos.');
    await page.getByRole('button', { name: 'Criar receita' }).click();

    await expect(page).toHaveURL(/\/recipes\/\d+$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('3 cenouras', { exact: true }).first()).toBeVisible();
  });

  test('05 - validação do formulário bloqueia um envio inválido', async ({ page }) => {
    await registerAccount(page);

    await page.goto('/recipes/new');
    await page.getByRole('button', { name: 'Criar receita' }).click();

    await expect(page).toHaveURL('/recipes/new');
    await expect(page.getByText('Informe o nome da receita.')).toBeVisible();
    await expect(page.getByText('Selecione uma categoria.')).toBeVisible();
    await expect(page.getByText('Informe os ingredientes.')).toBeVisible();
    await expect(page.getByText('Informe o modo de preparo.')).toBeVisible();
  });

  test('06 - listagem exibe as receitas e as estatísticas do usuário', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const names = [`Listagem A ${uniqueToken()}`, `Listagem B ${uniqueToken()}`];
    for (const name of names) await createRecipe(page, { name, categoryId: category.id });

    await page.goto('/');

    for (const name of names) {
      await expect(
        page.getByRole('link', { name: `Ver detalhes da receita ${name}` }),
      ).toBeVisible();
    }
    await expect(page.getByText(/2 receitas/).first()).toBeVisible();
  });

  test('07 - pesquisa localiza receitas e limpa os resultados', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const token = uniqueToken();
    const matching = `Cenoura ${token}`;
    const other = `Outra receita ${token}`;
    await createRecipe(page, { name: matching, categoryId: category.id });
    await createRecipe(page, { name: other, categoryId: category.id });

    await page.goto('/');
    const search = page.getByLabel('Pesquisar');
    await search.fill('Cenoura');
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${matching}` }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: `Ver detalhes da receita ${other}` })).toHaveCount(
      0,
    );

    await search.fill('receita inexistente');
    await expect(page.getByText('Nenhuma receita encontrada')).toBeVisible();

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${matching}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${other}` }),
    ).toBeVisible();
  });

  test('08 - filtro por categoria limita a listagem', async ({ page }) => {
    await registerAccount(page);
    const categories = await listCategories(page);
    const [first, second] = categories;
    const token = uniqueToken();
    const inFirst = `Categoria um ${token}`;
    const inSecond = `Categoria dois ${token}`;
    await createRecipe(page, { name: inFirst, categoryId: first.id });
    await createRecipe(page, { name: inSecond, categoryId: second.id });

    await page.goto('/');
    await page.getByLabel('Categoria', { exact: true }).selectOption(String(first.id));

    await expect(page).toHaveURL(/category=/);
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${inFirst}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${inSecond}` }),
    ).toHaveCount(0);
  });

  test('09 - ordenação por nome funciona nos dois sentidos', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const token = uniqueToken();
    const names = [`Alfa ${token}`, `Bravo ${token}`, `Charlie ${token}`];
    for (const name of names) await createRecipe(page, { name, categoryId: category.id });

    await page.goto('/');
    const sort = page.getByLabel('Ordenar por');
    await sort.selectOption({ label: 'Nome (A–Z)' });

    await expect(cardLinks(page).nth(0)).toHaveAttribute(
      'aria-label',
      `Ver detalhes da receita ${names[0]}`,
    );
    await expect(cardLinks(page).nth(2)).toHaveAttribute(
      'aria-label',
      `Ver detalhes da receita ${names[2]}`,
    );

    await sort.selectOption({ label: 'Nome (Z–A)' });
    await expect(cardLinks(page).nth(0)).toHaveAttribute(
      'aria-label',
      `Ver detalhes da receita ${names[2]}`,
    );
    await expect(cardLinks(page).nth(2)).toHaveAttribute(
      'aria-label',
      `Ver detalhes da receita ${names[0]}`,
    );
  });

  test('10 - paginação avança para a segunda página e retorna', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const token = uniqueToken();
    for (let index = 0; index < 10; index += 1) {
      await createRecipe(page, {
        name: `Paginada ${token} ${String(index).padStart(2, '0')}`,
        categoryId: category.id,
      });
    }

    await page.goto('/');
    await expect(page.getByText(/Página 1 de 2/)).toBeVisible();
    await expect(cardLinks(page)).toHaveCount(9);

    await page.getByRole('button', { name: 'Próxima página' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cardLinks(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Página anterior' }).click();
    await expect(page).toHaveURL('/');
    await expect(cardLinks(page)).toHaveCount(9);
  });

  test('11 - detalhes apresentam ingredientes, preparo e metadados', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const name = `Detalhe ${uniqueToken()}`;
    await createRecipe(page, {
      name,
      categoryId: category.id,
      ingredients: 'Ingrediente exclusivo do detalhe',
      instructions: 'Passo exclusivo do detalhe.',
      preparationTimeMinutes: 25,
      servings: 6,
    });

    await page.goto('/');
    await page.getByRole('link', { name: `Ver detalhes da receita ${name}` }).click();

    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Ingrediente exclusivo do detalhe')).toBeVisible();
    await expect(page.getByText('Passo exclusivo do detalhe.').first()).toBeVisible();
    await expect(page.getByText('25 min', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('6 porções', { exact: false }).first()).toBeVisible();
  });

  test('12 - edição atualiza os dados da receita', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const name = `Antes ${uniqueToken()}`;
    const updatedName = `Depois ${uniqueToken()}`;
    await createRecipe(page, { name, categoryId: category.id });

    await page.goto('/');
    await page.getByRole('link', { name: `Ver detalhes da receita ${name}` }).click();
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/recipes\/\d+\/edit$/);

    await page.getByLabel('Nome da receita').fill(updatedName);
    await page.getByLabel('Tempo de preparo').fill('50');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
    await expect(page.getByText('50 min', { exact: false }).first()).toBeVisible();
  });

  test('13 - impressão usa a área A4 dedicada e aciona window.print', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const name = `Impressão ${uniqueToken()}`;
    await createRecipe(page, {
      name,
      categoryId: category.id,
      ingredients: 'Ingrediente para impressão',
      instructions: 'Passo para impressão.',
    });

    await page.goto('/');
    await page.getByRole('link', { name: `Ver detalhes da receita ${name}` }).click();

    await page.evaluate(() => {
      const bridge = window as Window & { __printCalled?: boolean };
      bridge.__printCalled = false;
      window.print = () => {
        bridge.__printCalled = true;
      };
    });
    await page.getByRole('button', { name: 'Imprimir' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __printCalled?: boolean }).__printCalled),
      )
      .toBe(true);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('article.print-only')).toBeVisible();
    await expect(page.locator('.screen-only').first()).toBeHidden();

    const cssText = await page.evaluate(async () => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      );
      const linked = await Promise.all(
        links.map(async (link) => {
          try {
            return await (await fetch(link.href)).text();
          } catch {
            return '';
          }
        }),
      );
      const inline = Array.from(document.querySelectorAll('style')).map(
        (element) => element.textContent ?? '',
      );
      return [...linked, ...inline].join('\n');
    });
    expect(cssText).toMatch(/@page\s*\{[^}]*size:\s*A4/i);
  });

  test('14 - exclusão remove a receita da listagem', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const name = `Excluir ${uniqueToken()}`;
    await createRecipe(page, { name, categoryId: category.id });

    await page.goto('/');
    await page.getByRole('link', { name: `Ver detalhes da receita ${name}` }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Excluir receita' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: `Ver detalhes da receita ${name}` })).toHaveCount(
      0,
    );
    await expect(page.getByText('Seu caderno está em branco')).toBeVisible();
  });

  test('15 - logout remove os cookies e encerra a sessão', async ({ page }) => {
    await registerAccount(page);
    await logoutAccount(page);

    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === 'rg_auth' && cookie.value.length > 0)).toBe(
      false,
    );
    expect(cookies.some((cookie) => cookie.name === 'rg_csrf' && cookie.value.length > 0)).toBe(
      false,
    );

    const response = await apiFetch(page, 'GET', '/api/auth/me');
    expect(response.status()).toBe(401);

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('16 - rotas privadas e públicas redirecionam conforme a sessão', async ({ page }) => {
    await page.goto('/recipes/new');
    await expect(page).toHaveURL('/login');

    await page.goto('/recipes/1');
    await expect(page).toHaveURL('/login');

    await registerAccount(page);
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });

  test('17 - CSRF bloqueia escrita sem token e aceita o token vigente', async ({ page }) => {
    await registerAccount(page);
    const [category] = await listCategories(page);
    const payload = {
      name: `Csrf ${uniqueToken()}`,
      categoryId: category.id,
      preparationTimeMinutes: 20,
      servings: 2,
      ingredients: 'Ingrediente CSRF',
      instructions: 'Passo CSRF.',
    };

    const rejected = await apiFetch(page, 'POST', '/api/recipes', { body: payload });
    expect(rejected.status()).toBe(403);

    const accepted = await apiFetch(page, 'POST', '/api/recipes', {
      token: await getCsrfToken(page),
      body: payload,
    });
    expect(accepted.status()).toBe(201);
  });

  test('18 - rate limiting devolve 429 após o limite configurado', async ({ page }) => {
    await page.goto('/login');
    const temporaryPort = 3013;
    const temporaryBaseUrl = `http://localhost:${temporaryPort}`;
    const child = await startTemporaryBackend(temporaryPort, {
      LOGIN_RATE_LIMIT_LIMIT: '3',
      LOGIN_RATE_LIMIT_TTL_MS: '60000',
    });
    const api = await request.newContext({ baseURL: temporaryBaseUrl });

    try {
      const csrfResponse = await api.get('/api/auth/csrf');
      expect(csrfResponse.ok()).toBeTruthy();
      const csrfToken = ((await csrfResponse.json()) as { csrfToken: string }).csrfToken;
      const body = { login: `bloqueado.${uniqueToken()}`, password: 'SenhaErrada@123' };

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await api.post('/api/auth/login', {
          headers: { 'X-CSRF-Token': csrfToken },
          data: body,
        });
        expect(response.status()).toBe(401);
      }

      const blocked = await api.post('/api/auth/login', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: body,
      });
      expect(blocked.status()).toBe(429);
      expect(await blocked.text()).toContain('Muitas tentativas');
    } finally {
      await api.dispose();
      await stopBackend(child);
    }
  });

  test('19 - sessão e receitas persistem após reinício da API', async ({ page }) => {
    test.setTimeout(180_000);
    const account: Account = await registerAccount(page);
    const [category] = await listCategories(page);
    const name = `Persistência ${uniqueToken()}`;
    const recipeId = await createRecipe(page, { name, categoryId: category.id });
    const token = await authCookieValue(page);
    const temporaryPort = 3014;
    const temporaryBaseUrl = `http://localhost:${temporaryPort}`;
    const temporaryApi = await request.newContext({ baseURL: temporaryBaseUrl });
    await temporaryApi.addCookies([
      {
        name: 'rg_auth',
        value: token,
        domain: new URL(temporaryBaseUrl).hostname,
        path: '/api',
      },
    ]);

    let first: Awaited<ReturnType<typeof startTemporaryBackend>> | undefined;
    let second: Awaited<ReturnType<typeof startTemporaryBackend>> | undefined;

    try {
      first = await startTemporaryBackend(temporaryPort);
      const beforeRestart = await temporaryApi.get('/api/auth/me');
      expect(beforeRestart.ok()).toBeTruthy();
      expect(((await beforeRestart.json()) as { user: { login: string } }).user.login).toBe(
        account.login,
      );

      await stopBackend(first);
      first = undefined;

      second = await startTemporaryBackend(temporaryPort);
      await waitForBackend(temporaryBaseUrl);
      const afterRestart = await temporaryApi.get('/api/auth/me');
      expect(afterRestart.ok()).toBeTruthy();
      expect(((await afterRestart.json()) as { user: { login: string } }).user.login).toBe(
        account.login,
      );

      const recipes = await temporaryApi.get('/api/recipes');
      expect(recipes.ok()).toBeTruthy();
      const list = (await recipes.json()) as { data: Array<{ id: number }> };
      expect(list.data.some((recipe) => recipe.id === recipeId)).toBe(true);
    } finally {
      await temporaryApi.dispose();
      if (second) await stopBackend(second);
      if (first) await stopBackend(first);
    }
  });

  test('20 - revogação persistida impede o reuso do token após logout', async ({ page }) => {
    const account = await registerAccount(page);
    const user = await readAuthenticatedUser(page);
    const token = await authCookieValue(page);

    await logoutAccount(page);

    const replay = await request.newContext({ baseURL: BACKEND_URL });
    try {
      await replay.addCookies([
        {
          name: 'rg_auth',
          value: token,
          domain: new URL(BACKEND_URL).hostname,
          path: '/api',
        },
      ]);

      const replayed = await replay.get('/api/auth/me');
      expect(replayed.status()).toBe(401);
    } finally {
      await replay.dispose();
    }

    const revokedAt = await readRevokedAt(user.id);
    expect(revokedAt).toBeInstanceOf(Date);
    expect(revokedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(account.password).toBe('Senha@123');
  });
});
