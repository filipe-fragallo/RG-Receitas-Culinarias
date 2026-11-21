const mockCreateConnection = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('mysql2/promise', () => ({
  createConnection: (...args: unknown[]): Promise<unknown> => mockCreateConnection(...args),
}));

import { migrationLockName, withMigrationLock } from './migrator';

interface FakeConnection {
  query: jest.Mock;
  end: jest.Mock;
}

function connectionReturning(acquired: number): FakeConnection {
  return {
    query: jest.fn().mockResolvedValue([[{ acquired }]]),
    end: jest.fn().mockResolvedValue(undefined),
  };
}

function sequelizeFor(schema: string): never {
  return {
    config: {
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      password: 'root',
      database: schema,
    },
  } as never;
}

describe('migration lock name', () => {
  beforeEach(() => {
    mockCreateConnection.mockReset();
  });

  it('is short, deterministic and derived from the schema', () => {
    const short = migrationLockName('teste_receitas_rg_sistemas_test');
    const long = migrationLockName(`teste_receitas_rg_sistemas_${'a'.repeat(200)}_e2e`);

    expect(short).toMatch(/^receitas_migrations_[a-f0-9]{16}$/);
    expect(short.length).toBeLessThanOrEqual(64);
    expect(long.length).toBeLessThanOrEqual(64);
    expect(migrationLockName('teste_receitas_rg_sistemas_test')).toBe(short);
    expect(short).not.toBe(long);
    expect(migrationLockName(undefined)).toBe(migrationLockName('unknown'));
  });

  it('uses the derived name for GET_LOCK and RELEASE_LOCK', async () => {
    const connection = connectionReturning(1);
    mockCreateConnection.mockResolvedValue(connection);
    const schema = 'teste_receitas_rg_sistemas_test';
    const task = jest.fn().mockResolvedValue('ok');

    await expect(withMigrationLock(sequelizeFor(schema), task)).resolves.toBe('ok');

    const expectedName = migrationLockName(schema);
    expect(connection.query).toHaveBeenNthCalledWith(1, 'SELECT GET_LOCK(?, 30) AS acquired', [
      expectedName,
    ]);
    expect(connection.query).toHaveBeenNthCalledWith(2, 'SELECT RELEASE_LOCK(?)', [expectedName]);
    expect(task).toHaveBeenCalledTimes(1);
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when the task fails on a very long schema', async () => {
    const connection = connectionReturning(1);
    mockCreateConnection.mockResolvedValue(connection);
    const schema = `teste_receitas_rg_sistemas_${'b'.repeat(200)}_e2e`;

    await expect(
      withMigrationLock(sequelizeFor(schema), () => Promise.reject(new Error('migration falhou'))),
    ).rejects.toThrow('migration falhou');

    expect(connection.query).toHaveBeenNthCalledWith(2, 'SELECT RELEASE_LOCK(?)', [
      migrationLockName(schema),
    ]);
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it('does not run the task when the lock cannot be acquired', async () => {
    const connection = connectionReturning(0);
    mockCreateConnection.mockResolvedValue(connection);
    const task = jest.fn();

    await expect(withMigrationLock(sequelizeFor('curto'), task)).rejects.toThrow(
      /Não foi possível obter o lock/,
    );

    expect(task).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledTimes(1);
  });
});
