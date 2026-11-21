export interface CategoriaRow {
  id: number;
  nome: string | null;
}

export const CATEGORIAS_INICIAIS: CategoriaRow[] = [
  { id: 1, nome: 'Bolos e tortas doces' },
  { id: 2, nome: 'Carnes' },
  { id: 3, nome: 'Aves' },
  { id: 4, nome: 'Peixes e frutos do mar' },
  { id: 5, nome: 'Saladas, molhos e acompanhamentos' },
  { id: 6, nome: 'Sopas' },
  { id: 7, nome: 'Massas' },
  { id: 8, nome: 'Bebidas' },
  { id: 9, nome: 'Doces e sobremesas' },
  { id: 10, nome: 'Lanches' },
  { id: 11, nome: 'Prato Único' },
  { id: 12, nome: 'Light' },
  { id: 13, nome: 'Alimentação Saudável' },
];

/**
 * Nenhuma categoria original é sobrescrita silenciosamente. Um ID com outro
 * nome, ou um nome original com outro ID, é conflito e exige intervenção.
 */
export function findCategoryConflicts(existing: CategoriaRow[]): string[] {
  const conflicts: string[] = [];

  for (const expected of CATEGORIAS_INICIAIS) {
    const byId = existing.find((row) => row.id === expected.id);
    if (byId && byId.nome !== expected.nome) {
      conflicts.push(`id ${expected.id}: esperado "${expected.nome}", encontrado "${byId.nome}"`);
    }

    const byName = existing.find((row) => row.nome === expected.nome);
    if (byName && byName.id !== expected.id) {
      conflicts.push(
        `nome "${expected.nome}": esperado id ${expected.id}, encontrado ${byName.id}`,
      );
    }
  }

  return conflicts;
}

export function missingCategories(existing: CategoriaRow[]): CategoriaRow[] {
  const ids = new Set(existing.map((row) => row.id));
  return CATEGORIAS_INICIAIS.filter((category) => !ids.has(category.id));
}
