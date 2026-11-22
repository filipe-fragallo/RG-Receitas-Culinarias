import { createHash } from 'node:crypto';

import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import { QueryInterface, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { databaseSslOptionsFromSequelize } from '../config/database-ssl';
import * as createUsers from './migrations/001-create-usuarios';
import * as createCategories from './migrations/002-create-categorias';
import * as createRecipes from './migrations/003-create-receitas';
import * as createAuthSessions from './migrations/004-create-auth-sessions';
import { readHistory, pendingNames } from './schema-inspection';
import { assertSchemaReadyForSeeders, reconcileSchemaHistory } from './schema-reconciler';
import * as seedCategories from './seeders/001-categorias';

export interface MigrationEntry {
  name: string;
  up: (params: { context: QueryInterface }) => Promise<unknown>;
  down: (params: { context: QueryInterface }) => Promise<unknown>;
}

/** Ordem explícita das migrations; cada arquivo também é autoexecutável pelo runner. */
export const MIGRATIONS: MigrationEntry[] = [
  {
    name: '001-create-usuarios',
    up: createUsers.up,
    down: createUsers.down,
  },
  {
    name: '002-create-categorias',
    up: createCategories.up,
    down: createCategories.down,
  },
  {
    name: '003-create-receitas',
    up: createRecipes.up,
    down: createRecipes.down,
  },
  {
    name: '004-create-auth-sessions',
    up: createAuthSessions.up,
    down: createAuthSessions.down,
  },
];

export const SEEDERS: MigrationEntry[] = [
  {
    name: '001-categorias',
    up: seedCategories.up,
    down: seedCategories.down,
  },
];

export function createMigrator(sequelize: Sequelize): Umzug<QueryInterface> {
  return new Umzug<QueryInterface>({
    migrations: MIGRATIONS,
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize,
      modelName: 'SequelizeMeta',
      tableName: 'SequelizeMeta',
    }),
    logger: undefined,
  });
}

export function createSeeder(sequelize: Sequelize): Umzug<QueryInterface> {
  return new Umzug<QueryInterface>({
    migrations: SEEDERS,
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize,
      modelName: 'SequelizeData',
      tableName: 'SequelizeData',
    }),
    logger: undefined,
  });
}

/**
 * Executa migrations pendentes. Antes de delegar ao Umzug, reconcilia tabelas
 * físicas já existentes cuja estrutura foi comprovadamente comparada com as
 * migrations. Assim o mesmo caminho atende a um banco novo e a um banco criado
 * pelo SQL original do desafio.
 */
export async function runMigrations(sequelize: Sequelize): Promise<string[]> {
  await reconcileSchemaHistory(sequelize);
  const executed = await createMigrator(sequelize).up();
  return executed.map((migration) => migration.name);
}

/** Somente leitura: usado pelo bloqueio de seeders e pelo status. */
export async function readPendingMigrations(sequelize: Sequelize): Promise<string[]> {
  const history = await readHistory(sequelize);
  return pendingNames(
    history.migrations,
    MIGRATIONS.map((migration) => migration.name),
  );
}

export async function runSeeders(sequelize: Sequelize): Promise<string[]> {
  const pending = await readPendingMigrations(sequelize);

  if (pending.length) {
    throw new Error(
      'Não foi possível executar os seeders.\n\n' +
        `Existem migrations pendentes:\n${pending.map((name) => `- ${name}`).join('\n')}\n\n` +
        'Regularize o schema e execute npm run db:migrate.',
    );
  }

  await assertSchemaReadyForSeeders(sequelize);
  const executed = await createSeeder(sequelize).up();
  return executed.map((seeder) => seeder.name);
}

/** Baseline explícito: valida e registra o que já existe, sem criar tabelas. */
export async function baselineSchema(sequelize: Sequelize): Promise<string[]> {
  const result = await reconcileSchemaHistory(sequelize);
  return result.baselined;
}

interface LockRow extends RowDataPacket {
  acquired: number | string | null;
}

const LOCK_PREFIX = 'receitas_migrations_';

/**
 * Nomes de GET_LOCK são limitados a 64 caracteres pelo MySQL. O hash curto
 * mantém o nome determinístico por schema sem crescer com o nome do banco.
 */
export function migrationLockName(schema: string | undefined): string {
  const identifier = schema ?? 'unknown';
  return `${LOCK_PREFIX}${createHash('sha256').update(identifier).digest('hex').slice(0, 16)}`;
}

/**
 * Lock distribuído do MySQL. A conexão usada no GET_LOCK é dedicada e fica
 * aberta durante toda a execução, pois GET_LOCK é escopo de conexão.
 * Com isso, duas instâncias nunca aplicam migrations ao mesmo tempo.
 */
export async function withMigrationLock<T>(
  sequelize: Sequelize,
  task: () => Promise<T>,
): Promise<T> {
  const config = sequelize.config as {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  };
  const lockName = migrationLockName(config.database);
  // Reusa as opções TLS já validadas na conexão Sequelize. Isso garante que
  // GET_LOCK/RELEASE_LOCK usem exatamente a mesma CA e a mesma validação de
  // hostname da aplicação — nunca `rejectUnauthorized: false`.
  const ssl = databaseSslOptionsFromSequelize(sequelize);
  const connection: Connection = await createConnection({
    host: config.host ?? '127.0.0.1',
    port: config.port ?? 3306,
    user: config.username,
    password: config.password,
    database: config.database,
    ...(ssl ? { ssl } : {}),
  });

  try {
    const [rows] = await connection.query<LockRow[]>('SELECT GET_LOCK(?, 30) AS acquired', [
      lockName,
    ]);

    if (Number(rows[0]?.acquired) !== 1) {
      throw new Error(
        `Não foi possível obter o lock de migrations do schema "${config.database}". ` +
          'Outra instância pode estar aplicando migrations; tente novamente em instantes.',
      );
    }

    try {
      return await task();
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    await connection.end();
  }
}

export async function runMigrationsAndSeeders(
  sequelize: Sequelize,
): Promise<{ migrations: string[]; seeders: string[] }> {
  return withMigrationLock(sequelize, async () => {
    const migrations = await runMigrations(sequelize);
    const seeders = await runSeeders(sequelize);
    return { migrations, seeders };
  });
}
