import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Order, WhereOptions, col, fn, literal, where } from 'sequelize';
import type { IncludeOptions } from 'sequelize';

import { CategoriesService } from '../categories/categories.service';
import { Category } from '../database/models/category.model';
import { Recipe } from '../database/models/recipe.model';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { QueryRecipesDto } from './dto/query-recipes.dto';
import { PaginatedRecipesDto, RecipeResponseDto, RecipeStatsDto } from './dto/recipe-response.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

const SORT_ATTRIBUTES = {
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

const CATEGORY_INCLUDE: IncludeOptions = {
  model: Category,
  as: 'category',
  attributes: ['id', 'name'],
  required: false,
};

interface StatsRow {
  totalRecipes: number | string | null;
  categoriesUsed: number | string | null;
  lastUpdatedAt: Date | string | null;
}

@Injectable()
export class RecipesService {
  constructor(
    @InjectModel(Recipe) private readonly recipeModel: typeof Recipe,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(userId: number, query: QueryRecipesDto): Promise<PaginatedRecipesDto> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 9, 1), 50);

    const conditions: WhereOptions<Recipe>[] = [{ userId }];

    if (query.search) {
      // LOCATE evita que % e _ digitados pelo usuário sejam interpretados
      // como curingas de LIKE. A collation do MySQL mantém a busca
      // sem diferença entre maiúsculas e minúsculas.
      conditions.push(where(fn('LOCATE', query.search, col('Recipe.nome')), { [Op.gt]: 0 }));
    }

    if (query.categoryId) {
      conditions.push({ categoryId: query.categoryId });
    }

    const sortAttribute = SORT_ATTRIBUTES[query.sortBy] ?? SORT_ATTRIBUTES.createdAt;
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const order: Order = [
      [sortAttribute, direction],
      ['id', direction],
    ];

    const { rows, count } = await this.recipeModel.findAndCountAll({
      where: { [Op.and]: conditions },
      include: [CATEGORY_INCLUDE],
      order,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    const total = Array.isArray(count) ? count.length : count;

    return {
      data: rows.map((recipe) => this.toResponse(recipe)),
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
    const category = await this.findCategoryOrFail(dto.categoryId);

    const recipe = await this.recipeModel.create({
      userId,
      categoryId: category.id,
      name: dto.name,
      preparationTimeMinutes: dto.preparationTimeMinutes,
      servings: dto.servings,
      ingredients: dto.ingredients,
      instructions: dto.instructions,
    });

    return this.findOne(userId, recipe.id);
  }

  async update(userId: number, id: number, dto: UpdateRecipeDto): Promise<RecipeResponseDto> {
    const hasChanges = Object.values(dto).some((value) => value !== undefined);

    if (!hasChanges) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }

    const recipe = await this.findOwnedRecipeOrFail(userId, id);

    if (dto.categoryId !== undefined) {
      const category = await this.findCategoryOrFail(dto.categoryId);
      recipe.categoryId = category.id;
    }

    if (dto.name !== undefined) recipe.name = dto.name;
    if (dto.preparationTimeMinutes !== undefined) {
      recipe.preparationTimeMinutes = dto.preparationTimeMinutes;
    }
    if (dto.servings !== undefined) recipe.servings = dto.servings;
    if (dto.ingredients !== undefined) recipe.ingredients = dto.ingredients;
    if (dto.instructions !== undefined) recipe.instructions = dto.instructions;

    await recipe.save();
    return this.findOne(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const recipe = await this.findOwnedRecipeOrFail(userId, id);
    await recipe.destroy();
  }

  async stats(userId: number): Promise<RecipeStatsDto> {
    const raw = (await this.recipeModel.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'totalRecipes'],
        [literal('COUNT(DISTINCT `id_categorias`)'), 'categoriesUsed'],
        [fn('MAX', col('alterado_em')), 'lastUpdatedAt'],
      ],
      where: { userId },
      raw: true,
    })) as unknown as StatsRow | null;

    return {
      totalRecipes: Number(raw?.totalRecipes ?? 0),
      categoriesUsed: Number(raw?.categoriesUsed ?? 0),
      lastUpdatedAt: raw?.lastUpdatedAt ? new Date(raw.lastUpdatedAt) : null,
    };
  }

  /**
   * A cláusula id_usuarios é a barreira de autorização: receitas de outros
   * usuários simplesmente não são encontradas, sem revelar sua existência.
   */
  private async findOwnedRecipeOrFail(userId: number, id: number): Promise<Recipe> {
    const recipe = await this.recipeModel.findOne({
      where: { id, userId },
      include: [CATEGORY_INCLUDE],
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
      name: recipe.name,
      category: recipe.category ? { id: recipe.category.id, name: recipe.category.name } : null,
      preparationTimeMinutes: recipe.preparationTimeMinutes,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };
  }
}
