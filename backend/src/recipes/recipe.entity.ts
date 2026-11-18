import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Category } from '../categories/category.entity';
import { User } from '../users/user.entity';

@Entity('receitas')
@Index('fk_receitas_1_idx', ['idUsuarios'])
@Index('fk_receitas_2_idx', ['idCategorias'])
export class Recipe {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'id_usuarios', type: 'int', unsigned: true })
  idUsuarios!: number;

  @Column({ name: 'id_categorias', type: 'int', unsigned: true, nullable: true })
  idCategorias!: number | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  nome!: string | null;

  @Column({ name: 'tempo_preparo_minutos', type: 'int', unsigned: true, nullable: true })
  tempoPreparoMinutos!: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  porcoes!: number | null;

  @Column({ name: 'modo_preparo', type: 'text' })
  modoPreparo!: string;

  @Column({ type: 'text', nullable: true })
  ingredientes!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'datetime' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'alterado_em', type: 'datetime' })
  alteradoEm!: Date;

  @ManyToOne(() => User, (user) => user.receitas, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'id_usuarios', foreignKeyConstraintName: 'fk_receitas_1' })
  usuario!: User;

  @ManyToOne(() => Category, (category) => category.receitas, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'id_categorias', foreignKeyConstraintName: 'fk_receitas_2' })
  categoria!: Category | null;

  /** O schema original não possui defaults; as datas são geradas na aplicação. */
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
