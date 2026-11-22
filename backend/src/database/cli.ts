import 'dotenv/config';

import { QueryTypes, Sequelize } from 'sequelize';

import {
  buildDatabaseSslOptions,
  databaseSslOptionsFromSequelize,
  parseDatabaseSslFlag,
  readDatabaseSslSettings,
} from '../config/database-ssl';
import {
  assertDatabaseWriteAllowed,
  assertDestructiveDatabaseAction,
  assertProductionSetupTarget,
  PRODUCTION_DB_SCHEMA,
  type DatabaseTarget,
} from './database-safety';
import { buildDatabaseStatus, type DatabaseStatus } from './database-status';
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

export type CliAction =
  'up' | 'down' | 'seed' | 'reset' | 'status' | 'baseline' | 'check' | 'setup-prod';

const ACTIONS: CliAction[] = [
  'up',
  'down',
  'seed',
  'reset',
  'status',
  'baseline',
  'check',
  'setup-prod',
];
const DESTRUCTIVE_ACTIONS = new Set<CliAction>(['down', 'reset']);
/** Nenhuma dessas ações escreve ou exige autorização de host remoto. */
const READ_ONLY_ACTIONS = new Set<CliAction>(['status', 'check']);
const SETUP_PROD_ACTION: CliAction = 'setup-prod';
const EXPECTED_CATEGORY_COUNT = 13;

export const KNOWN_MIGRATIONS = MIGRATIONS.map((migration) => migration.name);
export const KNOWN_SEEDERS = SEEDERS.map((seeder) => seeder.name);

function readTarget(): DatabaseTarget {
  return {
    host: process.env.DB_HOST,
    schema: process.env.DB_NAME,
    nodeEnv: process.env.NODE_ENV,
    allowRemote: process.env.DB_ALLOW_REMOTE === 'true',
    allowedRemoteHost: process.env.DB_ALLOWED_HOST,
    allowProductionMigrations: process.env.DB_ALLOW_PRODUCTION_MIGRATIONS === 'true',
    sslEnabled: parseDatabaseSslFlag(process.env.DB_SSL),
  };
}

function requireEnv(keys: readonly string[]): void {
  for (const key of keys) {
    if (!process.env[key]) {
      throw new Error(`Variável ${key} não definida. Copie .env.example para .env.`);
    }
  }
}

function buildSequelize(database: string | undefined): Sequelize {
  const ssl = buildDatabaseSslOptions(readDatabaseSslSettings(process.env), process.env.DB_HOST);

  return new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database,
    logging: false,
    timezone: '+00:00',
    dialectOptions: {
      charset: 'utf8mb4',
      ...(ssl ? { ssl } : {}),
    },
  });
}

export function buildSequelizeFromEnv(): Sequelize {
  requireEnv(['DB_HOST', 'DB_USER', 'DB_NAME']);
  return buildSequelize(process.env.DB_NAME?.trim());
}

/** Conexão administrativa sem schema selecionado, usada apenas pelo setup. */
export function buildSequelizeWithoutDatabase(): Sequelize {
  requireEnv(['DB_HOST', 'DB_USER', 'DB_NAME']);
  return buildSequelize(undefined);
}

export function assertCliSafety(action: CliAction, args: string[] = []): void {
  const target = readTarget();
  const confirmation = args.find((arg) => arg.startsWith('--'));

  if (action === SETUP_PROD_ACTION) {
    const unexpected = args.filter((arg) => arg !== '--yes');
    if (unexpected.length) {
      throw new Error(
        `Setup de produção recusado: argumento não permitido "${unexpected[0]}". ` +
          'Use somente --yes.',
      );
    }
    assertProductionSetupTarget(target, confirmation);
    return;
  }

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

  if (!READ_ONLY_ACTIONS.has(action)) {
    assertDatabaseWriteAllowed(target);
  }
}

/**
 * Verificação de conexão estritamente somente leitura. As duas consultas são
 * constantes — não há interpolação de entrada do usuário — e nenhuma migration,
 * seeder, DDL ou DML é executado. Serve para validar TiDB Cloud antes de
 * autorizar qualquer escrita remota.
 */
export async function checkDatabaseConnection(sequelize: Sequelize): Promise<string[]> {
  const [info] = await sequelize.query<{
    ok: number;
    version: string;
    db_name: string | null;
  }>('SELECT 1 AS ok, VERSION() AS version, DATABASE() AS db_name', {
    type: QueryTypes.SELECT,
  });

  if (Number(info?.ok) !== 1) {
    throw new Error('A verificação de conexão não retornou o valor esperado (SELECT 1).');
  }

  const status = await sequelize.query<Record<string, unknown>>(
    "SHOW SESSION STATUS LIKE 'Ssl_cipher'",
    { type: QueryTypes.SELECT },
  );
  const cipher =
    status
      .map((entry) => entry['Value'] ?? entry['value'])
      .find((value): value is string => typeof value === 'string' && value.length > 0) ?? '';

  const tlsExpected = Boolean(databaseSslOptionsFromSequelize(sequelize));
  if (tlsExpected && !cipher) {
    throw new Error(
      'DB_SSL=true, mas a sessão não negociou TLS. Confira o gateway, a porta e a CA configurada.',
    );
  }

  const host = (sequelize.config as { host?: string }).host ?? '';
  return [
    `Conexão: OK (somente leitura; nenhuma migration ou seeder foi executado)`,
    `Host: ${host} (credenciais omitidas)`,
    `Schema: ${info.db_name ?? '(não selecionado)'}`,
    `Versão do servidor: ${info.version}`,
    `TLS: ${tlsExpected ? `ativo (cipher=${cipher})` : 'desativado (conexão local sem TLS)'}`,
  ];
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/** Confere o resultado do setup sem nunca emitir DROP/TRUNCATE/DELETE. */
export function assertProductionSetupComplete(status: DatabaseStatus): void {
  const problems: string[] = [];
  const knownMigrations = new Set(KNOWN_MIGRATIONS);
  const knownSeeders = new Set(KNOWN_SEEDERS);
  const recordedMigrations = status.history.migrations.filter((name) => knownMigrations.has(name));
  const recordedSeeders = status.history.seeders.filter((name) => knownSeeders.has(name));
  const categories = status.physical.find((comparison) => comparison.table === 'categorias');

  if (
    recordedMigrations.length !== MIGRATIONS.length ||
    status.history.migrations.length !== MIGRATIONS.length ||
    status.pendingMigrations.length > 0
  ) {
    problems.push(
      `esperadas ${MIGRATIONS.length} migrations, encontradas ` +
        `${status.history.migrations.length} (pendentes: ${status.pendingMigrations.length})`,
    );
  }

  if (
    recordedSeeders.length !== SEEDERS.length ||
    status.history.seeders.length !== SEEDERS.length ||
    status.pendingSeeders.length > 0
  ) {
    problems.push(
      `esperado ${SEEDERS.length} seeder, encontrados ` +
        `${status.history.seeders.length} (pendentes: ${status.pendingSeeders.length})`,
    );
  }

  if (!categories?.present || categories.rowCount !== EXPECTED_CATEGORY_COUNT) {
    problems.push(
      `esperadas ${EXPECTED_CATEGORY_COUNT} categorias, encontradas ${categories?.rowCount ?? 0}`,
    );
  }

  if (status.inconsistencies.length > 0) {
    problems.push(`${status.inconsistencies.length} inconsistência(s) no schema`);
  }

  if (problems.length) {
    throw new Error(`Provisionamento de produção incompleto:\n- ${problems.join('\n- ')}`);
  }
}

/**
 * Cria o schema se ele não existir e executa exatamente o mesmo runner Umzug
 * usado localmente. Nenhuma etapa é destrutiva: um schema existente é apenas
 * autorizado, e migrations/seeders já aplicados são preservados.
 */
export async function executeProductionSetup(adminSequelize: Sequelize): Promise<string[]> {
  const schema = process.env.DB_NAME?.trim();
  if (schema !== PRODUCTION_DB_SCHEMA) {
    throw new Error(`Setup de produção exige DB_NAME=${PRODUCTION_DB_SCHEMA}.`);
  }

  const [row] = await adminSequelize.query<{ schema_exists: number }>(
    'SELECT COUNT(*) AS schema_exists FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = :schema',
    { replacements: { schema }, type: QueryTypes.SELECT },
  );

  const lines: string[] = [];
  if (Number(row?.schema_exists) > 0) {
    lines.push(`Schema existente preservado: ${schema}`);
  } else {
    // Identificador já validado contra uma constante; ainda assim escaping é
    // aplicado para manter a construção segura por padrão.
    await adminSequelize.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(schema)} ` +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci',
    );
    lines.push(`Schema criado: ${schema}`);
  }

  const appSequelize = buildSequelizeFromEnv();
  try {
    const executed = await runMigrationsAndSeeders(appSequelize);
    lines.push(`Migrations aplicadas nesta execução: ${executed.migrations.length}`);
    lines.push(`Seeders aplicados nesta execução: ${executed.seeders.length}`);

    const status = await buildDatabaseStatus(appSequelize);
    assertProductionSetupComplete(status);
    lines.push(`Migrations registradas: ${status.history.migrations.length}`);
    lines.push(`Seeders registrados: ${status.history.seeders.length}`);
    lines.push(`Categorias: ${EXPECTED_CATEGORY_COUNT}`);
    lines.push(`Inconsistências: ${status.inconsistencies.length}`);
    return lines;
  } finally {
    await appSequelize.close();
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
    case 'check': {
      return checkDatabaseConnection(sequelize);
    }
    case 'setup-prod': {
      throw new Error('Use executeProductionSetup com uma conexão sem schema selecionado.');
    }
  }
}

export function isValidAction(rawAction: string): rawAction is CliAction {
  return ACTIONS.includes(rawAction as CliAction);
}

export function actionUsage(): string {
  return `Ação inválida. Use ${ACTIONS.join(', ')}.`;
}

async function main(): Promise<void> {
  const rawAction = process.argv[2] ?? 'status';
  const args = process.argv.slice(3);

  if (!isValidAction(rawAction)) {
    throw new Error(actionUsage());
  }

  // As barreiras são avaliadas antes de abrir a conexão.
  assertCliSafety(rawAction, args);

  if (rawAction === SETUP_PROD_ACTION) {
    const adminSequelize = buildSequelizeWithoutDatabase();
    try {
      for (const line of await executeProductionSetup(adminSequelize)) {
        console.log(line);
      }
    } finally {
      await adminSequelize.close();
    }
    return;
  }

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
