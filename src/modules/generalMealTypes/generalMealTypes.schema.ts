import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const generalMealTypeStates = ["active", "inactive"] as const;

// "HH:mm" 24-hour time string, e.g. "07:00".
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm time string");

export const createGeneralMealTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  state: z.enum(generalMealTypeStates).default("active"),
  proteinPercentage: z.number().min(0).max(100),
  carbsPercentage: z.number().min(0).max(100),
  fatsPercentage: z.number().min(0).max(100),
  minimumProtein: z.number().nonnegative(),
  startTime: timeString,
  endTime: timeString,
});
export type CreateGeneralMealTypeInput = z.infer<typeof createGeneralMealTypeSchema>;

export const updateGeneralMealTypeSchema = createGeneralMealTypeSchema.partial();
export type UpdateGeneralMealTypeInput = z.infer<typeof updateGeneralMealTypeSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema;
export type ListGeneralMealTypesQuery = z.infer<typeof listQuerySchema>;
