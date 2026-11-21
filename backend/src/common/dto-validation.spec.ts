import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from '../auth/dto/login.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateRecipeDto } from '../recipes/dto/create-recipe.dto';
import { QueryRecipesDto } from '../recipes/dto/query-recipes.dto';

const messagesOf = (errors: Awaited<ReturnType<typeof validate>>): string[] =>
  errors.flatMap((error) => Object.values(error.constraints ?? {}));

describe('DTO validation', () => {
  it('accepts a valid registration and normalizes the login', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: '  Maria Silva  ',
      login: '  MARIA.SILVA ',
      password: 'Senha@123',
      confirmPassword: 'Senha@123',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Maria Silva');
    expect(dto.login).toBe('maria.silva');
  });

  it('rejects mismatched and too-short passwords', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Maria Silva',
      login: 'maria.silva',
      password: '123',
      confirmPassword: '456',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('As senhas não conferem');
    expect(messages).toContain('no mínimo 8 caracteres');
  });

  it('rejects a login with disallowed characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Maria Silva',
      login: 'maria silva!',
      password: 'Senha@123',
      confirmPassword: 'Senha@123',
    });

    expect(messagesOf(await validate(dto)).join(' ')).toContain('apenas letras, números');
  });

  it('requires login and password in the login DTO', async () => {
    const dto = plainToInstance(LoginDto, { login: '', password: '' });
    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('login é obrigatório');
    expect(messages).toContain('senha é obrigatória');
  });

  it('rejects a recipe outside database limits', async () => {
    const dto = plainToInstance(CreateRecipeDto, {
      name: 'x'.repeat(46),
      categoryId: 0,
      preparationTimeMinutes: 0,
      servings: 0,
      ingredients: '',
      instructions: '',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('entre 1 e 45 caracteres');
    expect(messages).toContain('categoria válida');
    expect(messages).toContain('maior que zero');
  });

  it('converts and validates query parameters', async () => {
    const dto = plainToInstance(QueryRecipesDto, {
      page: '2',
      limit: '9',
      categoryId: '3',
      sortBy: 'name',
      order: 'asc',
      search: '  bolo  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(9);
    expect(dto.categoryId).toBe(3);
    expect(dto.search).toBe('bolo');
  });

  it('rejects a disallowed sort field', async () => {
    const dto = plainToInstance(QueryRecipesDto, {
      sortBy: 'password',
      order: 'aleatoria',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('Ordenação inválida');
    expect(messages).toContain('Direção de ordenação inválida');
  });
});
