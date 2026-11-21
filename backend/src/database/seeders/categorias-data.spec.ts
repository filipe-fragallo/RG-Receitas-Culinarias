import {
  CATEGORIAS_INICIAIS,
  CategoriaRow,
  findCategoryConflicts,
  missingCategories,
} from './categorias-data';

describe('dados das categorias iniciais', () => {
  it('contém exatamente as 13 categorias com IDs estáveis', () => {
    expect(CATEGORIAS_INICIAIS).toHaveLength(13);
    expect(CATEGORIAS_INICIAIS.map((item) => item.id)).toEqual(
      Array.from({ length: 13 }, (_, index) => index + 1),
    );
  });

  it('não aponta conflito quando os IDs e nomes originais conferem', () => {
    const existing: CategoriaRow[] = CATEGORIAS_INICIAIS.map((item) => ({ ...item }));
    existing.push({ id: 99, nome: 'Categoria do usuario' });

    expect(findCategoryConflicts(existing)).toEqual([]);
    expect(missingCategories(existing)).toEqual([]);
  });

  it('informa ID original com nome divergente', () => {
    const existing = CATEGORIAS_INICIAIS.map((item) => ({ ...item }));
    existing[1] = { id: 2, nome: 'Carne bovina' };

    expect(findCategoryConflicts(existing)).toEqual([
      'id 2: esperado "Carnes", encontrado "Carne bovina"',
    ]);
  });

  it('informa nome original com ID divergente', () => {
    const existing = CATEGORIAS_INICIAIS.map((item) => ({ ...item }));
    existing[2] = { id: 2, nome: 'Aves' };

    expect(findCategoryConflicts(existing)).toEqual(['nome "Aves": esperado id 3, encontrado 2']);
  });

  it('insere somente as categorias ausentes', () => {
    const existing = CATEGORIAS_INICIAIS.slice(0, 3);

    expect(missingCategories(existing).map((item) => item.id)).toEqual(
      CATEGORIAS_INICIAIS.slice(3).map((item) => item.id),
    );
  });
});
