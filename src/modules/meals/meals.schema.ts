import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createMealSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  categoryIds: z.array(z.string().uuid()).optional(),
  generalMealTypeIds: z.array(z.string().uuid()).optional(),
  recipeIds: z.array(z.string().uuid()).optional(),
});
export type CreateMealInput = z.infer<typeof createMealSchema>;

export const updateMealSchema = createMealSchema.partial();
export type UpdateMealInput = z.infer<typeof updateMealSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema;
export type ListMealsQuery = z.infer<typeof listQuerySchema>;
