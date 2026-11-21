import { QueryTypes, Sequelize } from 'sequelize';

import { ExpectedForeignKey, ExpectedIndex, ExpectedTable } from './schema-expectations';
import { RepairPlan, TableComparison, compareTable, inspectSchema } from './schema-inspection';

export class SchemaDivergenceError extends Error {
  constructor(
    message: string,
    readonly comparisons: TableComparison[] = [],
  ) {
    super(message);
    this.name = 'SchemaDivergenceError';
  }
}

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

export function describeComparison(comparison: TableComparison): string {
  const status = !comparison.present
    ? 'ausente'
    : comparison.equivalent
      ? 'equivalente'
      : 'divergente';
  return [
    `- ${comparison.table} (${comparison.migration}): ${status}`,
    ...comparison.differences.map((difference) => `    ${difference.message}`),
  ].join('\n');
}

export interface PlannedRepair {
  table: string;
  migration: string;
  plan: RepairPlan;
}

async function checkUniqueIndexData(
  sequelize: Sequelize,
  table: string,
  index: ExpectedIndex,
): Promise<void> {
  const column = quoteIdentifier(index.columns[0]);

  // MySQL permite múltiplos NULL em índice único; apenas valores não nulos
  // precisam ser verificados para não criar um índice inválido.
  const rows = await sequelize.query(
    `SELECT ${column} AS value FROM ${quoteIdentifier(table)}
     WHERE ${column} IS NOT NULL
     GROUP BY ${column} HAVING COUNT(*) > 1 LIMIT 1`,
    { type: QueryTypes.SELECT },
  );

  if (rows.length) {
    throw new SchemaDivergenceError(
      `Não é possível criar o índice único "${index.name}" em ${table}: ` +
        `existem valores duplicados em ${index.columns.join(', ')}. ` +
        'Remova as duplicatas manualmente antes de repetir a operação. ' +
        'Nenhuma alteração foi aplicada.',
    );
  }
}

async function checkForeignKeyData(
  sequelize: Sequelize,
  table: string,
  foreignKey: ExpectedForeignKey,
): Promise<void> {
  const rows = await sequelize.query(
    `SELECT 1 AS conflicting
     FROM ${quoteIdentifier(table)} AS child
     LEFT JOIN ${quoteIdentifier(foreignKey.referencedTable)} AS parent
       ON child.${quoteIdentifier(foreignKey.column)} = parent.${quoteIdentifier(foreignKey.referencedColumn)}
     WHERE child.${quoteIdentifier(foreignKey.column)} IS NOT NULL
       AND parent.${quoteIdentifier(foreignKey.referencedColumn)} IS NULL
     LIMIT 1`,
    { type: QueryTypes.SELECT },
  );

  if (rows.length) {
    throw new SchemaDivergenceError(
      `Não é possível criar a foreign key "${foreignKey.name}" em ${table}: ` +
        `existem registros órfãos em ${foreignKey.column}. ` +
        'Corrija os dados manualmente antes de repetir a operação. ' +
        'Nenhuma alteração foi aplicada.',
    );
  }
}

/** Todas as pré-condições são avaliadas antes do primeiro comando de escrita. */
export async function validateRepairs(
  sequelize: Sequelize,
  repairs: PlannedRepair[],
): Promise<void> {
  for (const repair of repairs) {
    if (repair.plan.type === 'index' && repair.plan.index?.unique) {
      await checkUniqueIndexData(sequelize, repair.table, repair.plan.index);
    }
    if (repair.plan.type === 'foreign-key' && repair.plan.foreignKey) {
      await checkForeignKeyData(sequelize, repair.table, repair.plan.foreignKey);
    }
  }
}

export async function applyRepairs(
  sequelize: Sequelize,
  repairs: PlannedRepair[],
): Promise<string[]> {
  const queryInterface = sequelize.getQueryInterface();
  const applied: string[] = [];

  for (const repair of repairs) {
    const { plan } = repair;

    if (plan.index) {
      await queryInterface.addIndex(repair.table, [...plan.index.columns], {
        name: plan.index.name,
        unique: plan.index.unique,
      });
      applied.push(`${repair.table}.${plan.index.name}`);
      continue;
    }

    if (plan.foreignKey) {
      await queryInterface.addConstraint(repair.table, {
        fields: [plan.foreignKey.column],
        type: 'foreign key',
        name: plan.foreignKey.name,
        references: {
          table: plan.foreignKey.referencedTable,
          field: plan.foreignKey.referencedColumn,
        },
        onDelete: plan.foreignKey.onDelete,
        onUpdate: plan.foreignKey.onUpdate,
      });
      applied.push(`${repair.table}.${plan.foreignKey.name}`);
    }
  }

  return applied;
}

export interface TablePreparation {
  present: boolean;
  comparison: TableComparison;
  repaired: string[];
}

/**
 * Prepara UMA tabela antes de uma migration ser executada pelo Umzug.
 *
 * - tabela ausente: a migration cria normalmente;
 * - tabela equivalente: nada é recriado e a migration apenas é registrada;
 * - lacuna não destrutiva: índice/FK ausente é criado após validar os dados;
 * - divergência: falha específica, sem DDL e sem registro no histórico.
 */
export async function prepareMigrationTable(
  sequelize: Sequelize,
  expected: ExpectedTable,
): Promise<TablePreparation> {
  const snapshot = await inspectSchema(sequelize);
  const actual = snapshot.tables.find((table) => table.name === expected.name);
  const comparison = compareTable(expected, actual);

  if (!actual) return { present: false, comparison, repaired: [] };

  if (comparison.equivalent) return { present: true, comparison, repaired: [] };

  if (!comparison.repairable) {
    throw new SchemaDivergenceError(
      `A migration ${expected.migration} não pode ser aplicada: a tabela ` +
        `${expected.name} existe, mas diverge da definição esperada. ` +
        'Nenhuma alteração foi aplicada.\n' +
        describeComparison(comparison) +
        '\nCorrija a divergência manualmente. Não use db:reset em dados existentes.',
      [comparison],
    );
  }

  const repairs: PlannedRepair[] = comparison.differences
    .filter((difference) => Boolean(difference.repair))
    .map((difference) => ({
      table: expected.name,
      migration: expected.migration,
      plan: difference.repair as RepairPlan,
    }));

  await validateRepairs(sequelize, repairs);
  const repaired = await applyRepairs(sequelize, repairs);

  const verifiedSnapshot = await inspectSchema(sequelize);
  const verified = compareTable(
    expected,
    verifiedSnapshot.tables.find((table) => table.name === expected.name),
  );

  if (!verified.equivalent) {
    throw new SchemaDivergenceError(
      `A verificação de ${expected.name} encontrou divergências após o reparo. ` +
        'Nenhum histórico foi registrado.\n' +
        describeComparison(verified),
      [verified],
    );
  }

  return { present: true, comparison: verified, repaired };
}
