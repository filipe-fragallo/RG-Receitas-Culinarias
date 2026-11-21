import { DataTypes, QueryInterface } from 'sequelize';

import { requireExpectedTable } from '../schema-expectations';
import { prepareMigrationTable } from '../schema-repair';

/** Tabela `categorias` do schema original (13 registros vêm do seeder). */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const prepared = await prepareMigrationTable(
    context.sequelize,
    requireExpectedTable('categorias'),
  );
  if (prepared.present) return;

  await context.createTable(
    'categorias',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      nome: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_0900_ai_ci',
    },
  );

  await context.addIndex('categorias', ['nome'], {
    name: 'nome_UNIQUE',
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable('categorias');
}
