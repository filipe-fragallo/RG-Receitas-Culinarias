import { createConnection } from 'mysql2/promise';
import { Sequelize } from 'sequelize';

import { assertTestDatabaseTarget } from '../../src/database/database-safety';
import { runMigrationsAndSeeders } from '../../src/database/migrator';
import { applyTestEnvironment } from './test-environment';

/**
 * Recria o banco de teste e aplica as MESMAS migrations e seeders usados pela
 * aplicação. Assim os testes exercitam constraints, índices e as 13 categorias.
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnvironment();

  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? 'root';
  const schema = process.env.DB_NAME ?? 'teste_receitas_rg_sistemas_test';

  // Todas as barreiras são avaliadas antes de abrir a conexão administrativa,
  // portanto nenhum DROP é emitido quando a configuração é insegura.
  assertTestDatabaseTarget({
    host,
    schema,
    nodeEnv: process.env.NODE_ENV,
    allowRemote: process.env.TEST_DB_ALLOW_REMOTE === 'true',
    allowedRemoteHost: process.env.TEST_DB_ALLOWED_HOST,
  });

  let admin;

  try {
    admin = await createConnection({ host, port, user, password, multipleStatements: true });
  } catch (error) {
    throw new Error(
      `Não foi possível conectar ao MySQL em ${host}:${port} para os testes. ` +
        'Inicie o MySQL (cd backend && docker compose up -d) e confira DB_USER/DB_PASSWORD. ' +
        `Erro original: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin.query(
      `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await admin.end();
  }

  const sequelize = new Sequelize({
    dialect: 'mysql',
    host,
    port,
    username: user,
    password,
    database: schema,
    logging: false,
    timezone: '+00:00',
    dialectOptions: { charset: 'utf8mb4' },
  });

  try {
    await runMigrationsAndSeeders(sequelize);
  } finally {
    await sequelize.close();
  }
}
