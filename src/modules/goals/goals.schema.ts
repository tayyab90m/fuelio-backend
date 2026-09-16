import { z } from "zod";

// "active" -> currently offered to users, "inactive" -> hidden/disabled.
export const goalStates = ["active", "inactive"] as const;

export const calorieAdjustmentSchema = z.object({
  type: z.enum(["increase", "decrease", "maintain"]),
  percentage: z.number().min(0).max(100),
});

export const macroRatiosSchema = z.object({
  fats: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  protein: z.number().min(0).max(100),
});

export const createGoalSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  calorieAdjustment: calorieAdjustmentSchema,
  macroRatios: macroRatiosSchema,
  state: z.enum(goalStates).default("active"),
  categoryIds: z.array(z.string().uuid()).optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema.partial();
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
