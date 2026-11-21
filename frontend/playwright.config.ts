import { defineConfig, devices } from '@playwright/test';

import { assertLocalE2eDatabase } from './src/test/playwright-database-guard';

const externalBaseUrl = process.env.E2E_BASE_URL;
const frontendUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:5173';
const frontendPort = new URL(frontendUrl).port || '5173';
const baseURL = externalBaseUrl ?? frontendUrl;

// Porta separada do backend de desenvolvimento (3000) e do MySQL de
// desenvolvimento (3306). O teste nunca reaproveita um servidor já aberto.
const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:3010';
const backendPort = new URL(backendUrl).port || '3010';

// No modo Docker (E2E_BASE_URL definido) o Playwright não inicia nem altera
// banco: ele apenas exercita a stack já em execução.
const localDatabase = externalBaseUrl ? undefined : assertLocalE2eDatabase(process.env);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: 'npm run start:dev',
          cwd: '../backend',
          // Variáveis explícitas substituem qualquer DB_* do .env do backend.
          env: {
            PORT: backendPort,
            NODE_ENV: 'test',
            DB_HOST: localDatabase!.host,
            DB_PORT: localDatabase!.port,
            DB_USER: localDatabase!.user,
            DB_PASSWORD: localDatabase!.password,
            DB_NAME: localDatabase!.schema,
            DB_MIGRATIONS_AUTO: 'true',
            DB_ALLOW_REMOTE: 'false',
            DB_ALLOW_PRODUCTION_MIGRATIONS: 'false',
            // Os fluxos criam contas e sessões diferentes; o limite baixo de
            // produção é exercitado por uma API temporária no teste de 429.
            LOGIN_RATE_LIMIT_LIMIT: '100',
            REGISTER_RATE_LIMIT_LIMIT: '100',
            JWT_SECRET:
              process.env.E2E_JWT_SECRET ?? 'playwright-only-secret-with-at-least-32-characters',
            COOKIE_SECURE: 'false',
            COOKIE_SAME_SITE: 'lax',
            CORS_ORIGIN: new URL(frontendUrl).origin,
          },
          url: `${backendUrl}/api/health`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
          // VITE_API_URL do .env não deve desviar o navegador do proxy de teste.
          env: {
            VITE_API_URL: '/api',
            VITE_PROXY_TARGET: backendUrl,
          },
          url: frontendUrl,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
