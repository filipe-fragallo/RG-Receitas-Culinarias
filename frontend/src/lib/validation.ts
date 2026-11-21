import type { RecipeFormValues } from '../types/forms';

export type FormErrors<T extends string> = Partial<Record<T, string>>;

const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

export function validateLoginForm(values: { login: string; password: string }) {
  const errors: FormErrors<'login' | 'password'> = {};

  if (!values.login.trim()) {
    errors.login = 'Informe seu login.';
  }

  if (!values.password) {
    errors.password = 'Informe sua senha.';
  }

  return errors;
}

export function validateRegisterForm(values: {
  name: string;
  login: string;
  password: string;
  confirmPassword: string;
}) {
  const errors: FormErrors<'name' | 'login' | 'password' | 'confirmPassword'> = {};
  const name = values.name.trim();
  const login = values.login.trim().toLowerCase();

  if (name.length < 3) {
    errors.name = 'O nome deve ter no mínimo 3 caracteres.';
  } else if (name.length > 100) {
    errors.name = 'O nome deve ter no máximo 100 caracteres.';
  }

  if (login.length < 3) {
    errors.login = 'O login deve ter no mínimo 3 caracteres.';
  } else if (login.length > 100) {
    errors.login = 'O login deve ter no máximo 100 caracteres.';
  } else if (!LOGIN_PATTERN.test(login)) {
    errors.login = 'Use apenas letras, números, ponto, hífen ou sublinhado.';
  }

  if (values.password.length < 8) {
    errors.password = 'A senha deve ter no mínimo 8 caracteres.';
  } else if (values.password.length > 72) {
    errors.password = 'A senha deve ter no máximo 72 caracteres.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirme sua senha.';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'As senhas não conferem.';
  }

  return errors;
}

export function validateRecipeForm(values: RecipeFormValues) {
  const errors: FormErrors<keyof RecipeFormValues> = {};
  const name = values.name.trim();
  const preparationTimeMinutes = Number(values.preparationTimeMinutes);
  const servings = Number(values.servings);

  if (!name) {
    errors.name = 'Informe o nome da receita.';
  } else if (name.length > 45) {
    errors.name = 'O nome deve ter no máximo 45 caracteres.';
  }

  if (!values.categoryId) {
    errors.categoryId = 'Selecione uma categoria.';
  }

  if (
    !values.preparationTimeMinutes.trim() ||
    !Number.isInteger(preparationTimeMinutes) ||
    preparationTimeMinutes < 1
  ) {
    errors.preparationTimeMinutes = 'Informe um tempo de preparo em minutos maior que zero.';
  } else if (preparationTimeMinutes > 100000) {
    errors.preparationTimeMinutes = 'O tempo de preparo informado é muito alto.';
  }

  if (!values.servings.trim() || !Number.isInteger(servings) || servings < 1) {
    errors.servings = 'Informe uma quantidade de porções maior que zero.';
  } else if (servings > 1000) {
    errors.servings = 'A quantidade de porções informada é muito alta.';
  }

  if (!values.ingredients.trim()) {
    errors.ingredients = 'Informe os ingredientes.';
  } else if (values.ingredients.length > 5000) {
    errors.ingredients = 'Os ingredientes devem ter no máximo 5000 caracteres.';
  }

  if (!values.instructions.trim()) {
    errors.instructions = 'Informe o modo de preparo.';
  } else if (values.instructions.length > 10000) {
    errors.instructions = 'O modo de preparo deve ter no máximo 10000 caracteres.';
  }

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
