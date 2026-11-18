import { expect, test } from '@playwright/test';

test.describe('Fluxo principal de receitas', () => {
  test('cadastro, login, CRUD, pesquisa, impressão e logout', async ({ page }) => {
    const suffix = `${Date.now()}`;
    const login = `e2e.${suffix}`;
    const password = 'Senha@123';
    const recipeName = `Bolo de cenoura ${suffix}`;
    const updatedName = `Bolo de cenoura atualizado ${suffix}`;

    await page.goto('/cadastro');

    await page.getByLabel('Nome').fill('Usuário E2E');
    await page.getByLabel('Login').fill(login);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirmar senha').fill(password);
    await page.getByRole('button', { name: 'Criar minha conta' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Minhas receitas' })).toBeVisible();
    await expect(page.getByText('Seu caderno está em branco')).toBeVisible();

    // Criação
    await page.getByRole('link', { name: 'Criar primeira receita' }).click();
    await expect(page).toHaveURL('/receitas/nova');

    await page.getByLabel('Nome da receita').fill(recipeName);
    await page.getByLabel('Categoria').selectOption({ label: 'Bolos e tortas doces' });
    await page.getByLabel('Tempo de preparo').fill('45');
    await page.getByLabel('Porções').fill('8');
    await page
      .getByLabel('O que vai na receita')
      .fill('3 cenouras médias\n3 ovos\n2 xícaras de farinha de trigo');
    await page
      .getByLabel('Como preparar')
      .fill('Bata as cenouras e os ovos.\nMisture os secos e asse por 40 minutos.');
    await page.getByRole('button', { name: 'Criar receita' }).click();

    await expect(page).toHaveURL(/\/receitas\/\d+$/);
    await expect(page.getByRole('heading', { name: recipeName })).toBeVisible();
    await expect(page.getByText('3 cenouras médias').first()).toBeVisible();

    // Pesquisa
    await page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Minhas receitas' })
      .click();
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${recipeName}` }),
    ).toBeVisible();

    const search = page.getByLabel('Pesquisar');
    await search.fill('cenoura');
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${recipeName}` }),
    ).toBeVisible();
    await search.fill('receita que não existe');
    await expect(page.getByText('Nenhuma receita encontrada')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${recipeName}` }),
    ).toBeVisible();

    // Página fora do intervalo volta para uma página válida em vez de exibir
    // "caderno em branco" com receitas existentes.
    await page.goto('/?pagina=99');
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('link', { name: `Ver detalhes da receita ${recipeName}` }),
    ).toBeVisible();

    // Detalhes + edição
    await page.getByRole('link', { name: `Ver detalhes da receita ${recipeName}` }).click();
    await page.getByRole('link', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/receitas\/\d+\/editar$/);
    await page.getByLabel('Nome da receita').fill(updatedName);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();

    // Impressão: substitui o diálogo nativo para verificar o acionamento.
    await page.evaluate(() => {
      (window as Window & { __printCalled?: boolean }).__printCalled = false;
      window.print = () => {
        (window as Window & { __printCalled?: boolean }).__printCalled = true;
      };
    });
    await page.getByRole('button', { name: 'Imprimir' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __printCalled?: boolean }).__printCalled),
      )
      .toBe(true);

    // Exclusão
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Excluir receita' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Seu caderno está em branco')).toBeVisible();

    // Logout e proteção da rota privada
    await page.locator('aside').getByRole('button', { name: 'Sair da conta' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
