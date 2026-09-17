import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const ingredientStates = ["active", "inactive"] as const;

export const createIngredientSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  vegan: z.boolean().default(false),
  vegetarian: z.boolean().default(false),
  glutenFree: z.boolean().default(false),
  soyaFree: z.boolean().default(false),
  nutFree: z.boolean().default(false),
  servingSizeAmount: z.number().positive(),
  servingSizeUnit: z.string().min(1),
  state: z.enum(ingredientStates).default("active"),
  categoryId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
});
export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;

export const updateIngredientSchema = createIngredientSchema.partial();
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
});
export type ListIngredientsQuery = z.infer<typeof listQuerySchema>;
