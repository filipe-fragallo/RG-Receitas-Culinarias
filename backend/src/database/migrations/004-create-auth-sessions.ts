import { DataTypes, QueryInterface } from 'sequelize';

import { requireExpectedTable } from '../schema-expectations';
import { prepareMigrationTable } from '../schema-repair';

/**
 * Extensão técnica de segurança para revogação persistente de sessões.
 * As tabelas originais do desafio não são alteradas.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const prepared = await prepareMigrationTable(
    context.sequelize,
    requireExpectedTable('auth_sessions'),
  );
  if (prepared.present) return;

  await context.createTable(
    'auth_sessions',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      token_identifier_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_0900_ai_ci',
    },
  );

  await context.addIndex('auth_sessions', ['token_identifier_hash'], {
    name: 'uq_auth_sessions_token_identifier_hash',
    unique: true,
  });
  await context.addIndex('auth_sessions', ['user_id'], { name: 'idx_auth_sessions_user_id' });
  await context.addIndex('auth_sessions', ['expires_at'], { name: 'idx_auth_sessions_expires_at' });

  // A FK é adicionada depois do índice e com nome explícito. Assim MySQL 8.4 e
  // TiDB produzem exatamente o mesmo schema (o TiDB nomeia uma FK inline como
  // `fk_1` e cria um índice extra). O schema final não é alterado.
  await context.addConstraint('auth_sessions', {
    type: 'foreign key',
    name: 'auth_sessions_ibfk_1',
    fields: ['user_id'],
    references: { table: 'usuarios', field: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable('auth_sessions');
}
