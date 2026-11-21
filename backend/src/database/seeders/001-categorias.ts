import { QueryInterface, QueryTypes } from 'sequelize';

import {
  CategoriaRow,
  CATEGORIAS_INICIAIS,
  findCategoryConflicts,
  missingCategories,
} from './categorias-data';

/**
 * Carga inicial com as 13 categorias do script original do desafio.
 * Somente IDs ausentes são inseridos; conflitos de ID/nome são bloqueantes.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const existing = await context.sequelize.query<CategoriaRow>(
    'SELECT id, nome FROM categorias ORDER BY id',
    { type: QueryTypes.SELECT },
  );

  const conflicts = findCategoryConflicts(existing);
  if (conflicts.length) {
    throw new Error(
      'Seeder de categorias interrompido: há categorias originais divergentes.\n' +
        `${conflicts.map((item) => `- ${item}`).join('\n')}\n` +
        'Nenhuma categoria foi sobrescrita. Corrija os conflitos manualmente.',
    );
  }

  const missing = missingCategories(existing);
  if (missing.length) {
    await context.bulkInsert(
      'categorias',
      missing.map((category) => ({ ...category })),
    );
  }
}

/**
 * Rollback deliberadamente não destrutivo.
 *
 * A tabela original não tem colunas de auditoria que permitam provar que uma
 * categoria veio deste seeder; além disso, a FK de `receitas` usa ON DELETE
 * CASCADE. Mesmo verificando vínculos antes do DELETE, uma receita poderia ser
 * inserida entre a verificação e a exclusão. Por isso nenhuma categoria é
 * removida aqui: `db:down`/`db:reset` continuam revertendo o schema por meio
 * das migrations, com confirmação explícita, sem depender deste seeder.
 */
export function down({ context: _context }: { context: QueryInterface }): Promise<void> {
  // Intencionalmente vazio: ver comentário acima.
  return Promise.resolve();
}

export { CATEGORIAS_INICIAIS };
