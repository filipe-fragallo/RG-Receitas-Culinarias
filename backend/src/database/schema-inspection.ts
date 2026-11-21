import { QueryTypes, Sequelize } from 'sequelize';

import {
  EXPECTED_TABLES,
  ExpectedForeignKey,
  ExpectedIndex,
  ExpectedTable,
} from './schema-expectations';

export interface ColumnSnapshot {
  name: string;
  columnType: string;
  isNullable: boolean;
  columnDefault: string | null;
  extra: string;
  collation: string | null;
}

export interface IndexColumnSnapshot {
  name: string;
  sequence: number;
  order: string;
}

export interface IndexSnapshot {
  name: string;
  columns: IndexColumnSnapshot[];
  unique: boolean;
}

export interface ForeignKeySnapshot {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface TableSnapshot {
  name: string;
  engine: string;
  collation: string | null;
  columns: ColumnSnapshot[];
  indexes: IndexSnapshot[];
  foreignKeys: ForeignKeySnapshot[];
  rowCount: number;
}

export interface HistorySnapshot {
  migrations: string[];
  seeders: string[];
}

export interface SchemaSnapshot {
  schema: string;
  tables: TableSnapshot[];
  history: HistorySnapshot;
}

export type DifferenceKind =
  | 'engine'
  | 'collation'
  | 'column'
  | 'index'
  | 'foreign-key'
  | 'unexpected-index'
  | 'unexpected-foreign-key';

export interface RepairPlan {
  type: 'index' | 'foreign-key';
  index?: ExpectedIndex;
  foreignKey?: ExpectedForeignKey;
}

export interface TableDifference {
  kind: DifferenceKind;
  message: string;
  blocking: boolean;
  repair?: RepairPlan;
}

export interface TableComparison {
  table: string;
  migration: string;
  present: boolean;
  equivalent: boolean;
  repairable: boolean;
  rowCount: number;
  differences: TableDifference[];
}

const MIGRATION_HISTORY_TABLE = 'SequelizeMeta';
const SEEDER_HISTORY_TABLE = 'SequelizeData';

function normalizeCollation(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return normalized === 'null' ? null : normalized;
}

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function isNullable(value: string): boolean {
  return `${value}`.toUpperCase() === 'YES';
}

/**
 * Leitura pura do histórico: não usa `Umzug.pending()` porque essa chamada
 * cria a tabela de controle quando ela não existe. `db:status` não escreve.
 */
export async function readHistoryTable(
  sequelize: Sequelize,
  table: typeof MIGRATION_HISTORY_TABLE | typeof SEEDER_HISTORY_TABLE,
): Promise<string[]> {
  if (!(await sequelize.getQueryInterface().tableExists(table))) return [];

  const rows = await sequelize.query<{ name: string }>(
    `SELECT ${quoteIdentifier('name')} FROM ${quoteIdentifier(table)}`,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => String(row.name));
}

export async function readHistory(sequelize: Sequelize): Promise<HistorySnapshot> {
  const [migrations, seeders] = await Promise.all([
    readHistoryTable(sequelize, MIGRATION_HISTORY_TABLE),
    readHistoryTable(sequelize, SEEDER_HISTORY_TABLE),
  ]);
  return { migrations, seeders };
}

export function pendingNames(recorded: string[], expected: string[]): string[] {
  const applied = new Set(recorded);
  return expected.filter((name) => !applied.has(name));
}

export async function inspectSchema(sequelize: Sequelize): Promise<SchemaSnapshot> {
  const schema = String(
    (sequelize.config as { database?: string }).database ?? sequelize.getDatabaseName(),
  );

  const [tableRows, columnRows, indexRows, foreignKeyRows] = await Promise.all([
    sequelize.query<{
      name: string;
      engine: string;
      collation: string | null;
    }>(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = :schema AND TABLE_TYPE = 'BASE TABLE'`,
      { replacements: { schema }, type: QueryTypes.SELECT },
    ),
    sequelize.query<{
      tableName: string;
      name: string;
      columnType: string;
      isNullable: string;
      columnDefault: string | null;
      extra: string;
      collation: string | null;
    }>(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
              IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault,
              EXTRA AS extra, COLLATION_NAME AS collation
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = :schema
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      { replacements: { schema }, type: QueryTypes.SELECT },
    ),
    sequelize.query<{
      tableName: string;
      name: string;
      columnName: string;
      sequence: number;
      sorting: string;
      nonUnique: number;
    }>(
      `SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, COLUMN_NAME AS columnName,
              SEQ_IN_INDEX AS sequence, COLLATION AS sorting, NON_UNIQUE AS nonUnique
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = :schema
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      { replacements: { schema }, type: QueryTypes.SELECT },
    ),
    sequelize.query<{
      tableName: string;
      name: string;
      columnName: string;
      referencedTable: string;
      referencedColumn: string;
      onDelete: string;
      onUpdate: string;
    }>(
      `SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS name,
              k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS referencedTable,
              k.REFERENCED_COLUMN_NAME AS referencedColumn,
              r.DELETE_RULE AS onDelete, r.UPDATE_RULE AS onUpdate
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.CONSTRAINT_SCHEMA = :schema AND k.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
      { replacements: { schema }, type: QueryTypes.SELECT },
    ),
  ]);

  const tables: TableSnapshot[] = [];

  for (const tableRow of tableRows) {
    const table: TableSnapshot = {
      name: tableRow.name,
      engine: tableRow.engine,
      collation: normalizeCollation(tableRow.collation),
      columns: columnRows
        .filter((row) => row.tableName === tableRow.name)
        .map((row) => ({
          name: row.name,
          columnType: row.columnType.toLowerCase(),
          isNullable: isNullable(row.isNullable),
          columnDefault: row.columnDefault,
          extra: row.extra ?? '',
          collation: normalizeCollation(row.collation),
        })),
      indexes: [],
      foreignKeys: foreignKeyRows
        .filter((row) => row.tableName === tableRow.name)
        .map((row) => ({
          name: row.name,
          column: row.columnName,
          referencedTable: row.referencedTable,
          referencedColumn: row.referencedColumn,
          onDelete: row.onDelete,
          onUpdate: row.onUpdate,
        })),
      rowCount: 0,
    };

    const grouped = new Map<string, IndexSnapshot>();
    for (const row of indexRows.filter((item) => item.tableName === tableRow.name)) {
      let index = grouped.get(row.name);
      if (!index) {
        index = { name: row.name, columns: [], unique: Number(row.nonUnique) === 0 };
        grouped.set(row.name, index);
      }
      index.columns.push({
        name: row.columnName,
        sequence: Number(row.sequence),
        order: row.sorting,
      });
    }
    table.indexes = [...grouped.values()].map((index) => ({
      ...index,
      columns: [...index.columns].sort((a, b) => a.sequence - b.sequence),
    }));

    if (EXPECTED_TABLES.some((expected) => expected.name === table.name)) {
      const [countRow] = await sequelize.query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM ${quoteIdentifier(table.name)}`,
        { type: QueryTypes.SELECT },
      );
      table.rowCount = Number(countRow?.total ?? 0);
    }

    tables.push(table);
  }

  return { schema, tables, history: await readHistory(sequelize) };
}

function indexMatches(index: IndexSnapshot, expected: ExpectedIndex): boolean {
  if (index.unique !== expected.unique) return false;
  if (index.columns.length !== expected.columns.length) return false;

  return index.columns.every((column, position) => {
    return (
      column.name === expected.columns[position] &&
      column.sequence === position + 1 &&
      `${column.order}`.toUpperCase() === 'A'
    );
  });
}

function foreignKeyMatches(key: ForeignKeySnapshot, expected: ExpectedForeignKey): boolean {
  return (
    key.column === expected.column &&
    key.referencedTable === expected.referencedTable &&
    key.referencedColumn === expected.referencedColumn &&
    `${key.onDelete}`.toUpperCase() === expected.onDelete.toUpperCase() &&
    `${key.onUpdate}`.toUpperCase() === expected.onUpdate.toUpperCase()
  );
}

function columnNames(index: IndexSnapshot | ExpectedIndex): string[] {
  if (!index.columns.length) return [];
  return typeof index.columns[0] === 'string'
    ? (index.columns as string[])
    : (index.columns as IndexColumnSnapshot[]).map((column) => column.name);
}

function columnSignature(index: IndexSnapshot | ExpectedIndex): string {
  return columnNames(index).join(',');
}

/** Compara uma tabela física com a definição declarada na migration. */
export function compareTable(
  expected: ExpectedTable,
  actual: TableSnapshot | undefined,
): TableComparison {
  const comparison: TableComparison = {
    table: expected.name,
    migration: expected.migration,
    present: Boolean(actual),
    equivalent: false,
    repairable: false,
    rowCount: actual?.rowCount ?? 0,
    differences: [],
  };

  if (!actual) return comparison;

  const add = (difference: TableDifference): void => {
    comparison.differences.push(difference);
  };

  if (actual.engine.toLowerCase() !== expected.engine.toLowerCase()) {
    add({
      kind: 'engine',
      message: `engine ${actual.engine} != ${expected.engine}`,
      blocking: true,
    });
  }

  const actualCollation = normalizeCollation(actual.collation);
  if (actualCollation !== expected.collation.toLowerCase()) {
    add({
      kind: 'collation',
      message: `collation ${actualCollation ?? 'ausente'} != ${expected.collation}`,
      blocking: true,
    });
  }

  for (const expectedColumn of expected.columns) {
    const column = actual.columns.find((item) => item.name === expectedColumn.name);
    if (!column) {
      add({
        kind: 'column',
        message: `coluna ausente: ${expectedColumn.name}`,
        blocking: true,
      });
      continue;
    }

    if (column.columnType.toLowerCase() !== expectedColumn.columnType.toLowerCase()) {
      add({
        kind: 'column',
        message: `${expectedColumn.name}: tipo ${column.columnType} != ${expectedColumn.columnType}`,
        blocking: true,
      });
    }
    if (column.isNullable !== expectedColumn.nullable) {
      add({
        kind: 'column',
        message: `${expectedColumn.name}: nulabilidade divergente`,
        blocking: true,
      });
    }
    const hasAutoIncrement = column.extra.toLowerCase().includes('auto_increment');
    if (hasAutoIncrement !== Boolean(expectedColumn.autoIncrement)) {
      add({
        kind: 'column',
        message: `${expectedColumn.name}: AUTO_INCREMENT divergente`,
        blocking: true,
      });
    }
    const defaultText =
      column.columnDefault === null ? null : `${column.columnDefault}`.toUpperCase();
    if (defaultText !== null && defaultText !== 'NULL') {
      add({
        kind: 'column',
        message: `${expectedColumn.name}: DEFAULT inesperado (${column.columnDefault})`,
        blocking: true,
      });
    }
    if (normalizeCollation(column.collation) !== normalizeCollation(expectedColumn.collation)) {
      add({
        kind: 'column',
        message: `${expectedColumn.name}: collation ${column.collation ?? 'ausente'} != ${
          expectedColumn.collation ?? 'nenhuma'
        }`,
        blocking: true,
      });
    }
  }

  const expectedColumnNames = new Set(expected.columns.map((column) => column.name));
  for (const column of actual.columns) {
    if (!expectedColumnNames.has(column.name)) {
      add({
        kind: 'column',
        message: `coluna não prevista: ${column.name}`,
        blocking: true,
      });
    }
  }

  for (const expectedIndex of expected.indexes) {
    const index = actual.indexes.find((item) => item.name === expectedIndex.name);
    if (!index) {
      add({
        kind: 'index',
        message: `índice ausente: ${expectedIndex.name}`,
        blocking: true,
        repair: { type: 'index', index: expectedIndex },
      });
      continue;
    }
    if (!indexMatches(index, expectedIndex)) {
      add({
        kind: 'index',
        message: `índice ${expectedIndex.name} com definição divergente`,
        blocking: true,
      });
    }
  }

  const expectedIndexNames = new Set(expected.indexes.map((index) => index.name));
  for (const index of actual.indexes) {
    if (expectedIndexNames.has(index.name)) continue;
    const duplicatesExpected = expected.indexes.some(
      (item) => item.unique === index.unique && columnSignature(item) === columnSignature(index),
    );
    add({
      kind: duplicatesExpected ? 'index' : 'unexpected-index',
      message: duplicatesExpected
        ? `índice duplicado ${index.name} para ${columnSignature(index)}`
        : `índice adicional ${index.name}`,
      blocking: true,
    });
  }

  for (const expectedKey of expected.foreignKeys) {
    const key = actual.foreignKeys.find((item) => item.name === expectedKey.name);
    if (!key) {
      add({
        kind: 'foreign-key',
        message: `foreign key ausente: ${expectedKey.name}`,
        blocking: true,
        repair: { type: 'foreign-key', foreignKey: expectedKey },
      });
      continue;
    }
    if (!foreignKeyMatches(key, expectedKey)) {
      add({
        kind: 'foreign-key',
        message: `foreign key ${expectedKey.name} com definição divergente`,
        blocking: true,
      });
    }
  }

  const expectedKeyNames = new Set(expected.foreignKeys.map((key) => key.name));
  for (const key of actual.foreignKeys) {
    if (expectedKeyNames.has(key.name)) continue;
    const duplicatesExpected = expected.foreignKeys.some((item) => item.column === key.column);
    add({
      kind: duplicatesExpected ? 'foreign-key' : 'unexpected-foreign-key',
      message: duplicatesExpected
        ? `foreign key duplicada ${key.name} na coluna ${key.column}`
        : `foreign key adicional ${key.name}`,
      blocking: true,
    });
  }

  comparison.equivalent = comparison.differences.length === 0;
  comparison.repairable =
    !comparison.equivalent &&
    comparison.differences.every(
      (difference) => !difference.blocking || Boolean(difference.repair),
    );

  return comparison;
}

export function compareSchema(snapshot: SchemaSnapshot): TableComparison[] {
  const byName = new Map(snapshot.tables.map((table) => [table.name, table]));
  return EXPECTED_TABLES.map((expected) => compareTable(expected, byName.get(expected.name)));
}

export function blockingDifferences(comparisons: TableComparison[]): string[] {
  const messages: string[] = [];
  for (const comparison of comparisons) {
    for (const difference of comparison.differences) {
      if (!difference.blocking) continue;
      messages.push(`${comparison.table}: ${difference.message}`);
    }
  }
  return messages;
}

export function formatComparison(comparison: TableComparison): string {
  const status = !comparison.present
    ? 'ausente'
    : comparison.equivalent
      ? 'equivalente'
      : comparison.repairable
        ? 'reparável sem exclusão'
        : 'divergente';
  const lines = [`- ${comparison.table} (${comparison.migration}): ${status}`];
  for (const difference of comparison.differences) {
    lines.push(
      `    ${difference.blocking ? '[bloqueante]' : '[informativo]'} ${difference.message}`,
    );
  }
  return lines.join('\n');
}
