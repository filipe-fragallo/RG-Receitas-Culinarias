/**
 * Defaults usados apenas em testes. Variáveis já definidas no ambiente têm
 * prioridade, permitindo apontar para outro MySQL sem alterar o código.
 */
export function applyTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST ??= '127.0.0.1';
  process.env.DB_PORT ??= '3306';
  process.env.DB_USER ??= 'root';
  process.env.DB_PASSWORD ??= 'root';
  process.env.DB_NAME ??= 'teste_receitas_rg_sistemas_test';
  process.env.JWT_SECRET ??= 'test-only-secret-with-at-least-32-characters-long';
  process.env.JWT_EXPIRES_IN_SECONDS ??= '3600';
  process.env.CORS_ORIGIN ??= 'http://localhost:5173';
}
