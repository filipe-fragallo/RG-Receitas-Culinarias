import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Recipe } from '../recipes/recipe.entity';

@Entity('usuarios')
@Index('login_UNIQUE', ['login'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nome!: string | null;

  @Column({ type: 'varchar', length: 100 })
  login!: string;

  /** Hash bcrypt. Nunca é selecionado por padrão nem exposto nas respostas. */
  @Column({ type: 'varchar', length: 100, select: false })
  senha!: string;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'alterado_em', type: 'datetime' })
  alteradoEm!: Date;

  @OneToMany(() => Recipe, (recipe) => recipe.usuario)
  receitas!: Recipe[];

  /**
   * O schema original define criado_em/alterado_em como NOT NULL sem default.
   * Preenchemos os valores na aplicação para manter o banco intacto.
   */
  @BeforeInsert()
  protected setCreatedAt(): void {
    const now = new Date();
    this.criadoEm ??= now;
    this.alteradoEm = now;
  }

  @BeforeUpdate()
  protected setUpdatedAt(): void {
    this.alteradoEm = new Date();
  }
}
