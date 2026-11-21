import { describe, expect, it } from 'vitest';

import {
  hasErrors,
  validateLoginForm,
  validateRecipeForm,
  validateRegisterForm,
} from './validation';

describe('form validation', () => {
  it('requires login and password in the login form', () => {
    expect(validateLoginForm({ login: '  ', password: '' })).toEqual({
      login: 'Informe seu login.',
      password: 'Informe sua senha.',
    });
  });

  it('validates name, login and password confirmation on registration', () => {
    const errors = validateRegisterForm({
      name: 'Ma',
      login: 'login inválido!',
      password: '123',
      confirmPassword: '456',
    });

    expect(errors.name).toContain('no mínimo 3');
    expect(errors.login).toContain('apenas letras, números');
    expect(errors.password).toContain('no mínimo 8');
    expect(errors.confirmPassword).toBe('As senhas não conferem.');
  });

  it('accepts a valid registration', () => {
    expect(
      validateRegisterForm({
        name: 'Maria Silva',
        login: 'maria.silva',
        password: 'Senha@123',
        confirmPassword: 'Senha@123',
      }),
    ).toEqual({});
  });

  it('validates recipe limits', () => {
    const errors = validateRecipeForm({
      name: '',
      categoryId: '',
      preparationTimeMinutes: '0',
      servings: '0',
      ingredients: ' ',
      instructions: '',
    });

    expect(errors.name).toBe('Informe o nome da receita.');
    expect(errors.categoryId).toBe('Selecione uma categoria.');
    expect(errors.preparationTimeMinutes).toContain('maior que zero');
    expect(errors.servings).toContain('maior que zero');
    expect(errors.ingredients).toBe('Informe os ingredientes.');
    expect(errors.instructions).toBe('Informe o modo de preparo.');
    expect(hasErrors(errors)).toBe(true);
  });

  it('accepts a valid recipe', () => {
    expect(
      validateRecipeForm({
        name: 'Bolo de cenoura',
        categoryId: '1',
        preparationTimeMinutes: '45',
        servings: '8',
        ingredients: '3 cenouras\n3 ovos',
        instructions: 'Bata e asse.',
      }),
    ).toEqual({});
    expect(hasErrors({})).toBe(false);
  });
});
