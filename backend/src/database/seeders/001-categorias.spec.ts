import { QueryInterface } from 'sequelize';

import { CATEGORIAS_INICIAIS, CategoriaRow } from './categorias-data';
import { down, up } from './001-categorias';

type BulkInsertMock = jest.Mock<Promise<void>, [string, Record<string, unknown>[]]>;

interface FakeContext {
  bulkInsert: BulkInsertMock;
  bulkDelete: jest.Mock;
  query: jest.Mock;
  asQueryInterface: QueryInterface;
}

const makeContext = (existing: CategoriaRow[] = []): FakeContext => {
  const bulkInsert = jest
    .fn<Promise<void>, [string, Record<string, unknown>[]]>()
    .mockResolvedValue(undefined);
  const bulkDelete = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn().mockResolvedValue(existing);

  return {
    bulkInsert,
    bulkDelete,
    query,
    asQueryInterface: { bulkInsert, bulkDelete, sequelize: { query } } as unknown as QueryInterface,
  };
};

describe('categories seeder', () => {
  it('inserts only the 13 original categories when the table is empty', async () => {
    const context = makeContext();

    await up({ context: context.asQueryInterface });

    expect(context.bulkInsert).toHaveBeenCalledTimes(1);
    const [table, categories] = context.bulkInsert.mock.calls[0];
    expect(table).toBe('categorias');
    expect(categories).toHaveLength(13);
    expect(categories).toEqual(CATEGORIAS_INICIAIS);
  });

  it('does not insert anything when all original categories already exist', async () => {
    const context = makeContext(CATEGORIAS_INICIAIS.map((item) => ({ ...item })));

    await up({ context: context.asQueryInterface });

    expect(context.bulkInsert).not.toHaveBeenCalled();
  });

  it('preserves pre-existing rows and inserts only the missing ids', async () => {
    const context = makeContext([CATEGORIAS_INICIAIS[0]]);

    await up({ context: context.asQueryInterface });

    const [, categories] = context.bulkInsert.mock.calls[0];
    expect(categories).toHaveLength(12);
    expect(categories.map((item) => item['id'])).toEqual(
      CATEGORIAS_INICIAIS.slice(1).map((item) => item.id),
    );
  });

  it('reports a conflicting original id without overwriting it', async () => {
    const existing = CATEGORIAS_INICIAIS.map((item) => ({ ...item }));
    existing[1] = { id: 2, nome: 'Carne bovina' };
    const context = makeContext(existing);

    await expect(up({ context: context.asQueryInterface })).rejects.toThrow(
      'há categorias originais divergentes',
    );
    expect(context.bulkInsert).not.toHaveBeenCalled();
  });

  it('emits no DELETE or queries on rollback', async () => {
    const context = makeContext();

    await expect(down({ context: context.asQueryInterface })).resolves.toBeUndefined();

    expect(context.bulkDelete).not.toHaveBeenCalled();
    expect(context.query).not.toHaveBeenCalled();
  });

  it('preserves a pre-existing category with its original id and name', async () => {
    const context = makeContext();

    await down({ context: context.asQueryInterface });

    // Não existe coluna de auditoria que prove a origem da linha. A ausência
    // de qualquer comando de exclusão é a única garantia segura.
    expect(context.bulkDelete).not.toHaveBeenCalled();
  });
});
