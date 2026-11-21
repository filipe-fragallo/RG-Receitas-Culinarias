import { describe, expect, it } from 'vitest';

import { assertLocalE2eDatabase } from './playwright-database-guard';

describe('Playwright E2E database guard', () => {
  it('accepts only local MySQL on a disposable port and a test schema', () => {
    expect(assertLocalE2eDatabase({})).toEqual({
      host: '127.0.0.1',
      port: '3310',
      user: 'root',
      password: 'root',
      schema: 'teste_receitas_rg_sistemas_playwright',
    });
  });

  it('rejects a remote host', () => {
    expect(() => assertLocalE2eDatabase({ E2E_DB_HOST: 'db.exemplo.com' })).toThrow(/não é local/);
  });

  it('rejects the development MySQL port', () => {
    expect(() => assertLocalE2eDatabase({ E2E_DB_PORT: '3306' })).toThrow(
      /MySQL de desenvolvimento/,
    );
  });

  it('rejects an invalid port', () => {
    expect(() => assertLocalE2eDatabase({ E2E_DB_PORT: 'abc' })).toThrow(/não é uma porta válida/);
    expect(() => assertLocalE2eDatabase({ E2E_DB_PORT: '70000' })).toThrow(
      /não é uma porta válida/,
    );
  });

  it('rejects a schema that is not test-only', () => {
    expect(() => assertLocalE2eDatabase({ E2E_DB_NAME: 'teste_receitas_rg_sistemas' })).toThrow(
      /não é exclusivo de teste/,
    );
    expect(() => assertLocalE2eDatabase({ E2E_DB_NAME: 'outro_banco' })).toThrow(
      /não é exclusivo de teste/,
    );
  });

  it('rejects an empty user', () => {
    expect(() => assertLocalE2eDatabase({ E2E_DB_USER: '   ' })).toThrow(/não pode ser vazio/);
  });
});
