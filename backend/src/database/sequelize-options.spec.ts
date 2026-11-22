import { buildDatabaseSslOptions, type DatabaseSslOptions } from '../config/database-ssl';
import { buildSequelizeOptions } from './sequelize-options';

const CA_PATH = `${__dirname}/../../test/fixtures/test-ca.pem`;

const connection = {
  host: '127.0.0.1',
  port: 3306,
  username: 'receitas',
  password: 'receitas_dev',
  database: 'teste_receitas_rg_sistemas',
};

describe('buildSequelizeOptions', () => {
  it('mantém dialectOptions sem ssl para o MySQL local', () => {
    const options = buildSequelizeOptions(connection);

    expect(options.dialectOptions).toEqual({ charset: 'utf8mb4' });
    expect(JSON.stringify(options)).not.toContain('rejectUnauthorized');
  });

  it('propaga opções TLS validadas para o mysql2', () => {
    const ssl = buildDatabaseSslOptions(
      { enabled: true, caPath: CA_PATH },
      'gateway.tidbcloud.com',
    ) as DatabaseSslOptions;
    const options = buildSequelizeOptions({ ...connection, host: 'gateway.tidbcloud.com', ssl });

    expect(options.dialectOptions).toMatchObject({
      charset: 'utf8mb4',
      ssl: {
        rejectUnauthorized: true,
        verifyIdentity: true,
        minVersion: 'TLSv1.2',
      },
    });
  });

  it('usa um pool menor quando configurado para Functions', () => {
    const options = buildSequelizeOptions({
      ...connection,
      pool: { max: 1, min: 0, acquire: 10_000, idle: 5_000 },
    });

    expect(options.pool).toEqual({ max: 1, min: 0, acquire: 10_000, idle: 5_000 });
  });

  it('nunca envia uma opção ssl que desligue a verificação', () => {
    const local = buildSequelizeOptions(connection);
    expect(local.dialectOptions).not.toHaveProperty('ssl');

    const sslOptions = { ca: 'PEM', rejectUnauthorized: false, verifyIdentity: false };
    expect(() =>
      buildSequelizeOptions({ ...connection, host: 'gateway', ssl: sslOptions } as never),
    ).toThrow(/rejectUnauthorized e verifyIdentity precisam ser true/);
  });
});
