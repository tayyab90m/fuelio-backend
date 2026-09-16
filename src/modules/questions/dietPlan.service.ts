import { FastifyInstance } from "fastify";
import { NotFoundError } from "../../utils/errors";
import { SubmitAnswerInput } from "./questions.schema";

interface CalorieAdjustment {
  type: "increase" | "decrease" | "maintain";
  percentage: number;
}

interface MacroRatios {
  fats: number;
  carbs: number;
  protein: number;
}

interface Macros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface MealTimingTemplate {
  name: string;
  timing: string;
  description: string;
  // Fraction (0-1) of the day's total macros allotted to this meal. Purely
  // illustrative — see disclaimer below.
  portion: number;
}

// Example 4-meal split used to break the day's macros into
// `macrosDistribution` entries. Portions are a simple, roughly-even
// illustrative split (not derived from any nutrition research) and sum to 1.
const MEAL_TIMING_TEMPLATE: MealTimingTemplate[] = [
  { name: "Breakfast", timing: "07:00-09:00", description: "First meal of the day", portion: 0.25 },
  { name: "Lunch", timing: "12:00-14:00", description: "Midday meal", portion: 0.3 },
  { name: "Dinner", timing: "18:00-20:00", description: "Evening meal", portion: 0.3 },
  { name: "Snack", timing: "15:00-16:00", description: "Afternoon snack / top-up", portion: 0.15 },
];

function round(value: number): number {
  return Math.round(value);
}

/**
 * ============================================================================
 * PLACEHOLDER BUSINESS LOGIC — NOT A FINAL PRODUCT SPEC
 * ============================================================================
 * This function powers `POST /api/v1/questions/submit-answer`. There is no
 * real product/nutrition specification for this calculation yet — it exists
 * so the frontend has a working endpoint shaped the way it expects while the
 * real formula is designed. Everything below is PROVISIONAL and should be
 * revisited before shipping to real users:
 *
 *  - The BMR/TDEE formula (Mifflin-St Jeor + ActivityLevel.multiplier) is a
 *    reasonable, well-known baseline, but has not been reviewed by anyone
 *    with nutrition/product expertise for this product's specific goals.
 *  - The meal-timing split (`MEAL_TIMING_TEMPLATE` above: Breakfast/Lunch/
 *    Dinner/Snack at 25/30/30/15%) is an arbitrary, roughly-even illustrative
 *    split, not derived from `GeneralMealType`'s own
 *    protein/carbs/fats percentages or any research.
 *  - The `mealFramework` field's shape (currently a plain descriptive
 *    string) is a placeholder — a real implementation may want a structured
 *    object instead.
 *  - `errors` is always `[]` on a successful (200) response today; invalid
 *    input instead throws (400 for a validation failure, 404 for an unknown
 *    `activityLevelId`/`goalId`). The field is reserved for future
 *    soft-validation / partial-failure cases the real spec may need.
 *
 * Do not treat any of the numbers this produces as real nutrition advice.
 * ============================================================================
 */
export async function calculateDietPlan(fastify: FastifyInstance, input: SubmitAnswerInput) {
  const { prisma } = fastify;
  const { age, sex, heightCm, weightKg, activityLevelId, goalId } = input;

  const activityLevel = await prisma.activityLevel.findUnique({ where: { id: activityLevelId } });
  if (!activityLevel) throw new NotFoundError("Activity level not found");

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new NotFoundError("Goal not found");

  const calorieAdjustment = goal.calorieAdjustment as unknown as CalorieAdjustment;
  const macroRatios = goal.macroRatios as unknown as MacroRatios;

  // Mifflin-St Jeor BMR
  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // TDEE
  const tdee = bmr * activityLevel.multiplier;

  // Adjust for goal
  let adjustedCalories = tdee;
  if (calorieAdjustment.type === "increase") {
    adjustedCalories = tdee * (1 + calorieAdjustment.percentage / 100);
  } else if (calorieAdjustment.type === "decrease") {
    adjustedCalories = tdee * (1 - calorieAdjustment.percentage / 100);
  }

  // Macros in grams from goal macro ratio percentages
  const proteinG = (adjustedCalories * macroRatios.protein) / 100 / 4;
  const carbsG = (adjustedCalories * macroRatios.carbs) / 100 / 4;
  const fatG = (adjustedCalories * macroRatios.fats) / 100 / 9;

  const macros: Macros = {
    calories: round(adjustedCalories),
    protein: round(proteinG),
    fat: round(fatG),
    carbs: round(carbsG),
  };

  const macrosDistribution = MEAL_TIMING_TEMPLATE.map((meal) => ({
    name: meal.name,
    timing: meal.timing,
    description: meal.description,
    macros: {
      calories: round(macros.calories * meal.portion),
      protein: round(macros.protein * meal.portion),
      fat: round(macros.fat * meal.portion),
      carbs: round(macros.carbs * meal.portion),
    },
  }));

  const mealFramework =
    `A ${MEAL_TIMING_TEMPLATE.length}-meal framework (${MEAL_TIMING_TEMPLATE.map((m) => m.name).join(", ")}) ` +
    `targeting roughly ${macros.calories} kcal/day (${macros.protein}g protein, ${macros.carbs}g carbs, ` +
    `${macros.fat}g fat), split across meals per "macrosDistribution" above. Based on goal "${goal.name}" ` +
    `and activity level "${activityLevel.name}".`;

  return {
    userAnswers: input,
    macros,
    macrosDistribution,
    mealFramework,
    errors: [] as string[],
  };
}
