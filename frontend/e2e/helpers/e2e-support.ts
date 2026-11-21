import { expect, type APIResponse, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { assertLocalE2eDatabase } from '../../src/test/playwright-database-guard';

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3010';
const JWT_SECRET =
  process.env.E2E_JWT_SECRET ??
  process.env.JWT_SECRET ??
  'playwright-only-secret-with-at-least-32-characters';

export interface Account {
  name: string;
  login: string;
  password: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface RecipeSeed {
  name: string;
  categoryId: number;
  ingredients?: string;
  instructions?: string;
  preparationTimeMinutes?: number;
  servings?: number;
}

export function uniqueToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueAccount(): Account {
  const token = uniqueToken();
  return {
    name: `Usuário ${token}`,
    login: `e2e.${token}`,
    password: 'Senha@123',
  };
}

export async function registerAccount(page: Page, account = uniqueAccount()): Promise<Account> {
  await page.goto('/register');
  await page.getByLabel('Nome').fill(account.name);
  await page.getByLabel('Login').fill(account.login);
  await page.getByLabel('Senha', { exact: true }).fill(account.password);
  await page.getByLabel('Confirmar senha').fill(account.password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Minhas receitas' })).toBeVisible();
  return account;
}

export async function loginAccount(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Login').fill(account.login);
  await page.getByLabel('Senha', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Minhas receitas' })).toBeVisible();
}

export async function logoutAccount(page: Page): Promise<void> {
  await page.locator('aside').getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL('/login');
}

export async function apiFetch(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  resource: string,
  options: { body?: unknown; token?: string } = {},
): Promise<APIResponse> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['X-CSRF-Token'] = options.token;

  return page.request.fetch(`${BACKEND_URL}${resource}`, {
    method,
    headers,
    data: options.body,
  });
}

export async function getCsrfToken(page: Page): Promise<string> {
  const response = await apiFetch(page, 'GET', '/api/auth/csrf');
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { csrfToken?: unknown };
  expect(typeof body.csrfToken).toBe('string');
  return body.csrfToken as string;
}

export async function listCategories(page: Page): Promise<Category[]> {
  const response = await apiFetch(page, 'GET', '/api/categories');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Category[];
}

export async function createRecipe(page: Page, seed: RecipeSeed): Promise<number> {
  const response = await apiFetch(page, 'POST', '/api/recipes', {
    token: await getCsrfToken(page),
    body: {
      name: seed.name,
      categoryId: seed.categoryId,
      preparationTimeMinutes: seed.preparationTimeMinutes ?? 30,
      servings: seed.servings ?? 4,
      ingredients: seed.ingredients ?? '1 ingrediente de teste\n2 ingredientes de teste',
      instructions: seed.instructions ?? 'Primeiro passo do teste.\nSegundo passo do teste.',
    },
  });

  expect(response.status()).toBe(201);
  const created = (await response.json()) as { id: number };
  return created.id;
}

export async function readAuthenticatedUser(page: Page): Promise<{ id: number; login: string }> {
  const response = await apiFetch(page, 'GET', '/api/auth/me');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { user: { id: number; login: string } };
  return body.user;
}

export async function authCookieValue(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const auth = cookies.find((cookie) => cookie.name === 'rg_auth');
  expect(auth).toBeDefined();
  return auth!.value;
}

/** Sobe uma API temporária com configuração própria, sem reaproveitar a do webServer. */
export async function startTemporaryBackend(
  port: number,
  overrides: Record<string, string> = {},
): Promise<ChildProcess> {
  const database = assertLocalE2eDatabase(process.env);
  const backendDirectory = path.resolve(process.cwd(), '../backend');
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    DB_HOST: database.host,
    DB_PORT: database.port,
    DB_USER: database.user,
    DB_PASSWORD: database.password,
    DB_NAME: database.schema,
    DB_MIGRATIONS_AUTO: 'false',
    DB_ALLOW_REMOTE: 'false',
    DB_ALLOW_PRODUCTION_MIGRATIONS: 'false',
    JWT_SECRET,
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
    CORS_ORIGIN: process.env.E2E_FRONTEND_URL ?? 'http://localhost:5173',
    ...overrides,
  };

  await waitForPortFree(port);

  const child = spawn('npm', ['run', 'start'], {
    cwd: backendDirectory,
    env: environment,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  try {
    await waitForBackend(`http://127.0.0.1:${port}`, child, () => output);
  } catch (error) {
    await stopBackend(child);
    throw error;
  }

  return child;
}

export async function stopBackend(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return;

  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      return;
    }
  }

  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
    await Promise.race([exited, delay(2_000)]);
  }
}

export async function waitForBackend(
  baseUrl: string,
  child?: ChildProcess,
  output?: () => string,
): Promise<void> {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`API temporária encerrou antes de ficar pronta: ${output?.() ?? ''}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`API temporária em ${baseUrl} não respondeu no prazo: ${output?.() ?? ''}`);
}

async function waitForPortFree(port: number): Promise<void> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(500),
      });
      await delay(200);
    } catch {
      return;
    }
  }

  throw new Error(`A porta ${port} continuou ocupada antes de iniciar a API temporária.`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Confere o campo persistido pela revogação, sem expor a API a detalhes de banco. */
export async function readRevokedAt(userId: number): Promise<Date | null> {
  const database = assertLocalE2eDatabase(process.env);
  const require = createRequire(path.join(process.cwd(), 'e2e-support.cjs'));
  const mysql = require(path.resolve(process.cwd(), '../backend/node_modules/mysql2/promise')) as {
    createConnection(config: Record<string, unknown>): Promise<{
      execute(sql: string, values: unknown[]): Promise<[Array<Record<string, unknown>>, unknown]>;
      end(): Promise<void>;
    }>;
  };

  const connection = await mysql.createConnection({
    host: database.host,
    port: Number(database.port),
    user: database.user,
    password: database.password,
    database: database.schema,
    timezone: '+00:00',
  });

  try {
    const [rows] = await connection.execute(
      'SELECT revoked_at FROM auth_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [userId],
    );
    const value = rows[0]?.['revoked_at'];
    return value instanceof Date ? value : value ? new Date(String(value)) : null;
  } finally {
    await connection.end();
  }
}
