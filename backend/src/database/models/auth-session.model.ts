import 'reflect-metadata';

import { Optional } from 'sequelize';
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

/**
 * Extensão técnica de segurança: registra identificadores de sessão do JWT.
 * Não substitui nem altera as tabelas originais `usuarios`, `categorias` e
 * `receitas`.
 */
export interface AuthSessionAttributes {
  id: number;
  userId: number;
  tokenIdentifierHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type AuthSessionCreationAttributes = Optional<AuthSessionAttributes, 'id' | 'revokedAt'>;

@Table({ tableName: 'auth_sessions', timestamps: false })
export class AuthSession extends Model<AuthSessionAttributes, AuthSessionCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare id: number;

  @Column({ field: 'user_id', type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare userId: number;

  @Column({ field: 'token_identifier_hash', type: DataType.STRING(64), allowNull: false })
  declare tokenIdentifierHash: string;

  @Column({ field: 'created_at', type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @Column({ field: 'expires_at', type: DataType.DATE, allowNull: false })
  declare expiresAt: Date;

  @Column({ field: 'revoked_at', type: DataType.DATE, allowNull: true })
  declare revokedAt: Date | null;
}
