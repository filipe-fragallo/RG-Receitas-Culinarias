import type { RecipeFormValues } from '../types/forms';

export type FormErrors<T extends string> = Partial<Record<T, string>>;

const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

export function validateLoginForm(values: { login: string; senha: string }) {
  const errors: FormErrors<'login' | 'senha'> = {};

  if (!values.login.trim()) {
    errors.login = 'Informe seu login.';
  }

  if (!values.senha) {
    errors.senha = 'Informe sua senha.';
  }

  return errors;
}

export function validateRegisterForm(values: {
  nome: string;
  login: string;
  senha: string;
  confirmarSenha: string;
}) {
  const errors: FormErrors<'nome' | 'login' | 'senha' | 'confirmarSenha'> = {};
  const nome = values.nome.trim();
  const login = values.login.trim().toLowerCase();

  if (nome.length < 3) {
    errors.nome = 'O nome deve ter no mínimo 3 caracteres.';
  } else if (nome.length > 100) {
    errors.nome = 'O nome deve ter no máximo 100 caracteres.';
  }

  if (login.length < 3) {
    errors.login = 'O login deve ter no mínimo 3 caracteres.';
  } else if (login.length > 100) {
    errors.login = 'O login deve ter no máximo 100 caracteres.';
  } else if (!LOGIN_PATTERN.test(login)) {
    errors.login = 'Use apenas letras, números, ponto, hífen ou sublinhado.';
  }

  if (values.senha.length < 8) {
    errors.senha = 'A senha deve ter no mínimo 8 caracteres.';
  } else if (values.senha.length > 72) {
    errors.senha = 'A senha deve ter no máximo 72 caracteres.';
  }

  if (!values.confirmarSenha) {
    errors.confirmarSenha = 'Confirme sua senha.';
  } else if (values.confirmarSenha !== values.senha) {
    errors.confirmarSenha = 'As senhas não conferem.';
  }

  return errors;
}

export function validateRecipeForm(values: RecipeFormValues) {
  const errors: FormErrors<keyof RecipeFormValues> = {};
  const nome = values.nome.trim();
  const tempo = Number(values.tempoPreparoMinutos);
  const porcoes = Number(values.porcoes);

  if (!nome) {
    errors.nome = 'Informe o nome da receita.';
  } else if (nome.length > 45) {
    errors.nome = 'O nome deve ter no máximo 45 caracteres.';
  }

  if (!values.categoriaId) {
    errors.categoriaId = 'Selecione uma categoria.';
  }

  if (!values.tempoPreparoMinutos.trim() || !Number.isInteger(tempo) || tempo < 1) {
    errors.tempoPreparoMinutos = 'Informe um tempo de preparo em minutos maior que zero.';
  } else if (tempo > 100000) {
    errors.tempoPreparoMinutos = 'O tempo de preparo informado é muito alto.';
  }

  if (!values.porcoes.trim() || !Number.isInteger(porcoes) || porcoes < 1) {
    errors.porcoes = 'Informe uma quantidade de porções maior que zero.';
  } else if (porcoes > 1000) {
    errors.porcoes = 'A quantidade de porções informada é muito alta.';
  }

  if (!values.ingredientes.trim()) {
    errors.ingredientes = 'Informe os ingredientes.';
  } else if (values.ingredientes.length > 5000) {
    errors.ingredientes = 'Os ingredientes devem ter no máximo 5000 caracteres.';
  }

  if (!values.modoPreparo.trim()) {
    errors.modoPreparo = 'Informe o modo de preparo.';
  } else if (values.modoPreparo.length > 10000) {
    errors.modoPreparo = 'O modo de preparo deve ter no máximo 10000 caracteres.';
  }

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
