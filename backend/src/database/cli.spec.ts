import { join } from 'node:path';

import {
  assertCliSafety,
  assertProductionSetupComplete,
  buildSequelizeFromEnv,
  buildSequelizeWithoutDatabase,
  checkDatabaseConnection,
  KNOWN_MIGRATIONS,
  KNOWN_SEEDERS,
} from './cli';
import { PRODUCTION_DB_HOST, PRODUCTION_DB_SCHEMA } from './database-safety';
import type { DatabaseStatus } from './database-status';

const ENV_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'NODE_ENV',
  'DB_ALLOW_REMOTE',
  'DB_ALLOWED_HOST',
  'DB_ALLOW_PRODUCTION_MIGRATIONS',
  'DB_SSL',
  'DB_SSL_CA_PATH',
] as const;

type SavedEnv = Record<(typeof ENV_KEYS)[number], string | undefined>;

const CA_PATH = join(__dirname, '../../test/fixtures/test-ca.pem');

describe('CLI de banco', () => {
  let saved: SavedEnv;

  beforeEach(() => {
    saved = {} as SavedEnv;
    for (const key of ENV_KEYS) saved[key] = process.env[key];

    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_USER = 'receitas';
    process.env.DB_PASSWORD = 'receitas_dev';
    process.env.DB_NAME = 'teste_receitas_rg_sistemas';
    process.env.NODE_ENV = 'development';
    delete process.env.DB_ALLOW_REMOTE;
    delete process.env.DB_ALLOWED_HOST;
    delete process.env.DB_ALLOW_PRODUCTION_MIGRATIONS;
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_CA_PATH;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('recusa baseline sem confirmação explícita', () => {
    expect(() => assertCliSafety('baseline')).toThrow(/--yes/);
    expect(() => assertCliSafety('baseline', ['sim'])).toThrow(/--yes/);
  });

  it('aceita baseline somente com --yes após as barreiras de ambiente', () => {
    expect(() => assertCliSafety('baseline', ['--yes'])).not.toThrow();

    process.env.NODE_ENV = 'production';
    expect(() => assertCliSafety('baseline', ['--yes'])).toThrow(/produção/);
  });

  it('permite a checagem somente leitura em host remoto sem autorização de escrita', () => {
    process.env.DB_HOST = 'gateway.tidbcloud.com';

    expect(() => assertCliSafety('check')).not.toThrow();
    expect(() => assertCliSafety('status')).not.toThrow();
    expect(() => assertCliSafety('up')).toThrow(/host remoto/);
    expect(() => assertCliSafety('seed')).toThrow(/host remoto/);
  });

  it('monta Sequelize local sem TLS por padrão', () => {
    const sequelize = buildSequelizeFromEnv();
    const dialectOptions = (sequelize.config as { dialectOptions?: { ssl?: unknown } })
      .dialectOptions;

    expect(dialectOptions).toEqual({ charset: 'utf8mb4' });
  });

  it('monta Sequelize remoto com TLS verificado a partir das variáveis de ambiente', () => {
    process.env.DB_HOST = 'gateway.tidbcloud.com';
    process.env.DB_PORT = '4000';
    process.env.DB_SSL = 'true';
    process.env.DB_SSL_CA_PATH = CA_PATH;

    const sequelize = buildSequelizeFromEnv();
    const config = sequelize.config as unknown as {
      dialectOptions: { ssl: Record<string, unknown> };
    };
    const ssl = config.dialectOptions.ssl;

    expect(ssl).toMatchObject({
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
    });
  });

  it('executa somente SELECT e SHOW STATUS na checagem de conexão', async () => {
    const query = jest
      .fn<Promise<unknown>, [string, unknown]>()
      .mockResolvedValueOnce([{ ok: 1, version: '8.0.11-TiDB-v8.5.0', db_name: 'teste' }])
      .mockResolvedValueOnce([{ Variable_name: 'Ssl_cipher', Value: 'TLS_AES_256_GCM_SHA384' }]);
    const sequelize = {
      config: {
        host: 'gateway.tidbcloud.com',
        dialectOptions: {
          ssl: {
            ca: 'PEM',
            rejectUnauthorized: true,
            verifyIdentity: true,
            minVersion: 'TLSv1.2',
          },
        },
      },
      query,
    } as never;

    const lines = await checkDatabaseConnection(sequelize);

    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT 1 AS ok, VERSION() AS version, DATABASE() AS db_name',
      expect.anything(),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SHOW SESSION STATUS LIKE 'Ssl_cipher'",
      expect.anything(),
    );
    expect(query.mock.calls.map((call) => call[0]).join(' ')).not.toMatch(
      /INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE/,
    );
    expect(lines.join('\n')).toContain('TLS: ativo (cipher=TLS_AES_256_GCM_SHA384)');
    expect(lines.join('\n')).not.toContain('receitas_dev');
  });

  it('falha se TLS foi solicitado mas a sessão não negociou cifra', async () => {
    const query = jest
      .fn<Promise<unknown>, [string, unknown]>()
      .mockResolvedValueOnce([{ ok: 1, version: '8.4.0', db_name: 'teste' }])
      .mockResolvedValueOnce([{ Variable_name: 'Ssl_cipher', Value: '' }]);
    const sequelize = {
      config: {
        host: 'gateway.tidbcloud.com',
        dialectOptions: {
          ssl: {
            ca: 'PEM',
            rejectUnauthorized: true,
            verifyIdentity: true,
            minVersion: 'TLSv1.2',
          },
        },
      },
      query,
    } as never;

    await expect(checkDatabaseConnection(sequelize)).rejects.toThrow(/não negociou TLS/);
  });

  it('monta a conexão administrativa sem selecionar schema', () => {
    const sequelize = buildSequelizeWithoutDatabase();

    expect((sequelize.config as { database?: string }).database).toBeUndefined();
  });

  it('só aceita setup de produção com confirmação e barreiras nominais', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_HOST = PRODUCTION_DB_HOST;
    process.env.DB_NAME = PRODUCTION_DB_SCHEMA;
    process.env.DB_SSL = 'true';
    process.env.DB_SSL_CA_PATH = CA_PATH;
    process.env.DB_ALLOW_REMOTE = 'true';
    process.env.DB_ALLOWED_HOST = PRODUCTION_DB_HOST;
    process.env.DB_ALLOW_PRODUCTION_MIGRATIONS = 'true';

    expect(() => assertCliSafety('setup-prod', ['--yes'])).not.toThrow();
    expect(() => assertCliSafety('setup-prod')).toThrow(/--yes/);
    expect(() => assertCliSafety('setup-prod', ['--yes', '--reset'])).toThrow(/não permitido/);

    process.env.DB_SSL = 'false';
    expect(() => assertCliSafety('setup-prod', ['--yes'])).toThrow(/DB_SSL=true/);
  });

  it('confere o resultado final do provisionamento sem aceitar dados divergentes', () => {
    const complete = {
      history: { migrations: [...KNOWN_MIGRATIONS], seeders: [...KNOWN_SEEDERS] },
      pendingMigrations: [],
      pendingSeeders: [],
      physical: [{ table: 'categorias', present: true, rowCount: 13 }],
      inconsistencies: [],
    } as unknown as DatabaseStatus;

    expect(() => assertProductionSetupComplete(complete)).not.toThrow();
    expect(() =>
      assertProductionSetupComplete({
        ...complete,
        physical: [{ ...complete.physical[0], rowCount: 12 }],
      }),
    ).toThrow(/13 categorias/);
    expect(() =>
      assertProductionSetupComplete({ ...complete, inconsistencies: ['divergência'] }),
    ).toThrow(/inconsistência/);
    expect(() =>
      assertProductionSetupComplete({ ...complete, pendingMigrations: ['001-create-usuarios'] }),
    ).toThrow(/pendentes/);
  });
});
