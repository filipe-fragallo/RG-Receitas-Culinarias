export interface RecipeFormValues {
  name: string;
  categoryId: string;
  preparationTimeMinutes: string;
  servings: string;
  ingredients: string;
  instructions: string;
}

export const EMPTY_RECIPE_FORM: RecipeFormValues = {
  name: '',
  categoryId: '',
  preparationTimeMinutes: '',
  servings: '',
  ingredients: '',
  instructions: '',
};
