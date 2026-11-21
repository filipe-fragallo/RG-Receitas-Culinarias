import { Sequelize } from 'sequelize';

import { MIGRATIONS, SEEDERS } from './migrator';
import { HistorySnapshot, compareSchema, inspectSchema, pendingNames } from './schema-inspection';

export interface DatabaseStatus {
  schema: string;
  host: string;
  port: number;
  history: HistorySnapshot;
  pendingMigrations: string[];
  pendingSeeders: string[];
  physical: ReturnType<typeof compareSchema>;
  inconsistencies: string[];
  guidance: string[];
  lines: string[];
}

/**
 * Monte o relatório sem qualquer escrita: a história é lida diretamente das
 * tabelas de controle, sem `Umzug.pending()` (que criaria tabelas ausentes).
 */
export async function buildDatabaseStatus(sequelize: Sequelize): Promise<DatabaseStatus> {
  const config = sequelize.config as { host?: string; port?: number; database?: string };
  const snapshot = await inspectSchema(sequelize);
  const physical = compareSchema(snapshot);
  const history = snapshot.history;
  const pendingMigrations = pendingNames(
    history.migrations,
    MIGRATIONS.map((migration) => migration.name),
  );
  const pendingSeeders = pendingNames(
    history.seeders,
    SEEDERS.map((seeder) => seeder.name),
  );

  const appliedMigrations = MIGRATIONS.map((item) => item.name).filter((name) =>
    history.migrations.includes(name),
  );
  const appliedSeeders = SEEDERS.map((item) => item.name).filter((name) =>
    history.seeders.includes(name),
  );

  const inconsistencies: string[] = [];
  const guidance: string[] = [];

  for (const comparison of physical) {
    if (!comparison.present && history.migrations.includes(comparison.migration)) {
      inconsistencies.push(
        `${comparison.table}: ${comparison.migration} está no histórico, mas a tabela não existe.`,
      );
      guidance.push(
        'Regularize manualmente a estrutura ausente; não reaplique a migration cegamente.',
      );
      continue;
    }

    if (!comparison.present) continue;

    const blocking = comparison.differences.filter((difference) => difference.blocking);
    if (blocking.length) {
      inconsistencies.push(
        `${comparison.table}: ${blocking.map((difference) => difference.message).join('; ')}`,
      );
      if (comparison.repairable && !history.migrations.includes(comparison.migration)) {
        guidance.push(
          `Execute npm run db:migrate para reparar ${comparison.table} e reconciliar ${comparison.migration}.`,
        );
      } else {
        guidance.push(`Corrija manualmente a divergência de ${comparison.table} antes de migrar.`);
      }
      continue;
    }

    if (!comparison.equivalent) {
      inconsistencies.push(
        `${comparison.table}: objetos adicionais ${comparison.differences
          .map((difference) => difference.message)
          .join('; ')}`,
      );
    }

    if (!history.migrations.includes(comparison.migration)) {
      inconsistencies.push(
        `${comparison.table}: estrutura física equivalente a ${comparison.migration}, sem registro no histórico.`,
      );
      guidance.push(
        `Execute npm run db:migrate para validar e reconhecer ${comparison.migration}, ` +
          'ou npm run db:baseline para registrar somente o que já existe.',
      );
    }
  }

  if (pendingSeeders.length) {
    guidance.push('Execute npm run db:seed depois de regularizar as migrations.');
  }

  const lines: string[] = [];
  lines.push(`Schema: ${snapshot.schema}`);
  lines.push(`Host: ${config.host ?? '127.0.0.1'}:${config.port ?? 3306} (credenciais omitidas)`);
  lines.push(`Migrations aplicadas: ${appliedMigrations.length}`);
  appliedMigrations.forEach((name) => lines.push(`  - ${name}`));
  lines.push(`Migrations pendentes: ${pendingMigrations.length}`);
  pendingMigrations.forEach((name) => lines.push(`  - ${name}`));
  lines.push(`Seeders aplicados: ${appliedSeeders.length}`);
  appliedSeeders.forEach((name) => lines.push(`  - ${name}`));
  lines.push(`Seeders pendentes: ${pendingSeeders.length}`);
  pendingSeeders.forEach((name) => lines.push(`  - ${name}`));
  lines.push('Schema físico:');
  physical.forEach((comparison) => {
    lines.push(
      `  - ${comparison.table}: ${
        !comparison.present
          ? 'ausente'
          : comparison.equivalent
            ? 'equivalente à migration'
            : comparison.repairable
              ? 'reparável sem exclusão'
              : 'divergente'
      } (${comparison.rowCount} registro(s))`,
    );
  });
  lines.push(`Inconsistências: ${inconsistencies.length}`);
  inconsistencies.forEach((item) => lines.push(`  - ${item}`));
  if (guidance.length) {
    lines.push('Orientação:');
    [...new Set(guidance)].forEach((item) => lines.push(`  - ${item}`));
  }

  return {
    schema: snapshot.schema,
    host: config.host ?? '127.0.0.1',
    port: Number(config.port ?? 3306),
    history,
    pendingMigrations,
    pendingSeeders,
    physical,
    inconsistencies,
    guidance: [...new Set(guidance)],
    lines,
  };
}
