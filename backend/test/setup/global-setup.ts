import * as fs from 'node:fs';
import * as path from 'node:path';

import { createConnection } from 'mysql2/promise';

import { applyTestEnvironment } from './test-environment';

/**
 * Recria o banco de integração a partir do MESMO SQL usado pelo Docker,
 * substituindo apenas o nome do schema. Assim os testes exercitam as
 * constraints, índices e categorias reais do desafio.
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnvironment();

  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? 'root';
  const schema = process.env.DB_NAME ?? 'teste_receitas_rg_sistemas_test';

  if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
    throw new Error(`Nome de schema de teste inválido: ${schema}`);
  }

  const schemaFile = path.resolve(__dirname, '../../../database/init/01-schema.sql');
  const productionSchema = 'teste_receitas_rg_sistemas';

  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Script SQL não encontrado em ${schemaFile}`);
  }

  const sql = fs.readFileSync(schemaFile, 'utf8').replaceAll(productionSchema, schema);

  let connection;

  try {
    connection = await createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });
  } catch (error) {
    throw new Error(
      `Não foi possível conectar ao MySQL em ${host}:${port} para os testes de integração. ` +
        'Inicie o MySQL (docker compose up -d mysql) e confira DB_USER/DB_PASSWORD. ' +
        `Erro original: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}
