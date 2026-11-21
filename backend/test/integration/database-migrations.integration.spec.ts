import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createConnection } from 'mysql2/promise';
import { QueryTypes, Sequelize } from 'sequelize';

import { executeDatabaseAction } from '../../src/database/cli';
import { assertTestDatabaseTarget } from '../../src/database/database-safety';
import { buildDatabaseStatus } from '../../src/database/database-status';
import { createSeeder } from '../../src/database/migrator';
import { readHistory } from '../../src/database/schema-inspection';
import { CATEGORIAS_INICIAIS, CategoriaRow } from '../../src/database/seeders/categorias-data';

const legacySql = readFileSync(join(__dirname, '..', 'fixtures', 'legacy-schema.sql'), 'utf8');

const HOST = process.env.DB_HOST ?? '127.0.0.1';
const PORT = Number(process.env.DB_PORT ?? 3306);
const USER = process.env.DB_USER ?? 'root';
const PASSWORD = process.env.DB_PASSWORD ?? 'root';

const createdSchemas: string[] = [];

function schemaName(suffix: string): string {
  const schema = `teste_receitas_rg_sistemas_migrations_${suffix}_test`;
  createdSchemas.push(schema);
  return schema;
}

function makeSequelize(schema: string): Sequelize {
  assertTestDatabaseTarget({ host: HOST, schema, nodeEnv: 'test' });
  return new Sequelize({
    dialect: 'mysql',
    host: HOST,
    port: PORT,
    username: USER,
    password: PASSWORD,
    database: schema,
    logging: false,
    timezone: '+00:00',
    dialectOptions: { charset: 'utf8mb4' },
  });
}

async function withAdmin<T>(
  task: (connection: Awaited<ReturnType<typeof createConnection>>) => Promise<T>,
): Promise<T> {
  const connection = await createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
  });
  try {
    return await task(connection);
  } finally {
    await connection.end();
  }
}

async function resetSchema(schema: string): Promise<void> {
  await withAdmin(async (connection) => {
    await connection.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await connection.query(
      `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  });
}

async function applyLegacySchema(schema: string): Promise<void> {
  const connection = await createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: schema,
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    await connection.query(legacySql);
  } finally {
    await connection.end();
  }
}

async function rows<T>(sequelize: Sequelize, sql: string): Promise<T[]> {
  const result = await sequelize.query(sql, { type: QueryTypes.SELECT });
  return result as unknown as T[];
}

async function tableExists(sequelize: Sequelize, table: string): Promise<boolean> {
  return sequelize.getQueryInterface().tableExists(table);
}

async function categoryRows(sequelize: Sequelize): Promise<CategoriaRow[]> {
  return rows<CategoriaRow>(sequelize, 'SELECT id, nome FROM categorias ORDER BY id');
}

afterAll(async () => {
  await withAdmin(async (connection) => {
    for (const schema of createdSchemas) {
      await connection.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    }
  });
});

describe('migrations e seeders em MySQL descartável', () => {
  it('cria o schema do zero e aplica as 13 categorias uma única vez', async () => {
    const schema = schemaName('clean');
    await resetSchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      const executed = await executeDatabaseAction('up', sequelize);
      expect(executed).toEqual(['Migrations aplicadas: 4', 'Seeders aplicados: 1']);

      const history = await readHistory(sequelize);
      expect(history.migrations).toHaveLength(4);
      expect(history.seeders).toEqual(['001-categorias']);
      expect(await categoryRows(sequelize)).toEqual(CATEGORIAS_INICIAIS);

      const status = await buildDatabaseStatus(sequelize);
      expect(status.pendingMigrations).toEqual([]);
      expect(status.pendingSeeders).toEqual([]);
      expect(status.inconsistencies).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });

  it('reconhece o schema legado após comparação integral, sem perder categorias', async () => {
    const schema = schemaName('legacy');
    await resetSchema(schema);
    await applyLegacySchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      const before = await buildDatabaseStatus(sequelize);
      expect(before.pendingMigrations).toHaveLength(4);
      expect(before.inconsistencies).toEqual([
        expect.stringContaining('estrutura física equivalente a 001-create-usuarios'),
        expect.stringContaining('estrutura física equivalente a 002-create-categorias'),
        expect.stringContaining('estrutura física equivalente a 003-create-receitas'),
      ]);
      expect(await categoryRows(sequelize)).toEqual(CATEGORIAS_INICIAIS);

      await executeDatabaseAction('up', sequelize);

      const history = await readHistory(sequelize);
      expect(history.migrations).toHaveLength(4);
      expect(history.seeders).toEqual(['001-categorias']);
      expect(await categoryRows(sequelize)).toEqual(CATEGORIAS_INICIAIS);
      expect((await buildDatabaseStatus(sequelize)).inconsistencies).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });

  it('repara uma migration parcial sem excluir dados', async () => {
    const schema = schemaName('partial');
    await resetSchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      await executeDatabaseAction('up', sequelize);
      await sequelize.query(
        `INSERT INTO usuarios (nome, login, senha, criado_em, alterado_em)
         VALUES ('Usuario preservado', 'usuario.preservado', 'hash', NOW(), NOW())`,
      );
      await sequelize.query('ALTER TABLE usuarios DROP INDEX login_UNIQUE');
      await sequelize.query("DELETE FROM SequelizeMeta WHERE name = '001-create-usuarios'");

      const before = await buildDatabaseStatus(sequelize);
      expect(before.physical.find((item) => item.table === 'usuarios')?.repairable).toBe(true);

      await executeDatabaseAction('up', sequelize);

      const indexes = await rows<{ total: number }>(
        sequelize,
        `SELECT COUNT(*) AS total FROM information_schema.statistics
         WHERE table_schema = '${schema}' AND table_name = 'usuarios'
           AND index_name = 'login_UNIQUE' AND non_unique = 0`,
      );
      expect(Number(indexes[0].total)).toBe(1);
      expect(
        (await rows<{ login: string }>(sequelize, 'SELECT login FROM usuarios'))[0].login,
      ).toBe('usuario.preservado');
      expect((await readHistory(sequelize)).migrations).toContain('001-create-usuarios');
    } finally {
      await sequelize.close();
    }
  });

  it('falha com diagnóstico e sem registro quando a divergência não é reparável', async () => {
    const schema = schemaName('divergent');
    await resetSchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      await executeDatabaseAction('up', sequelize);
      await sequelize.query('ALTER TABLE usuarios DROP INDEX login_UNIQUE');
      await sequelize.query('CREATE INDEX login_UNIQUE ON usuarios(login)');
      await sequelize.query("DELETE FROM SequelizeMeta WHERE name = '001-create-usuarios'");

      await expect(executeDatabaseAction('up', sequelize)).rejects.toThrow(
        'divergência não reparável',
      );
      expect((await readHistory(sequelize)).migrations).not.toContain('001-create-usuarios');

      const status = await buildDatabaseStatus(sequelize);
      expect(status.inconsistencies).toEqual([
        expect.stringContaining('índice login_UNIQUE com definição divergente'),
      ]);
    } finally {
      await sequelize.close();
    }
  });

  it('bloqueia db:seed enquanto existir qualquer migration pendente', async () => {
    const schema = schemaName('seedblocked');
    await resetSchema(schema);
    await applyLegacySchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      await expect(executeDatabaseAction('seed', sequelize)).rejects.toThrow(
        'Existem migrations pendentes',
      );
      expect(await tableExists(sequelize, 'SequelizeData')).toBe(false);
      expect(await categoryRows(sequelize)).toEqual(CATEGORIAS_INICIAIS);
    } finally {
      await sequelize.close();
    }
  });

  it('permite baseline explícito sem criar tabelas ausentes', async () => {
    const schema = schemaName('baseline');
    await resetSchema(schema);
    await applyLegacySchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      const baselined = await executeDatabaseAction('baseline', sequelize);
      expect(baselined).toEqual([
        'Migrations reconhecidas no histórico: 3',
        '  - 001-create-usuarios',
        '  - 002-create-categorias',
        '  - 003-create-receitas',
      ]);
      expect(await tableExists(sequelize, 'auth_sessions')).toBe(false);
      expect((await readHistory(sequelize)).migrations).not.toContain('004-create-auth-sessions');

      await expect(executeDatabaseAction('seed', sequelize)).rejects.toThrow(
        '- 004-create-auth-sessions',
      );
      await executeDatabaseAction('up', sequelize);
      expect((await readHistory(sequelize)).migrations).toHaveLength(4);
    } finally {
      await sequelize.close();
    }
  });

  it('mantém db:status somente leitura em um banco sem histórico', async () => {
    const schema = schemaName('readonly');
    await resetSchema(schema);
    await applyLegacySchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      expect(await tableExists(sequelize, 'SequelizeMeta')).toBe(false);
      expect(await tableExists(sequelize, 'SequelizeData')).toBe(false);

      const lines = await executeDatabaseAction('status', sequelize);
      expect(lines.join('\n')).toContain('Inconsistências: 3');
      expect(await tableExists(sequelize, 'SequelizeMeta')).toBe(false);
      expect(await tableExists(sequelize, 'SequelizeData')).toBe(false);
    } finally {
      await sequelize.close();
    }
  });

  it('informa conflito de categoria sem sobrescrever o valor existente', async () => {
    const schema = schemaName('categoryconflict');
    await resetSchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      await executeDatabaseAction('up', sequelize);
      await sequelize.query("UPDATE categorias SET nome = 'Carne bovina' WHERE id = 2");
      await sequelize.query('DELETE FROM SequelizeData');

      await expect(executeDatabaseAction('seed', sequelize)).rejects.toThrow(
        'há categorias originais divergentes',
      );
      expect((await categoryRows(sequelize)).find((item) => item.id === 2)?.nome).toBe(
        'Carne bovina',
      );
      expect((await readHistory(sequelize)).seeders).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });

  it('não remove categorias no rollback do seeder', async () => {
    const schema = schemaName('seedrollback');
    await resetSchema(schema);
    const sequelize = makeSequelize(schema);

    try {
      await executeDatabaseAction('up', sequelize);
      await createSeeder(sequelize).down({ to: 0 });

      expect(await categoryRows(sequelize)).toEqual(CATEGORIAS_INICIAIS);
      expect((await readHistory(sequelize)).seeders).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });

  it('serializa execuções concorrentes com o lock de migrations', async () => {
    const schema = schemaName('concurrent');
    await resetSchema(schema);
    const first = makeSequelize(schema);
    const second = makeSequelize(schema);

    try {
      const results = await Promise.all([
        executeDatabaseAction('up', first),
        executeDatabaseAction('up', second),
      ]);

      expect(results).toHaveLength(2);
      expect(results.flat().join(' ')).toContain('Migrations aplicadas: 4');
      expect((await readHistory(first)).migrations).toHaveLength(4);
      expect((await readHistory(first)).seeders).toEqual(['001-categorias']);
      expect(await categoryRows(first)).toEqual(CATEGORIAS_INICIAIS);
    } finally {
      await first.close();
      await second.close();
    }
  });
});
