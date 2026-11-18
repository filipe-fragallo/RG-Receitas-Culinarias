import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = '../docs/screenshots';
const login = 'demo.avaliador';
const password = 'Demo@12345';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'pt-BR',
});
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${OUT}/01-login.png` });

// Tenta entrar; se o usuário ainda não existir, cria a conta.
await page.getByLabel('Login').fill(login);
await page.getByLabel('Senha', { exact: true }).fill(password);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForTimeout(800);

if (page.url().includes('/login')) {
  await page.goto(`${BASE}/cadastro`);
  await page.getByLabel('Nome').fill('Avaliador Demo');
  await page.getByLabel('Login').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha').fill(password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.waitForURL(`${BASE}/`);
}

const recipes = [
  {
    nome: 'Bolo de cenoura da vó',
    categoria: 'Bolos e tortas doces',
    tempo: '50',
    porcoes: '10',
    ingredientes:
      '3 cenouras médias\n3 ovos\n1 xícara de óleo\n2 xícaras de açúcar\n2 xícaras de farinha de trigo\n1 colher de sopa de fermento',
    preparo:
      'Bata as cenouras, os ovos e o óleo no liquidificador até ficar homogêneo.\nMisture o açúcar, a farinha e o fermento em uma tigela.\nIncorpore a mistura líquida e mexa bem.\nAsse em forno preaquecido a 180 °C por cerca de 40 minutos.\nCubra com chocolate derretido ainda quente.',
  },
  {
    nome: 'Sopa cremosa de abóbora',
    categoria: 'Sopas',
    tempo: '35',
    porcoes: '4',
    ingredientes:
      '1 kg de abóbora cabotiá\n1 cebola\n2 dentes de alho\n1 litro de caldo de legumes\n200 ml de creme de leite\nSal e pimenta a gosto',
    preparo:
      'Refogue a cebola e o alho até dourarem.\nJunte a abóbora picada e o caldo de legumes.\nCozinhe por 20 minutos, até a abóbora desmanchar.\nBata no liquidificador e volte à panela.\nFinalize com o creme de leite e tempere.',
  },
  {
    nome: 'Salada de grão-de-bico',
    categoria: 'Saladas, molhos e acompanhamentos',
    tempo: '20',
    porcoes: '3',
    ingredientes:
      '2 xícaras de grão-de-bico cozido\n1 tomate\n1 pepino\nMeia cebola roxa\nSalsinha e hortelã\nAzeite, limão e sal',
    preparo:
      'Escorra e enxágue o grão-de-bico.\nCorte o tomate, o pepino e a cebola em cubos pequenos.\nMisture tudo com a salsinha e a hortelã.\nTempere com azeite, limão e sal antes de servir.',
  },
];

for (const recipe of recipes) {
  const existing = page.getByRole('link', { name: `Ver detalhes da receita ${recipe.nome}` });
  if (await existing.count()) continue;

  await page.getByRole('link', { name: 'Nova receita' }).first().click();
  await page.getByLabel('Nome da receita').fill(recipe.nome);
  await page.getByLabel('Categoria').selectOption({ label: recipe.categoria });
  await page.getByLabel('Tempo de preparo').fill(recipe.tempo);
  await page.getByLabel('Porções').fill(recipe.porcoes);
  await page.getByLabel('O que vai na receita').fill(recipe.ingredientes);
  await page.getByLabel('Como preparar').fill(recipe.preparo);
  await page.getByRole('button', { name: 'Criar receita' }).click();
  await page.waitForURL(/\/receitas\/\d+$/);
}

await page.goto(`${BASE}/`);
await page.waitForSelector('article');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-lista-receitas.png`, fullPage: true });

await page.getByRole('link', { name: 'Ver detalhes da receita Bolo de cenoura da vó' }).click();
await page.waitForSelector('h1');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-detalhe-receita.png`, fullPage: true });

await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: `${OUT}/04-impressao-a4.png`, fullPage: true });
await page.emulateMedia({ media: 'screen' });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`);
await page.waitForSelector('article');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-mobile.png`, fullPage: true });

await browser.close();
console.log('Screenshots salvos em', OUT);
