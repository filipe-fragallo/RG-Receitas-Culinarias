export const DEFAULT_E2E_SCHEMA = 'teste_receitas_rg_sistemas_playwright';

export const E2E_SCHEMA_PATTERN =
  /^teste_receitas_rg_sistemas(?:_[a-z0-9]+)*_(playwright|e2e|test)$/i;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);

export interface LocalE2eDatabase {
  host: string;
  port: string;
  user: string;
  password: string;
  schema: string;
}

/**
 * Barreira executada no carregamento da configuração, antes de qualquer
 * webServer. O E2E local só roda em MySQL loopback descartável e em schema
 * exclusivo de teste; nunca no banco de desenvolvimento.
 */
export function assertLocalE2eDatabase(env: Record<string, string | undefined>): LocalE2eDatabase {
  const host = (env.E2E_DB_HOST ?? '127.0.0.1').trim();
  const port = (env.E2E_DB_PORT ?? '3310').trim();
  const schema = (env.E2E_DB_NAME ?? DEFAULT_E2E_SCHEMA).trim();
  const user = (env.E2E_DB_USER ?? 'root').trim();
  const password = env.E2E_DB_PASSWORD ?? 'root';

  if (!LOOPBACK_HOSTS.has(host.toLowerCase())) {
    throw new Error(
      `Playwright E2E recusado: host MySQL "${host}" não é local. ` +
        'Use uma instância descartável em 127.0.0.1.',
    );
  }

  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535) {
    throw new Error(`Playwright E2E recusado: E2E_DB_PORT "${port}" não é uma porta válida.`);
  }

  if (port === '3306') {
    throw new Error(
      'Playwright E2E recusado: a porta 3306 é o MySQL de desenvolvimento. ' +
        'Suba uma instância descartável em outra porta (padrão: 3310) e defina E2E_DB_PORT.',
    );
  }

  if (!E2E_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Playwright E2E recusado: schema "${schema}" não é exclusivo de teste. ` +
        `Use ${DEFAULT_E2E_SCHEMA} ou outro nome com prefixo teste_receitas_rg_sistemas e sufixo _playwright/_e2e/_test.`,
    );
  }

  if (!user) {
    throw new Error('Playwright E2E recusado: E2E_DB_USER não pode ser vazio.');
  }

  return { host, port, user, password, schema };
}
