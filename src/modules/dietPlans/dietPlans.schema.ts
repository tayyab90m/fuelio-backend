import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";
import { submitAnswerSchema } from "../questions/questions.schema";

// Same body as POST /questions/submit-answer, plus an optional name. The plan
// is always recalculated on the server - clients can't submit their own result.
export const createDietPlanSchema = submitAnswerSchema.and(
  z.object({ name: z.string().trim().min(1).max(100).optional() }),
);
export type CreateDietPlanInput = z.infer<typeof createDietPlanSchema>;

export const updateDietPlanSchema = z.object({ name: z.string().trim().min(1).max(100) });
export type UpdateDietPlanInput = z.infer<typeof updateDietPlanSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });
export const listQuerySchema = paginationQuerySchema;
export type ListDietPlansQuery = z.infer<typeof listQuerySchema>;
