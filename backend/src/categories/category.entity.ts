import { Entity, Index, OneToMany, PrimaryGeneratedColumn, Column } from 'typeorm';

import { Recipe } from '../recipes/recipe.entity';

@Entity('categorias')
@Index('nome_UNIQUE', ['nome'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nome!: string | null;

  @OneToMany(() => Recipe, (recipe) => recipe.categoria)
  receitas!: Recipe[];
}
