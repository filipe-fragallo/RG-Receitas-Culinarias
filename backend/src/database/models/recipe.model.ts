import 'reflect-metadata';

import { Optional } from 'sequelize';
import {
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

import { Category } from './category.model';
import { User } from './user.model';

export interface RecipeAttributes {
  id: number;
  userId: number;
  categoryId: number | null;
  name: string | null;
  preparationTimeMinutes: number | null;
  servings: number | null;
  instructions: string;
  ingredients: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeCreationAttributes = Optional<
  RecipeAttributes,
  | 'id'
  | 'categoryId'
  | 'name'
  | 'preparationTimeMinutes'
  | 'servings'
  | 'ingredients'
  | 'createdAt'
  | 'updatedAt'
>;

@Table({
  tableName: 'receitas',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
})
export class Recipe extends Model<RecipeAttributes, RecipeCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare id: number;

  @Column({ field: 'id_usuarios', type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare userId: number;

  @Column({ field: 'id_categorias', type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare categoryId: number | null;

  @Column({ field: 'nome', type: DataType.STRING(45), allowNull: true })
  declare name: string | null;

  @Column({
    field: 'tempo_preparo_minutos',
    type: DataType.INTEGER.UNSIGNED,
    allowNull: true,
  })
  declare preparationTimeMinutes: number | null;

  @Column({ field: 'porcoes', type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare servings: number | null;

  @Column({ field: 'modo_preparo', type: DataType.TEXT, allowNull: false })
  declare instructions: string;

  @Column({ field: 'ingredientes', type: DataType.TEXT, allowNull: true })
  declare ingredients: string | null;

  @CreatedAt
  @Column({ field: 'criado_em', type: DataType.DATE, allowNull: false })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'alterado_em', type: DataType.DATE, allowNull: false })
  declare updatedAt: Date;

  @BelongsTo(() => User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  declare user?: User;

  @BelongsTo(() => Category, {
    foreignKey: 'categoryId',
    as: 'category',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare category?: Category | null;
}
