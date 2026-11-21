import { DataTypes, QueryInterface } from 'sequelize';

import { requireExpectedTable } from '../schema-expectations';
import { prepareMigrationTable } from '../schema-repair';

/**
 * Tabela `receitas`, incluindo índices e chaves estrangeiras com os mesmos
 * nomes do schema original (`fk_receitas_1`/`fk_receitas_2`).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const prepared = await prepareMigrationTable(context.sequelize, requireExpectedTable('receitas'));
  if (prepared.present) return;

  await context.createTable(
    'receitas',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      id_usuarios: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      id_categorias: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      nome: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      tempo_preparo_minutos: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      porcoes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      modo_preparo: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ingredientes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      criado_em: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      alterado_em: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_0900_ai_ci',
    },
  );

  await context.addIndex('receitas', ['id_usuarios'], { name: 'fk_receitas_1_idx' });
  await context.addIndex('receitas', ['id_categorias'], { name: 'fk_receitas_2_idx' });

  await context.addConstraint('receitas', {
    fields: ['id_usuarios'],
    type: 'foreign key',
    name: 'fk_receitas_1',
    references: { table: 'usuarios', field: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  await context.addConstraint('receitas', {
    fields: ['id_categorias'],
    type: 'foreign key',
    name: 'fk_receitas_2',
    references: { table: 'categorias', field: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeConstraint('receitas', 'fk_receitas_1');
  await context.removeConstraint('receitas', 'fk_receitas_2');
  await context.removeIndex('receitas', 'fk_receitas_1_idx');
  await context.removeIndex('receitas', 'fk_receitas_2_idx');
  await context.dropTable('receitas');
}
