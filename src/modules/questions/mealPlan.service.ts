/**
 * Weekly meal plan + shopping list generation for the diet-plan endpoint.
 *
 * The planner itself is a pure function (`buildWeeklyPlan`) so it can be unit
 * tested without a database; `loadPlanningMeals` is the thin Prisma loader.
 *
 * How a meal is chosen for a slot (e.g. "Lunch" on day 3):
 *  1. Candidates are meals linked to a GeneralMealType matching the slot name;
 *     if none are linked, any meal that has a recipe is allowed (flagged in
 *     `errors` so the coach knows the meal types aren't set up).
 *  2. Meals sharing a category with the user's goal are preferred.
 *  3. Among those, the meal whose calories are closest to the slot's calorie
 *     target wins, but a meal used in the previous `REPEAT_WINDOW` days is
 *     skipped while an alternative exists, so the week has some variety.
 *
 * It is deliberately simple - no allergen/diet filtering and no portion
 * scaling yet - and the README says so.
 */
import { FastifyInstance } from "fastify";

export const PLAN_DAYS = 7;
const REPEAT_WINDOW = 2;

export interface PlanningMeal {
  id: string;
  name: string;
  calories: number;
  categoryIds: string[];
  mealTypeNames: string[];
  recipe: PlanningRecipe | null;
}

export interface PlanningRecipe {
  id: string;
  name: string;
  description: string;
  prepTime: number;
  cookTime: number;
  instructions: string[];
  ingredients: PlanningIngredient[];
}

export interface PlanningIngredient {
  ingredientId: string;
  name: string;
  unitId: string;
  unit: string;
  minAmount: number;
  baseAmount: number;
  maxAmount: number;
  roundAmount: number;
}

export interface PlanSlot {
  /** Display name, e.g. "Breakfast". */
  name: string;
  /** Meal-type names (lowercase) that can fill this slot. */
  mealTypeNames: string[];
  time: string;
  calories: number;
}

export interface PlannedMeal {
  type: string;
  time: string;
  is_workout_meal: boolean;
  recipe: {
    id: string;
    name: string;
    description: string;
    prep_time: number;
    cook_time: number;
    instructions: string[];
    ingredients: {
      id: string;
      name: string;
      min_amount: number;
      base_amount: number;
      max_amount: number;
      round_amount: number;
      unit: string;
    }[];
  };
}

export interface ShoppingListEntry {
  id: string;
  name: string;
  min_amount: number;
  base_amount: number;
  max_amount: number;
  round_amount: number;
  unit: string;
}

export interface WeeklyPlan {
  data: { day: string; meals: PlannedMeal[] }[];
  shopping_list: Record<string, ShoppingListEntry>;
  warnings: string[];
}

const normalise = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, " ");

function pickMeal(
  candidates: PlanningMeal[],
  goalCategoryIds: Set<string>,
  targetCalories: number,
  recentIds: string[],
): PlanningMeal {
  const score = (meal: PlanningMeal) => {
    const sharesCategory = meal.categoryIds.some((id) => goalCategoryIds.has(id));
    // Category match dominates; calorie distance breaks ties.
    return (sharesCategory ? 0 : 100000) + Math.abs(meal.calories - targetCalories);
  };
  const sorted = [...candidates].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  return sorted.find((meal) => !recentIds.includes(meal.id)) ?? sorted[0];
}

/** Round a total up to the next multiple of `step` (no-op for step <= 0). */
function roundUp(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.ceil(value / step - 1e-9) * step;
}

const trim = (value: number) => Math.round(value * 100) / 100;

export function buildWeeklyPlan(
  slots: PlanSlot[],
  meals: PlanningMeal[],
  goalCategoryIds: string[],
  days = PLAN_DAYS,
): WeeklyPlan {
  const warnings: string[] = [];
  const goalCategories = new Set(goalCategoryIds);
  const usable = meals.filter((meal) => meal.recipe);

  const candidatesBySlot = slots.map((slot) => {
    const wanted = slot.mealTypeNames.map(normalise);
    const matching = usable.filter((meal) => meal.mealTypeNames.some((n) => wanted.includes(normalise(n))));
    if (matching.length === 0) {
      warnings.push(
        usable.length === 0
          ? `No meals with a recipe exist yet, so ${slot.name} could not be planned.`
          : `No meals are linked to the "${slot.name}" meal type, so any meal was used for it.`,
      );
      return usable;
    }
    return matching;
  });

  const history: string[][] = slots.map(() => []);
  const plan: WeeklyPlan["data"] = [];
  const totals = new Map<string, ShoppingListEntry>();

  for (let day = 1; day <= days; day++) {
    const dayMeals: PlannedMeal[] = [];

    slots.forEach((slot, slotIndex) => {
      const candidates = candidatesBySlot[slotIndex];
      if (candidates.length === 0) return;

      const recent = history[slotIndex].slice(-REPEAT_WINDOW);
      const meal = pickMeal(candidates, goalCategories, slot.calories, recent);
      history[slotIndex].push(meal.id);
      const recipe = meal.recipe!;

      dayMeals.push({
        type: slot.name,
        time: slot.time,
        is_workout_meal: false,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          prep_time: recipe.prepTime,
          cook_time: recipe.cookTime,
          instructions: recipe.instructions,
          ingredients: recipe.ingredients.map((ing) => ({
            id: ing.ingredientId,
            name: ing.name,
            min_amount: ing.minAmount,
            base_amount: ing.baseAmount,
            max_amount: ing.maxAmount,
            round_amount: ing.roundAmount,
            unit: ing.unit,
          })),
        },
      });

      for (const ing of recipe.ingredients) {
        // Same ingredient in a different unit is a different line - we don't
        // convert between units.
        const key = `${ing.ingredientId}:${ing.unitId}`;
        const entry = totals.get(key) ?? {
          id: ing.ingredientId,
          name: ing.name,
          min_amount: 0,
          base_amount: 0,
          max_amount: 0,
          round_amount: ing.roundAmount,
          unit: ing.unit,
        };
        entry.min_amount += ing.minAmount;
        entry.base_amount += ing.baseAmount;
        entry.max_amount += ing.maxAmount;
        totals.set(key, entry);
      }
    });

    plan.push({ day: String(day), meals: dayMeals });
  }

  const shopping_list: Record<string, ShoppingListEntry> = {};
  for (const [key, entry] of totals) {
    shopping_list[key] = {
      ...entry,
      min_amount: trim(entry.min_amount),
      base_amount: trim(roundUp(entry.base_amount, entry.round_amount)),
      max_amount: trim(entry.max_amount),
    };
  }

  return { data: plan, shopping_list, warnings: [...new Set(warnings)] };
}

export async function loadPlanningMeals(fastify: FastifyInstance): Promise<PlanningMeal[]> {
  const meals = await fastify.prisma.meal.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      categories: { select: { id: true } },
      generalMealTypes: { select: { name: true } },
      recipes: {
        orderBy: { createdAt: "asc" },
        include: {
          recipeIngredients: {
            orderBy: { createdAt: "asc" },
            include: { ingredient: { select: { id: true, name: true } }, unit: { select: { id: true, name: true, short: true } } },
          },
        },
      },
    },
  });

  return meals.map((meal) => {
    const recipe = meal.recipes[0];
    return {
      id: meal.id,
      name: meal.name,
      calories: meal.calories,
      categoryIds: meal.categories.map((c) => c.id),
      mealTypeNames: meal.generalMealTypes.map((t) => t.name),
      recipe: recipe
        ? {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            instructions: Array.isArray(recipe.instructions) ? (recipe.instructions as string[]) : [],
            ingredients: recipe.recipeIngredients.map((ri) => ({
              ingredientId: ri.ingredient.id,
              name: ri.ingredient.name,
              unitId: ri.unit.id,
              unit: ri.unit.short || ri.unit.name,
              minAmount: ri.minAmount,
              baseAmount: ri.baseAmount,
              maxAmount: ri.maxAmount,
              roundAmount: ri.roundAmount,
            })),
          }
        : null,
    };
  });
}
