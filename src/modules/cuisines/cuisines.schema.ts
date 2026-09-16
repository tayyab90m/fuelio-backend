import { z } from "zod";

// "active" -> visible/selectable, "inactive" -> hidden/disabled.
export const cuisineStates = ["active", "inactive"] as const;

export const createCuisineSchema = z.object({
  name: z.string().min(1),
  state: z.enum(cuisineStates).default("active"),
});
export type CreateCuisineInput = z.infer<typeof createCuisineSchema>;

export const updateCuisineSchema = createCuisineSchema.partial();
export type UpdateCuisineInput = z.infer<typeof updateCuisineSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
