import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/category.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { Recipe } from './recipe.entity';
import { RecipesService } from './recipes.service';

interface RepositoryMock {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  remove: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface CategoriesServiceMock {
  findById: jest.Mock;
  findAll: jest.Mock;
}

const category: Category = { id: 1, nome: 'Bolos e tortas doces', receitas: [] };

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe =>
  Object.assign(new Recipe(), {
    id: 10,
    idUsuarios: 7,
    idCategorias: 1,
    nome: 'Bolo de cenoura',
    tempoPreparoMinutos: 45,
    porcoes: 8,
    ingredientes: '3 cenouras\n3 ovos',
    modoPreparo: 'Bata e asse.',
    criadoEm: new Date('2026-01-01T10:00:00.000Z'),
    alteradoEm: new Date('2026-01-01T10:00:00.000Z'),
    usuario: undefined as unknown as Recipe['usuario'],
    categoria: category,
    ...overrides,
  });

const makeCreateDto = (overrides: Partial<CreateRecipeDto> = {}): CreateRecipeDto => ({
  nome: 'Bolo de cenoura',
  categoriaId: 1,
  tempoPreparoMinutos: 45,
  porcoes: 8,
  ingredientes: '3 cenouras\n3 ovos',
  modoPreparo: 'Bata e asse.',
  ...overrides,
});

describe('RecipesService', () => {
  let service: RecipesService;
  let repository: RepositoryMock;
  let categoriesService: CategoriesServiceMock;

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<Recipe>) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    categoriesService = {
      findById: jest.fn().mockResolvedValue(category),
      findAll: jest.fn(),
    };

    service = new RecipesService(
      repository as unknown as Repository<Recipe>,
      categoriesService as unknown as CategoriesService,
    );
  });

  describe('create', () => {
    it('define o dono a partir do usuário autenticado', async () => {
      repository.save.mockResolvedValue(makeRecipe());
      repository.findOne.mockResolvedValue(makeRecipe());

      const result = await service.create(7, makeCreateDto());

      expect(categoriesService.findById).toHaveBeenCalledWith(1);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idUsuarios: 7,
          idCategorias: 1,
          nome: 'Bolo de cenoura',
        }),
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 10, idUsuarios: 7 },
        relations: { categoria: true },
      });
      expect(result.id).toBe(10);
      expect(result.categoria?.nome).toBe('Bolos e tortas doces');
    });

    it('rejeita categoria inexistente antes de salvar', async () => {
      categoriesService.findById.mockResolvedValue(null);

      await expect(service.create(7, makeCreateDto({ categoriaId: 999 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('autorização por proprietário', () => {
    it('não encontra receita de outro usuário e usa o id do dono na query', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(8, 10)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 10, idUsuarios: 8 },
        relations: { categoria: true },
      });
    });

    it('bloqueia edição de receita de outro usuário', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update(8, 10, { nome: 'Alteração indevida' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('bloqueia exclusão de receita de outro usuário', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove(8, 10)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejeita corpo sem nenhum campo', async () => {
      await expect(service.update(7, 10, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('atualiza apenas a receita do usuário autenticado', async () => {
      const recipe = makeRecipe();
      repository.findOne.mockResolvedValue(recipe);
      repository.save.mockImplementation((value: Recipe) => Promise.resolve(value));

      const result = await service.update(7, 10, { nome: 'Novo nome', porcoes: 10 });

      expect(recipe.nome).toBe('Novo nome');
      expect(recipe.porcoes).toBe(10);
      expect(repository.save).toHaveBeenCalledWith(recipe);
      expect(result.nome).toBe('Novo nome');
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 10, idUsuarios: 7 },
        relations: { categoria: true },
      });
    });

    it('valida a nova categoria ao editar', async () => {
      repository.findOne.mockResolvedValue(makeRecipe());
      categoriesService.findById.mockResolvedValue(null);

      await expect(service.update(7, 10, { categoriaId: 999 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('remove a receita encontrada para o usuário', async () => {
      const recipe = makeRecipe();
      repository.findOne.mockResolvedValue(recipe);
      repository.remove.mockResolvedValue(recipe);

      await service.remove(7, 10);

      expect(repository.remove).toHaveBeenCalledWith(recipe);
    });
  });
});
