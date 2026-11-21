import { EXPECTED_TABLES, ExpectedTable } from './schema-expectations';
import { TableSnapshot, compareSchema, compareTable, pendingNames } from './schema-inspection';

const USUARIOS = EXPECTED_TABLES.find((table) => table.name === 'usuarios') as ExpectedTable;
const RECEITAS = EXPECTED_TABLES.find((table) => table.name === 'receitas') as ExpectedTable;
const COLLATION = 'utf8mb4_0900_ai_ci';

function snapshot(table: ExpectedTable): TableSnapshot {
  return {
    name: table.name,
    engine: table.engine,
    collation: COLLATION,
    rowCount: 0,
    columns: table.columns.map((column) => ({
      name: column.name,
      columnType: column.columnType,
      isNullable: column.nullable,
      columnDefault: null,
      extra: column.autoIncrement ? 'auto_increment' : '',
      collation: column.collation ?? null,
    })),
    indexes: table.indexes.map((index) => ({
      name: index.name,
      unique: index.unique,
      columns: index.columns.map((name, position) => ({
        name,
        sequence: position + 1,
        order: 'A',
      })),
    })),
    foreignKeys: table.foreignKeys.map((key) => ({ ...key })),
  };
}

describe('inspecao e comparacao de schema', () => {
  it('considera equivalente uma tabela que corresponde integralmente a migration', () => {
    const comparison = compareTable(USUARIOS, snapshot(USUARIOS));

    expect(comparison.present).toBe(true);
    expect(comparison.equivalent).toBe(true);
    expect(comparison.repairable).toBe(false);
    expect(comparison.differences).toEqual([]);
  });

  it('identifica indice ausente como reparavel sem exclusao', () => {
    const actual = snapshot(USUARIOS);
    actual.indexes = actual.indexes.filter((index) => index.name !== 'login_UNIQUE');

    const comparison = compareTable(USUARIOS, actual);

    expect(comparison.repairable).toBe(true);
    expect(comparison.differences).toHaveLength(1);
    const difference = comparison.differences[0];
    expect(difference.kind).toBe('index');
    expect(difference.message).toBe('índice ausente: login_UNIQUE');
    expect(difference.repair?.type).toBe('index');
    expect(difference.repair?.index?.name).toBe('login_UNIQUE');
  });

  it('bloqueia indice existente com regra de unicidade divergente', () => {
    const actual = snapshot(USUARIOS);
    const index = actual.indexes.find((item) => item.name === 'login_UNIQUE');
    if (!index) throw new Error('índice de teste ausente');
    index.unique = false;

    const comparison = compareTable(USUARIOS, actual);

    expect(comparison.repairable).toBe(false);
    expect(comparison.differences).toEqual([
      expect.objectContaining({ kind: 'index', blocking: true }),
    ]);
  });

  it('valida ordem das colunas do indice, nao apenas o nome', () => {
    const actual = snapshot(
      EXPECTED_TABLES.find((table) => table.name === 'receitas') as ExpectedTable,
    );
    const index = actual.indexes.find((item) => item.name === 'fk_receitas_1_idx');
    if (!index) throw new Error('índice de teste ausente');
    index.columns[0].name = 'id_categorias';

    expect(compareTable(RECEITAS, actual).repairable).toBe(false);
  });

  it('bloqueia foreign key com regras divergentes', () => {
    const actual = snapshot(RECEITAS);
    const key = actual.foreignKeys.find((item) => item.name === 'fk_receitas_1');
    if (!key) throw new Error('FK de teste ausente');
    key.onDelete = 'CASCADE';

    const comparison = compareTable(RECEITAS, actual);

    expect(comparison.repairable).toBe(false);
    expect(comparison.differences).toEqual([
      expect.objectContaining({ kind: 'foreign-key', blocking: true }),
    ]);
  });

  it('bloqueia tipo, nulabilidade, collation e AUTO_INCREMENT divergentes', () => {
    const actual = snapshot(USUARIOS);
    actual.columns[1].columnType = 'varchar(50)';
    actual.columns[1].isNullable = false;
    actual.columns[1].collation = 'latin1_swedish_ci';
    actual.columns[0].extra = '';

    const kinds = compareTable(USUARIOS, actual).differences.map((item) => item.kind);

    expect(kinds).toEqual(expect.arrayContaining(['column', 'column', 'column', 'column']));
  });

  it('bloqueia indice duplicado com outro nome', () => {
    const actual = snapshot(USUARIOS);
    actual.indexes.push({
      name: 'login_idx_copia',
      unique: true,
      columns: [{ name: 'login', sequence: 1, order: 'A' }],
    });

    const comparison = compareTable(USUARIOS, actual);

    expect(comparison.equivalent).toBe(false);
    expect(comparison.repairable).toBe(false);
    expect(comparison.differences).toEqual([
      expect.objectContaining({ kind: 'index', blocking: true }),
    ]);
  });

  it('bloqueia indices alheios para nao declarar equivalencia incompleta', () => {
    const actual = snapshot(USUARIOS);
    actual.indexes.push({
      name: 'idx_customizado',
      unique: false,
      columns: [{ name: 'nome', sequence: 1, order: 'A' }],
    });

    const comparison = compareTable(USUARIOS, actual);

    expect(comparison.equivalent).toBe(false);
    expect(comparison.repairable).toBe(false);
    expect(comparison.differences).toEqual([
      expect.objectContaining({ kind: 'unexpected-index', blocking: true }),
    ]);
  });

  it('reporta tabela ausente sem reparo automatico', () => {
    const comparison = compareTable(USUARIOS, undefined);

    expect(comparison.present).toBe(false);
    expect(comparison.repairable).toBe(false);
  });

  it('calcula pendencias a partir do historico somente leitura', () => {
    expect(
      pendingNames(['001-create-usuarios'], ['001-create-usuarios', '002-create-categorias']),
    ).toEqual(['002-create-categorias']);
  });

  it('compara todas as tabelas declaradas', () => {
    const report = compareSchema({
      schema: 'teste',
      tables: [],
      history: { migrations: [], seeders: [] },
    });

    expect(report.map((item) => item.table)).toEqual(EXPECTED_TABLES.map((item) => item.name));
    expect(report.every((item) => !item.present)).toBe(true);
  });
});
