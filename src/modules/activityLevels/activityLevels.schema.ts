import { z } from "zod";

export const activityLevelStates = ["active", "inactive"] as const;

export const createActivityLevelSchema = z.object({
  name: z.string().min(1),
  multiplier: z.number().positive(),
  description: z.string().min(1),
  stepRangeMin: z.number().int().nonnegative(),
  stepRangeMax: z.number().int().nonnegative(),
  workoutRangeMin: z.number().int().nonnegative(),
  workoutRangeMax: z.number().int().nonnegative(),
  state: z.enum(activityLevelStates).default("active"),
});
export type CreateActivityLevelInput = z.infer<typeof createActivityLevelSchema>;

export const updateActivityLevelSchema = createActivityLevelSchema.partial();
export type UpdateActivityLevelInput = z.infer<typeof updateActivityLevelSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
