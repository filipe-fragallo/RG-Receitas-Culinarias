export interface RecipeFormValues {
  nome: string;
  categoriaId: string;
  tempoPreparoMinutos: string;
  porcoes: string;
  ingredientes: string;
  modoPreparo: string;
}

export const EMPTY_RECIPE_FORM: RecipeFormValues = {
  nome: '',
  categoriaId: '',
  tempoPreparoMinutos: '',
  porcoes: '',
  ingredientes: '',
  modoPreparo: '',
};
