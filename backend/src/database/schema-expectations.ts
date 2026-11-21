/**
 * Definição declarativa do schema produzido pelas migrations.
 *
 * Os valores usados aqui são os que o MySQL 8.4 devolve em
 * `information_schema` para as migrations já existentes. Eles permitem
 * comparar um banco legado com o resultado esperado sem executar DDL.
 */

export interface ExpectedColumn {
  name: string;
  /** `information_schema.columns.column_type`, ex.: `varchar(100)`. */
  columnType: string;
  nullable: boolean;
  autoIncrement?: boolean;
  /** Collation esperada para colunas de texto; `null` para numéricas/datas. */
  collation?: string | null;
}

export interface ExpectedIndex {
  name: string;
  columns: string[];
  unique: boolean;
  primary?: boolean;
}

export interface ExpectedForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface ExpectedTable {
  name: string;
  migration: string;
  engine: string;
  collation: string;
  columns: ExpectedColumn[];
  indexes: ExpectedIndex[];
  foreignKeys: ExpectedForeignKey[];
}

const UTF8 = 'utf8mb4_0900_ai_ci';

export const EXPECTED_TABLES: ExpectedTable[] = [
  {
    name: 'usuarios',
    migration: '001-create-usuarios',
    engine: 'InnoDB',
    collation: UTF8,
    columns: [
      { name: 'id', columnType: 'int unsigned', nullable: false, autoIncrement: true },
      { name: 'nome', columnType: 'varchar(100)', nullable: true, collation: UTF8 },
      { name: 'login', columnType: 'varchar(100)', nullable: false, collation: UTF8 },
      { name: 'senha', columnType: 'varchar(100)', nullable: false, collation: UTF8 },
      { name: 'criado_em', columnType: 'datetime', nullable: false, collation: null },
      { name: 'alterado_em', columnType: 'datetime', nullable: false, collation: null },
    ],
    indexes: [
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'login_UNIQUE', columns: ['login'], unique: true },
    ],
    foreignKeys: [],
  },
  {
    name: 'categorias',
    migration: '002-create-categorias',
    engine: 'InnoDB',
    collation: UTF8,
    columns: [
      { name: 'id', columnType: 'int unsigned', nullable: false, autoIncrement: true },
      { name: 'nome', columnType: 'varchar(100)', nullable: true, collation: UTF8 },
    ],
    indexes: [
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'nome_UNIQUE', columns: ['nome'], unique: true },
    ],
    foreignKeys: [],
  },
  {
    name: 'receitas',
    migration: '003-create-receitas',
    engine: 'InnoDB',
    collation: UTF8,
    columns: [
      { name: 'id', columnType: 'int unsigned', nullable: false, autoIncrement: true },
      { name: 'id_usuarios', columnType: 'int unsigned', nullable: false, collation: null },
      { name: 'id_categorias', columnType: 'int unsigned', nullable: true, collation: null },
      { name: 'nome', columnType: 'varchar(45)', nullable: true, collation: UTF8 },
      {
        name: 'tempo_preparo_minutos',
        columnType: 'int unsigned',
        nullable: true,
        collation: null,
      },
      { name: 'porcoes', columnType: 'int unsigned', nullable: true, collation: null },
      { name: 'modo_preparo', columnType: 'text', nullable: false, collation: UTF8 },
      { name: 'ingredientes', columnType: 'text', nullable: true, collation: UTF8 },
      { name: 'criado_em', columnType: 'datetime', nullable: false, collation: null },
      { name: 'alterado_em', columnType: 'datetime', nullable: false, collation: null },
    ],
    indexes: [
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      { name: 'fk_receitas_1_idx', columns: ['id_usuarios'], unique: false },
      { name: 'fk_receitas_2_idx', columns: ['id_categorias'], unique: false },
    ],
    foreignKeys: [
      {
        name: 'fk_receitas_1',
        column: 'id_usuarios',
        referencedTable: 'usuarios',
        referencedColumn: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      {
        name: 'fk_receitas_2',
        column: 'id_categorias',
        referencedTable: 'categorias',
        referencedColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    ],
  },
  {
    name: 'auth_sessions',
    migration: '004-create-auth-sessions',
    engine: 'InnoDB',
    collation: UTF8,
    columns: [
      { name: 'id', columnType: 'int unsigned', nullable: false, autoIncrement: true },
      { name: 'user_id', columnType: 'int unsigned', nullable: false, collation: null },
      {
        name: 'token_identifier_hash',
        columnType: 'varchar(64)',
        nullable: false,
        collation: UTF8,
      },
      { name: 'created_at', columnType: 'datetime', nullable: false, collation: null },
      { name: 'expires_at', columnType: 'datetime', nullable: false, collation: null },
      { name: 'revoked_at', columnType: 'datetime', nullable: true, collation: null },
    ],
    indexes: [
      { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
      {
        name: 'uq_auth_sessions_token_identifier_hash',
        columns: ['token_identifier_hash'],
        unique: true,
      },
      { name: 'idx_auth_sessions_user_id', columns: ['user_id'], unique: false },
      { name: 'idx_auth_sessions_expires_at', columns: ['expires_at'], unique: false },
    ],
    foreignKeys: [
      {
        name: 'auth_sessions_ibfk_1',
        column: 'user_id',
        referencedTable: 'usuarios',
        referencedColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    ],
  },
];

export function expectedTableByName(name: string): ExpectedTable | undefined {
  return EXPECTED_TABLES.find((table) => table.name === name);
}

export function requireExpectedTable(name: string): ExpectedTable {
  const expected = expectedTableByName(name);
  if (!expected) throw new Error(`Definição de schema ausente para ${name}`);
  return expected;
}

export function expectedMigrationNames(): string[] {
  return EXPECTED_TABLES.map((table) => table.migration);
}
