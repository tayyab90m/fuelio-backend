import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sortingPriority: z.number().int(),
  proteinMin: z.number().nonnegative(),
  proteinMax: z.number().nonnegative(),
  fatMin: z.number().nonnegative(),
  fatMax: z.number().nonnegative(),
  carbsMin: z.number().nonnegative(),
  carbsMax: z.number().nonnegative(),
  minimalDailyCaloriesMen: z.number().int().nonnegative(),
  minimalDailyCaloriesWomen: z.number().int().nonnegative(),
  mealSwapEnabled: z.boolean().default(false),
  toleranceOfTotalCalories: z.number().nonnegative(),
  unit: z.string().min(1),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema;
export type ListCategoriesQuery = z.infer<typeof listQuerySchema>;
