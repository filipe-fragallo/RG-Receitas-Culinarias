import 'reflect-metadata';

import { Optional } from 'sequelize';
import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  DefaultScope,
  HasMany,
  Model,
  PrimaryKey,
  Scopes,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

import { Recipe } from './recipe.model';

export interface UserAttributes {
  id: number;
  name: string | null;
  login: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'name' | 'createdAt' | 'updatedAt'
>;

/**
 * O hash de senha fica fora do escopo padrão. Consultas que precisam validar
 * credenciais usam `User.unscoped()` de forma explícita (ver UsersService).
 */
@DefaultScope(() => ({
  attributes: { exclude: ['passwordHash'] },
}))
@Scopes(() => ({
  withPassword: {
    attributes: { include: ['passwordHash'] },
  },
}))
@Table({
  tableName: 'usuarios',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare id: number;

  @Column({ field: 'nome', type: DataType.STRING(100), allowNull: true })
  declare name: string | null;

  @Column({ field: 'login', type: DataType.STRING(100), allowNull: false })
  declare login: string;

  @Column({ field: 'senha', type: DataType.STRING(100), allowNull: false })
  declare passwordHash: string;

  @CreatedAt
  @Column({ field: 'criado_em', type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'alterado_em', type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @HasMany(() => Recipe, { foreignKey: 'userId', as: 'recipes' })
  declare recipes?: Recipe[];
}
