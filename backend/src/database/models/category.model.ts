import 'reflect-metadata';

import { Optional } from 'sequelize';
import {
  AutoIncrement,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

import { Recipe } from './recipe.model';

export interface CategoryAttributes {
  id: number;
  name: string | null;
}

export type CategoryCreationAttributes = Optional<CategoryAttributes, 'id' | 'name'>;

@Table({
  tableName: 'categorias',
  timestamps: false,
})
export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare id: number;

  @Column({ field: 'nome', type: DataType.STRING(100), allowNull: true })
  declare name: string | null;

  @HasMany(() => Recipe, { foreignKey: 'categoryId', as: 'recipes' })
  declare recipes?: Recipe[];
}
