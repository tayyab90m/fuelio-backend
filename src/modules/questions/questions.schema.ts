import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const questionStates = ["active", "inactive"] as const;

export const createQuestionSchema = z.object({
  text: z.string().min(1),
  // Free-form: "multiple_choice" | "single_choice" | "text" | "number" | "boolean" | ...
  questionType: z.string().min(1),
  // Shape depends on questionType, e.g. [{ label, value }] for multiple choice.
  // Kept as z.any() at the validation layer since the schema is intentionally
  // generic (see Question model comment in prisma/schema.prisma). The refine
  // enforces presence at runtime, since a plain z.any()/z.unknown() field is
  // otherwise treated by zod as optional even without `.optional()`.
  options: z.any().refine((value) => value !== undefined, { message: "options is required" }),
  state: z.enum(questionStates).default("active"),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = createQuestionSchema.partial();
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = paginationQuerySchema;
export type ListQuestionsQuery = z.infer<typeof listQuerySchema>;

// ---------------------------------------------------------------------------
// POST /questions/submit-answer
//
// Only the fields needed for the (placeholder) Mifflin-St Jeor calculation
// are required. `.passthrough()` lets the caller submit additional
// question-answer fields alongside them (e.g. answers to other onboarding
// questions) which are simply echoed back in `userAnswers` untouched.
// ---------------------------------------------------------------------------
export const submitAnswerSchema = z
  .object({
    age: z.number().int().positive(),
    sex: z.enum(["male", "female"]),
    heightCm: z.number().positive(),
    weightKg: z.number().positive(),
    activityLevelId: z.string().uuid(),
    goalId: z.string().uuid(),
  })
  .passthrough();
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
