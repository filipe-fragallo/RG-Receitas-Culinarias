import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/category.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { QueryRecipesDto } from './dto/query-recipes.dto';
import { PaginatedRecipesDto, RecipeResponseDto, RecipeStatsDto } from './dto/recipe-response.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe } from './recipe.entity';

const SORT_COLUMNS = {
  nome: 'receita.nome',
  criadoEm: 'receita.criadoEm',
  alteradoEm: 'receita.alteradoEm',
} as const;

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipesRepository: Repository<Recipe>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(userId: number, query: QueryRecipesDto): Promise<PaginatedRecipesDto> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 9, 1), 50);

    const queryBuilder = this.recipesRepository
      .createQueryBuilder('receita')
      .leftJoinAndSelect('receita.categoria', 'categoria')
      .where('receita.idUsuarios = :userId', { userId });

    if (query.search) {
      // LOCATE evita que % e _ digitados pelo usuário sejam interpretados
      // como curingas de LIKE. A collation do MySQL mantém a busca sem
      // diferença entre maiúsculas e minúsculas.
      queryBuilder.andWhere('LOCATE(:search, receita.nome) > 0', { search: query.search });
    }

    if (query.categoriaId) {
      queryBuilder.andWhere('receita.idCategorias = :categoriaId', {
        categoriaId: query.categoriaId,
      });
    }

    const sortColumn = SORT_COLUMNS[query.sortBy] ?? SORT_COLUMNS.criadoEm;
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';

    queryBuilder
      .orderBy(sortColumn, direction)
      .addOrderBy('receita.id', direction)
      .skip((page - 1) * limit)
      .take(limit);

    const [recipes, total] = await queryBuilder.getManyAndCount();

    return {
      data: recipes.map((recipe) => this.toResponse(recipe)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: number, id: number): Promise<RecipeResponseDto> {
    const recipe = await this.findOwnedRecipeOrFail(userId, id);
    return this.toResponse(recipe);
  }

  async create(userId: number, dto: CreateRecipeDto): Promise<RecipeResponseDto> {
    const category = await this.findCategoryOrFail(dto.categoriaId);

    const recipe = this.recipesRepository.create({
      idUsuarios: userId,
      idCategorias: category.id,
      categoria: category,
      nome: dto.nome,
      tempoPreparoMinutos: dto.tempoPreparoMinutos,
      porcoes: dto.porcoes,
      ingredientes: dto.ingredientes,
      modoPreparo: dto.modoPreparo,
    });

    const saved = await this.recipesRepository.save(recipe);
    return this.findOne(userId, saved.id);
  }

  async update(userId: number, id: number, dto: UpdateRecipeDto): Promise<RecipeResponseDto> {
    const hasChanges = Object.values(dto).some((value) => value !== undefined);

    if (!hasChanges) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }

    const recipe = await this.findOwnedRecipeOrFail(userId, id);

    if (dto.categoriaId !== undefined) {
      const category = await this.findCategoryOrFail(dto.categoriaId);
      recipe.idCategorias = category.id;
      recipe.categoria = category;
    }

    if (dto.nome !== undefined) recipe.nome = dto.nome;
    if (dto.tempoPreparoMinutos !== undefined) {
      recipe.tempoPreparoMinutos = dto.tempoPreparoMinutos;
    }
    if (dto.porcoes !== undefined) recipe.porcoes = dto.porcoes;
    if (dto.ingredientes !== undefined) recipe.ingredientes = dto.ingredientes;
    if (dto.modoPreparo !== undefined) recipe.modoPreparo = dto.modoPreparo;

    await this.recipesRepository.save(recipe);
    return this.findOne(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const recipe = await this.findOwnedRecipeOrFail(userId, id);
    await this.recipesRepository.remove(recipe);
  }

  async stats(userId: number): Promise<RecipeStatsDto> {
    const raw = await this.recipesRepository
      .createQueryBuilder('receita')
      .select('COUNT(receita.id)', 'totalReceitas')
      .addSelect('COUNT(DISTINCT receita.idCategorias)', 'categoriasUtilizadas')
      .addSelect('MAX(receita.alteradoEm)', 'atualizadaEm')
      .where('receita.idUsuarios = :userId', { userId })
      .getRawOne<{
        totalReceitas: string;
        categoriasUtilizadas: string;
        atualizadaEm: string | Date | null;
      }>();

    return {
      totalReceitas: Number(raw?.totalReceitas ?? 0),
      categoriasUtilizadas: Number(raw?.categoriasUtilizadas ?? 0),
      atualizadaEm: raw?.atualizadaEm ? new Date(raw.atualizadaEm) : null,
    };
  }

  /**
   * A cláusula id_usuarios é a barreira de autorização: receitas de outros
   * usuários simplesmente não são encontradas, sem revelar sua existência.
   */
  private async findOwnedRecipeOrFail(userId: number, id: number): Promise<Recipe> {
    const recipe = await this.recipesRepository.findOne({
      where: { id, idUsuarios: userId },
      relations: { categoria: true },
    });

    if (!recipe) {
      throw new NotFoundException('Receita não encontrada.');
    }

    return recipe;
  }

  private async findCategoryOrFail(categoryId: number): Promise<Category> {
    const category = await this.categoriesService.findById(categoryId);

    if (!category) {
      throw new BadRequestException('Categoria inválida. Selecione uma categoria existente.');
    }

    return category;
  }

  private toResponse(recipe: Recipe): RecipeResponseDto {
    return {
      id: recipe.id,
      nome: recipe.nome,
      categoria: recipe.categoria ? { id: recipe.categoria.id, nome: recipe.categoria.nome } : null,
      tempoPreparoMinutos: recipe.tempoPreparoMinutos,
      porcoes: recipe.porcoes,
      ingredientes: recipe.ingredientes,
      modoPreparo: recipe.modoPreparo,
      criadoEm: recipe.criadoEm,
      alteradoEm: recipe.alteradoEm,
    };
  }
}
