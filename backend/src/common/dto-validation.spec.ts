import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from '../auth/dto/login.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateRecipeDto } from '../recipes/dto/create-recipe.dto';
import { QueryRecipesDto } from '../recipes/dto/query-recipes.dto';

const messagesOf = (errors: Awaited<ReturnType<typeof validate>>): string[] =>
  errors.flatMap((error) => Object.values(error.constraints ?? {}));

describe('Validação dos DTOs', () => {
  it('aceita um cadastro válido e normaliza o login', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: '  Maria Silva  ',
      login: '  MARIA.SILVA ',
      senha: 'Senha@123',
      confirmarSenha: 'Senha@123',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.nome).toBe('Maria Silva');
    expect(dto.login).toBe('maria.silva');
  });

  it('rejeita senhas diferentes e senha curta', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: 'Maria Silva',
      login: 'maria.silva',
      senha: '123',
      confirmarSenha: '456',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('As senhas não conferem');
    expect(messages).toContain('no mínimo 8 caracteres');
  });

  it('rejeita login com caracteres não permitidos', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: 'Maria Silva',
      login: 'maria silva!',
      senha: 'Senha@123',
      confirmarSenha: 'Senha@123',
    });

    expect(messagesOf(await validate(dto)).join(' ')).toContain('apenas letras, números');
  });

  it('exige login e senha no DTO de login', async () => {
    const dto = plainToInstance(LoginDto, { login: '', senha: '' });
    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('login é obrigatório');
    expect(messages).toContain('senha é obrigatória');
  });

  it('rejeita receita fora dos limites do banco', async () => {
    const dto = plainToInstance(CreateRecipeDto, {
      nome: 'x'.repeat(46),
      categoriaId: 0,
      tempoPreparoMinutos: 0,
      porcoes: 0,
      ingredientes: '',
      modoPreparo: '',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('entre 1 e 45 caracteres');
    expect(messages).toContain('categoria válida');
    expect(messages).toContain('maior que zero');
  });

  it('converte e valida os parâmetros de pesquisa', async () => {
    const dto = plainToInstance(QueryRecipesDto, {
      page: '2',
      limit: '9',
      categoriaId: '3',
      sortBy: 'nome',
      order: 'asc',
      search: '  bolo  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(9);
    expect(dto.categoriaId).toBe(3);
    expect(dto.search).toBe('bolo');
  });

  it('rejeita ordenação não permitida', async () => {
    const dto = plainToInstance(QueryRecipesDto, {
      sortBy: 'senha',
      order: 'aleatoria',
    });

    const messages = messagesOf(await validate(dto)).join(' ');
    expect(messages).toContain('Ordenação inválida');
    expect(messages).toContain('Direção de ordenação inválida');
  });
});
