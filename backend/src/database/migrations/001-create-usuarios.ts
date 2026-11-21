import { DataTypes, QueryInterface } from 'sequelize';

import { requireExpectedTable } from '../schema-expectations';
import { prepareMigrationTable } from '../schema-repair';

/**
 * Tabela `usuarios` do schema original do desafio.
 * Mantém tipos, nulabilidade, índices e collation sem adicionar colunas.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  // Um banco legado já pode ter esta tabela sem registro no SequelizeMeta.
  // A comparação integral evita recriar índices válidos e só repara lacunas.
  const prepared = await prepareMigrationTable(context.sequelize, requireExpectedTable('usuarios'));
  if (prepared.present) return;

  await context.createTable(
    'usuarios',
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
      login: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      senha: {
        type: DataTypes.STRING(100),
        allowNull: false,
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

  await context.addIndex('usuarios', ['login'], {
    name: 'login_UNIQUE',
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable('usuarios');
}
