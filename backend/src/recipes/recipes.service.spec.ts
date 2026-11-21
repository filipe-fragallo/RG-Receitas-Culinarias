import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CategoriesService } from '../categories/categories.service';
import { Category } from '../database/models/category.model';
import { Recipe } from '../database/models/recipe.model';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { RecipesService } from './recipes.service';

interface RecipeModelMock {
  create: jest.Mock;
  findOne: jest.Mock;
  findAndCountAll: jest.Mock;
}

interface CategoriesServiceMock {
  findById: jest.Mock;
  findAll: jest.Mock;
}

interface FakeRecipe {
  id: number;
  userId: number;
  categoryId: number | null;
  name: string | null;
  preparationTimeMinutes: number | null;
  servings: number | null;
  ingredients: string | null;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
  category: Category | null;
  save: jest.Mock;
  destroy: jest.Mock;
}

const category = { id: 1, name: 'Bolos e tortas doces' } as Category;

const makeRecipe = (overrides: Partial<FakeRecipe> = {}): FakeRecipe => {
  const recipe = {
    id: 10,
    userId: 7,
    categoryId: 1,
    name: 'Bolo de cenoura',
    preparationTimeMinutes: 45,
    servings: 8,
    ingredients: '3 cenouras\n3 ovos',
    instructions: 'Bata e asse.',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    category,
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  return Object.assign(recipe, overrides);
};

const makeCreateDto = (overrides: Partial<CreateRecipeDto> = {}): CreateRecipeDto => ({
  name: 'Bolo de cenoura',
  categoryId: 1,
  preparationTimeMinutes: 45,
  servings: 8,
  ingredients: '3 cenouras\n3 ovos',
  instructions: 'Bata e asse.',
  ...overrides,
});

const CATEGORY_INCLUDE = {
  model: Category,
  as: 'category',
  attributes: ['id', 'name'],
  required: false,
};

describe('RecipesService', () => {
  let service: RecipesService;
  let recipeModel: RecipeModelMock;
  let categoriesService: CategoriesServiceMock;

  beforeEach(() => {
    recipeModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAndCountAll: jest.fn(),
    };
    categoriesService = {
      findById: jest.fn().mockResolvedValue(category),
      findAll: jest.fn(),
    };

    service = new RecipesService(
      recipeModel as unknown as typeof Recipe,
      categoriesService as unknown as CategoriesService,
    );
  });

  describe('create', () => {
    it('sets the owner from the authenticated user', async () => {
      const recipe = makeRecipe();
      recipeModel.create.mockResolvedValue(recipe);
      recipeModel.findOne.mockResolvedValue(recipe);

      const result = await service.create(7, makeCreateDto());

      expect(categoriesService.findById).toHaveBeenCalledWith(1);
      expect(recipeModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          categoryId: 1,
          name: 'Bolo de cenoura',
        }),
      );
      expect(recipeModel.findOne).toHaveBeenCalledWith({
        where: { id: 10, userId: 7 },
        include: [CATEGORY_INCLUDE],
      });
      expect(result.id).toBe(10);
      expect(result.category?.name).toBe('Bolos e tortas doces');
    });

    it('rejects a nonexistent category before saving', async () => {
      categoriesService.findById.mockResolvedValue(null);

      await expect(service.create(7, makeCreateDto({ categoryId: 999 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(recipeModel.create).not.toHaveBeenCalled();
    });
  });

  describe('listing', () => {
    it('applies search, filtering, sorting and pagination in the database', async () => {
      recipeModel.findAndCountAll.mockResolvedValue({ rows: [makeRecipe()], count: 1 });

      const result = await service.findAll(7, {
        page: 2,
        limit: 5,
        search: 'bolo',
        categoryId: 1,
        sortBy: 'name',
        order: 'asc',
      });

      expect(recipeModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5,
          distinct: true,
          order: [
            ['name', 'ASC'],
            ['id', 'ASC'],
          ],
          include: [CATEGORY_INCLUDE],
        }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
      expect(result.data[0].id).toBe(10);
    });
  });

  describe('owner authorization', () => {
    it("does not find another user's recipe and uses the owner id in the query", async () => {
      recipeModel.findOne.mockResolvedValue(null);

      await expect(service.findOne(8, 10)).rejects.toBeInstanceOf(NotFoundException);
      expect(recipeModel.findOne).toHaveBeenCalledWith({
        where: { id: 10, userId: 8 },
        include: [CATEGORY_INCLUDE],
      });
    });

    it("blocks editing another user's recipe", async () => {
      recipeModel.findOne.mockResolvedValue(null);

      await expect(service.update(8, 10, { name: 'Alteração indevida' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("blocks deleting another user's recipe", async () => {
      recipeModel.findOne.mockResolvedValue(null);

      await expect(service.remove(8, 10)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects a body with no fields', async () => {
      await expect(service.update(7, 10, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(recipeModel.findOne).not.toHaveBeenCalled();
    });

    it("updates only the authenticated user's recipe", async () => {
      const recipe = makeRecipe();
      recipeModel.findOne.mockResolvedValue(recipe);

      const result = await service.update(7, 10, { name: 'Novo nome', servings: 10 });

      expect(recipe.name).toBe('Novo nome');
      expect(recipe.servings).toBe(10);
      expect(recipe.save.mock.calls).toHaveLength(1);
      expect(result.name).toBe('Novo nome');
      expect(recipeModel.findOne).toHaveBeenCalledWith({
        where: { id: 10, userId: 7 },
        include: [CATEGORY_INCLUDE],
      });
    });

    it('validates the new category when editing', async () => {
      const recipe = makeRecipe();
      recipeModel.findOne.mockResolvedValue(recipe);
      categoriesService.findById.mockResolvedValue(null);

      await expect(service.update(7, 10, { categoryId: 999 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(recipe.save.mock.calls).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('removes the found recipe for the user', async () => {
      const recipe = makeRecipe();
      recipeModel.findOne.mockResolvedValue(recipe);

      await service.remove(7, 10);

      expect(recipe.destroy.mock.calls).toHaveLength(1);
    });
  });

  describe('stats', () => {
    it('converts database aggregates to numbers', async () => {
      recipeModel.findOne.mockResolvedValue({
        totalRecipes: '3',
        categoriesUsed: '2',
        lastUpdatedAt: '2026-01-01 10:00:00',
      });

      const stats = await service.stats(7);

      expect(stats.totalRecipes).toBe(3);
      expect(stats.categoriesUsed).toBe(2);
      expect(stats.lastUpdatedAt).toEqual(new Date('2026-01-01 10:00:00'));
    });
  });
});
