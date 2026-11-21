import { Sequelize } from 'sequelize';

import {
  HistorySnapshot,
  SchemaSnapshot,
  TableComparison,
  blockingDifferences,
  compareSchema,
  inspectSchema,
} from './schema-inspection';
import {
  PlannedRepair,
  SchemaDivergenceError,
  applyRepairs,
  describeComparison,
  validateRepairs,
} from './schema-repair';

export { SchemaDivergenceError };

const HISTORY_TABLE = 'SequelizeMeta';

export interface ReconciliationResult {
  baselined: string[];
  repaired: string[];
  comparisons: TableComparison[];
}

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function historyRecorded(history: HistorySnapshot): Set<string> {
  return new Set(history.migrations);
}

/**
 * Verifica se o schema físico corresponde ao que as migrations declaram.
 * Usado pelo seeder antes de qualquer INSERT.
 */
export async function assertSchemaReadyForSeeders(sequelize: Sequelize): Promise<void> {
  const snapshot = await inspectSchema(sequelize);
  const comparisons = compareSchema(snapshot);
  const problems = blockingDifferences(comparisons);

  if (problems.length) {
    throw new SchemaDivergenceError(
      'Não foi possível executar os seeders: o schema físico não corresponde às migrations.\n' +
        `${problems.join('\n')}\n` +
        'Regularize o schema com npm run db:migrate antes de prosseguir.',
      comparisons,
    );
  }

  const missing = comparisons.filter((item) => !item.present);
  if (missing.length) {
    throw new SchemaDivergenceError(
      'Não foi possível executar os seeders: ainda existem tabelas do schema ausentes.\n' +
        `${missing.map((item) => `  - ${item.table}`).join('\n')}\n` +
        'Execute npm run db:migrate.',
      comparisons,
    );
  }
}

async function ensureHistoryTable(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(HISTORY_TABLE)} (
      ${quoteIdentifier('name')} VARCHAR(255) NOT NULL,
      PRIMARY KEY (${quoteIdentifier('name')})
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci`,
  );
}

async function recordMigration(sequelize: Sequelize, name: string): Promise<void> {
  await ensureHistoryTable(sequelize);
  await sequelize.query(
    `INSERT INTO ${quoteIdentifier(HISTORY_TABLE)} (${quoteIdentifier('name')})
     VALUES (:name) ON DUPLICATE KEY UPDATE ${quoteIdentifier('name')} = ${quoteIdentifier('name')}`,
    { replacements: { name } },
  );
}

/**
 * Reconciliação em duas fases:
 *
 * 1. compara tudo e valida pré-condições dos dados;
 * 2. somente se não houver divergência, aplica reparos não destrutivos e
 *    registra no histórico o que foi comprovadamente encontrado no schema.
 *
 * Nada é escrito quando existe ambiguidade.
 */
export async function reconcileSchemaHistory(sequelize: Sequelize): Promise<ReconciliationResult> {
  const snapshot: SchemaSnapshot = await inspectSchema(sequelize);
  const comparisons = compareSchema(snapshot);
  const recorded = historyRecorded(snapshot.history);
  const errors: string[] = [];
  const repairs: PlannedRepair[] = [];

  for (const comparison of comparisons) {
    if (!comparison.present) {
      if (recorded.has(comparison.migration)) {
        errors.push(
          `${comparison.table}: o histórico registra ${comparison.migration}, mas a tabela não existe. ` +
            'Não é seguro reaplicar a migration automaticamente; regularize manualmente.',
        );
      }
      continue;
    }

    const problems = blockingDifferences([comparison]);
    if (!problems.length) continue;

    if (recorded.has(comparison.migration)) {
      errors.push(
        `${comparison.table}: migration ${comparison.migration} está registrada, mas o schema diverge.\n` +
          problems.map((item) => `    ${item}`).join('\n'),
      );
      continue;
    }

    if (!comparison.repairable) {
      errors.push(
        `${comparison.table}: divergência não reparável.\n${describeComparison(comparison)}`,
      );
      continue;
    }

    for (const difference of comparison.differences) {
      if (!difference.repair) continue;
      repairs.push({
        table: comparison.table,
        migration: comparison.migration,
        plan: difference.repair,
      });
    }
  }

  if (errors.length) {
    throw new SchemaDivergenceError(
      'Reconciliação de schema interrompida; nenhuma alteração foi aplicada.\n' +
        `${errors.join('\n\n')}\n` +
        'Corrija as divergências explicitamente. Não use db:reset em dados existentes.',
      comparisons,
    );
  }

  await validateRepairs(sequelize, repairs);
  const repaired = await applyRepairs(sequelize, repairs);

  const verifiedSnapshot = await inspectSchema(sequelize);
  const verified = compareSchema(verifiedSnapshot);
  const remaining = blockingDifferences(verified);

  if (remaining.length) {
    throw new SchemaDivergenceError(
      'A verificação após o reparo encontrou divergências; nenhum histórico foi registrado.\n' +
        remaining.join('\n'),
      verified,
    );
  }

  const recordedAfterRepair = historyRecorded(verifiedSnapshot.history);
  const baselined: string[] = [];

  for (const comparison of verified) {
    if (!comparison.present || !comparison.equivalent) continue;
    if (recordedAfterRepair.has(comparison.migration)) continue;
    await recordMigration(sequelize, comparison.migration);
    baselined.push(comparison.migration);
  }

  return { baselined, repaired, comparisons: verified };
}
