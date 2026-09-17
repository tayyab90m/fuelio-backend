import { z } from "zod";

export const recipeDifficulties = ["easy", "medium", "hard"] as const;

export const substituteInputSchema = z.object({
  substituteIngredientId: z.string().uuid(),
  unitId: z.string().uuid(),
  minAmount: z.number().nonnegative(),
  baseAmount: z.number().nonnegative(),
  maxAmount: z.number().nonnegative(),
  roundAmount: z.number().nonnegative(),
});
export type SubstituteInput = z.infer<typeof substituteInputSchema>;

export const recipeIngredientInputSchema = z.object({
  ingredientId: z.string().uuid(),
  unitId: z.string().uuid(),
  minAmount: z.number().nonnegative(),
  baseAmount: z.number().nonnegative(),
  maxAmount: z.number().nonnegative(),
  roundAmount: z.number().nonnegative(),
  substitutes: z.array(substituteInputSchema).optional(),
});
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>;

export const createRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  prepTime: z.number().int().nonnegative(),
  cookTime: z.number().int().nonnegative(),
  difficulty: z.enum(recipeDifficulties),
  servings: z.number().int().positive(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  // Ordered list of instruction step strings.
  instructions: z.array(z.string().min(1)),
  // Replace-all: on update, providing this array (including an empty one)
  // deletes and recreates every RecipeIngredient row for the recipe.
  // Omitting it on update leaves existing rows untouched.
  recipeIngredients: z.array(recipeIngredientInputSchema).optional(),
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = createRecipeSchema.partial();
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
