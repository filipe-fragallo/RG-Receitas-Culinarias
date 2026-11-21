import {
  assertDatabaseWriteAllowed,
  assertDestructiveDatabaseAction,
  assertTestDatabaseTarget,
  shouldRunMigrationsOnBootstrap,
  type DatabaseTarget,
} from './database-safety';

const testTarget = (overrides: Partial<DatabaseTarget> = {}): DatabaseTarget => ({
  host: '127.0.0.1',
  schema: 'teste_receitas_rg_sistemas_test',
  nodeEnv: 'test',
  ...overrides,
});

describe('database safety', () => {
  describe('test setup', () => {
    it('accepts only schemas with a _test or _e2e suffix', () => {
      expect(() => assertTestDatabaseTarget(testTarget())).not.toThrow();
      expect(() =>
        assertTestDatabaseTarget(testTarget({ schema: 'teste_receitas_rg_sistemas_e2e' })),
      ).not.toThrow();
      expect(() => assertTestDatabaseTarget(testTarget({ schema: 'outro_schema_test' }))).toThrow(
        /prefixo/,
      );
    });

    it.each([
      ['production schema', { schema: 'teste_receitas_rg_sistemas' }],
      ['empty schema', { schema: '' }],
      ['no test suffix', { schema: 'teste_receitas_rg_sistemas_dev' }],
      ['invalid characters', { schema: 'teste;DROP_DATABASE_test' }],
      ['incorrect node_env', { nodeEnv: 'development' }],
      ['production', { nodeEnv: 'production' }],
    ])('rejeita %s antes de qualquer DROP', (_description, overrides) => {
      expect(() => assertTestDatabaseTarget(testTarget(overrides))).toThrow();
    });

    it('rejects a remote host without explicit authorization', () => {
      expect(() => assertTestDatabaseTarget(testTarget({ host: 'db.exemplo.com' }))).toThrow(
        /host remoto/,
      );
    });

    it('accepts a remote host only when explicitly allowlisted', () => {
      const authorized = testTarget({
        host: 'db.teste.exemplo.com',
        allowRemote: true,
        allowedRemoteHost: 'db.teste.exemplo.com',
      });

      expect(() => assertTestDatabaseTarget(authorized)).not.toThrow();
      expect(() =>
        assertTestDatabaseTarget({ ...authorized, allowedRemoteHost: undefined }),
      ).toThrow(/TEST_DB_ALLOWED_HOST/);
      expect(() =>
        assertTestDatabaseTarget({ ...authorized, allowedRemoteHost: 'outro.host' }),
      ).toThrow(/não confere/);
    });
  });

  describe('destructive commands', () => {
    it('requires explicit confirmation', () => {
      expect(() => assertDestructiveDatabaseAction(testTarget(), undefined)).toThrow(/--yes/);
      expect(() => assertDestructiveDatabaseAction(testTarget(), 'sim')).toThrow(/--yes/);
      expect(() => assertDestructiveDatabaseAction(testTarget(), '--yes')).not.toThrow();
    });

    it('never allows destruction in production', () => {
      expect(() =>
        assertDestructiveDatabaseAction(
          testTarget({ nodeEnv: 'production', allowProductionMigrations: true }),
          '--yes',
        ),
      ).toThrow(/produção/);
    });

    it('never allows destruction on a remote host', () => {
      expect(() =>
        assertDestructiveDatabaseAction(
          testTarget({ host: 'db.exemplo.com', allowRemote: true }),
          '--yes',
        ),
      ).toThrow(/não é local/);
    });

    it('rejects schemas outside the project', () => {
      expect(() =>
        assertDestructiveDatabaseAction(
          testTarget({ schema: 'teste_receitas_rg_sistemas' }),
          '--yes',
        ),
      ).not.toThrow();
      expect(() =>
        assertDestructiveDatabaseAction(
          testTarget({ schema: 'teste_receitas_rg_sistemas_e2e' }),
          '--yes',
        ),
      ).not.toThrow();
      expect(() =>
        assertDestructiveDatabaseAction(
          testTarget({ schema: 'teste_receitas_rg_sistemas_dev' }),
          '--yes',
        ),
      ).not.toThrow();
      expect(() =>
        assertDestructiveDatabaseAction(testTarget({ schema: 'producao' }), '--yes'),
      ).toThrow();
      expect(() => assertDestructiveDatabaseAction(testTarget({ schema: '' }), '--yes')).toThrow();
    });
  });

  describe('non-destructive writes', () => {
    it('requires explicit authorization in production', () => {
      const production = testTarget({
        nodeEnv: 'production',
        schema: 'teste_receitas_rg_sistemas',
      });

      expect(() => assertDatabaseWriteAllowed(production)).toThrow(
        /DB_ALLOW_PRODUCTION_MIGRATIONS/,
      );
      expect(() =>
        assertDatabaseWriteAllowed({ ...production, allowProductionMigrations: true }),
      ).not.toThrow();
    });

    it('blocks unknown schemas', () => {
      expect(() => assertDatabaseWriteAllowed(testTarget({ schema: 'outro_banco' }))).toThrow();
    });
  });

  describe('bootstrap', () => {
    it('applies migrations automatically only in local development', () => {
      expect(shouldRunMigrationsOnBootstrap(testTarget({ nodeEnv: 'development' }))).toBe(true);
      expect(
        shouldRunMigrationsOnBootstrap(
          testTarget({ nodeEnv: 'development', schema: 'teste_receitas_rg_sistemas' }),
        ),
      ).toBe(true);
      expect(shouldRunMigrationsOnBootstrap(testTarget({ nodeEnv: 'production' }))).toBe(false);
      expect(shouldRunMigrationsOnBootstrap(testTarget({ migrationsAuto: false }))).toBe(false);
    });

    it('does not apply automatic migrations to an unknown schema', () => {
      expect(shouldRunMigrationsOnBootstrap(testTarget({ schema: 'outro_banco' }))).toBe(false);
      expect(shouldRunMigrationsOnBootstrap(testTarget({ schema: 'producao' }))).toBe(false);
      expect(shouldRunMigrationsOnBootstrap(testTarget({ schema: '' }))).toBe(false);
    });

    it('does not run automatically on a remote host without opt-in', () => {
      const remote = testTarget({ host: 'db.exemplo.com', nodeEnv: 'development' });

      expect(shouldRunMigrationsOnBootstrap(remote)).toBe(false);
      expect(
        shouldRunMigrationsOnBootstrap({
          ...remote,
          allowRemote: true,
          allowedRemoteHost: 'db.exemplo.com',
        }),
      ).toBe(false);
      expect(
        shouldRunMigrationsOnBootstrap({ ...remote, migrationsAuto: true, allowRemote: true }),
      ).toBe(false);
      expect(
        shouldRunMigrationsOnBootstrap({
          ...remote,
          migrationsAuto: true,
          allowRemote: true,
          allowedRemoteHost: 'db.exemplo.com',
        }),
      ).toBe(true);
      expect(
        shouldRunMigrationsOnBootstrap({
          ...remote,
          migrationsAuto: true,
          allowRemote: true,
          allowedRemoteHost: 'outro.host',
        }),
      ).toBe(false);
    });
  });
});
