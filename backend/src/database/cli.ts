import 'dotenv/config';

import { Sequelize } from 'sequelize';

import {
  assertDatabaseWriteAllowed,
  assertDestructiveDatabaseAction,
  type DatabaseTarget,
} from './database-safety';
import { buildDatabaseStatus } from './database-status';
import {
  MIGRATIONS,
  SEEDERS,
  baselineSchema,
  createMigrator,
  createSeeder,
  runMigrations,
  runMigrationsAndSeeders,
  runSeeders,
  withMigrationLock,
} from './migrator';

export type CliAction = 'up' | 'down' | 'seed' | 'reset' | 'status' | 'baseline';

const ACTIONS: CliAction[] = ['up', 'down', 'seed', 'reset', 'status', 'baseline'];
const DESTRUCTIVE_ACTIONS = new Set<CliAction>(['down', 'reset']);

function readTarget(): DatabaseTarget {
  return {
    host: process.env.DB_HOST,
    schema: process.env.DB_NAME,
    nodeEnv: process.env.NODE_ENV,
    allowRemote: process.env.DB_ALLOW_REMOTE === 'true',
    allowedRemoteHost: process.env.DB_ALLOWED_HOST,
    allowProductionMigrations: process.env.DB_ALLOW_PRODUCTION_MIGRATIONS === 'true',
  };
}

export function buildSequelizeFromEnv(): Sequelize {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME'] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variável ${key} não definida. Copie .env.example para .env.`);
    }
  }

  return new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    logging: false,
    timezone: '+00:00',
    dialectOptions: { charset: 'utf8mb4' },
  });
}

export function assertCliSafety(action: CliAction, args: string[] = []): void {
  const target = readTarget();
  const confirmation = args.find((arg) => arg.startsWith('--'));

  if (DESTRUCTIVE_ACTIONS.has(action)) {
    assertDestructiveDatabaseAction(target, confirmation);
    return;
  }

  if (action === 'baseline' && confirmation !== '--yes') {
    throw new Error(
      'Operação de baseline recusada: confirme explicitamente com --yes. ' +
        'Exemplo: npm run db:baseline -- --yes',
    );
  }

  if (action !== 'status') {
    assertDatabaseWriteAllowed(target);
  }
}

/**
 * Executa a ação sobre um Sequelize já construído. Mantido separado do
 * `main()` para que os testes de integração exercitem exatamente o mesmo
 * caminho da CLI, sem substituir variáveis de ambiente globais.
 */
export async function executeDatabaseAction(
  action: CliAction,
  sequelize: Sequelize,
): Promise<string[]> {
  switch (action) {
    case 'up': {
      const executed = await runMigrationsAndSeeders(sequelize);
      return [
        `Migrations aplicadas: ${executed.migrations.length}`,
        `Seeders aplicados: ${executed.seeders.length}`,
      ];
    }
    case 'down': {
      await withMigrationLock(sequelize, async () => {
        await createSeeder(sequelize).down({ to: 0 });
        await createMigrator(sequelize).down({ to: 0 });
      });
      return ['Migrations e seeders revertidos.'];
    }
    case 'seed': {
      const applied = await withMigrationLock(sequelize, () => runSeeders(sequelize));
      return [`Seeders aplicados: ${applied.length}`];
    }
    case 'reset': {
      // Não chamar runMigrationsAndSeeders aqui: ele já possui lock próprio.
      await withMigrationLock(sequelize, async () => {
        await createSeeder(sequelize).down({ to: 0 });
        await createMigrator(sequelize).down({ to: 0 });
        await runMigrations(sequelize);
        await runSeeders(sequelize);
      });
      return ['Banco recriado com migrations e seeders.'];
    }
    case 'baseline': {
      const recorded = await withMigrationLock(sequelize, () => baselineSchema(sequelize));
      return [
        `Migrations reconhecidas no histórico: ${recorded.length}`,
        ...recorded.map((name) => `  - ${name}`),
      ];
    }
    case 'status': {
      const status = await buildDatabaseStatus(sequelize);
      return status.lines;
    }
  }
}

export function isValidAction(rawAction: string): rawAction is CliAction {
  return ACTIONS.includes(rawAction as CliAction);
}

export function actionUsage(): string {
  return `Ação inválida. Use ${ACTIONS.join(', ')}.`;
}

export const KNOWN_MIGRATIONS = MIGRATIONS.map((migration) => migration.name);
export const KNOWN_SEEDERS = SEEDERS.map((seeder) => seeder.name);

async function main(): Promise<void> {
  const rawAction = process.argv[2] ?? 'status';
  const args = process.argv.slice(3);

  if (!isValidAction(rawAction)) {
    throw new Error(actionUsage());
  }

  // As barreiras são avaliadas antes de abrir a conexão.
  assertCliSafety(rawAction, args);

  const sequelize = buildSequelizeFromEnv();

  try {
    for (const line of await executeDatabaseAction(rawAction, sequelize)) {
      console.log(line);
    }
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
