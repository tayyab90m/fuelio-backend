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
 *
 * Dietary restrictions are a hard filter: a meal is only eligible if EVERY
 * ingredient in its recipe carries the matching flag. There is deliberately no
 * fallback to unsuitable meals - an empty slot (with a warning) is safer than
 * serving something the user said they can't eat. Substitutes are not
 * considered, only the recipe's main ingredients.
 *
 * Portions are scaled toward the slot's calorie target (clamped to
 * MIN_SCALE-MAX_SCALE) and each ingredient amount is rounded to the recipe's
 * round amount.
 */
import { FastifyInstance } from "fastify";

export const PLAN_DAYS = 7;
const REPEAT_WINDOW = 2;
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;

export const DIETARY_RESTRICTIONS = ["vegan", "vegetarian", "gluten_free", "soy_free", "nut_free"] as const;
export type DietaryRestriction = (typeof DIETARY_RESTRICTIONS)[number];

export interface IngredientFlags {
  vegan: boolean;
  vegetarian: boolean;
  glutenFree: boolean;
  soyaFree: boolean;
  nutFree: boolean;
}

const RESTRICTION_CHECKS: Record<DietaryRestriction, (flags: IngredientFlags) => boolean> = {
  vegan: (f) => f.vegan,
  // Anything vegan is also vegetarian, even if only one box was ticked.
  vegetarian: (f) => f.vegetarian || f.vegan,
  gluten_free: (f) => f.glutenFree,
  soy_free: (f) => f.soyaFree,
  nut_free: (f) => f.nutFree,
};

export interface PlanningMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
  flags: IngredientFlags;
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
  /** Portion multiplier applied to the recipe (1 = as written). */
  scale: number;
  /** The meal's macros at that portion size. */
  macros: { calories: number; protein: number; fat: number; carbs: number };
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Nearest multiple of `step`, never below one step for a positive amount. */
function roundToStep(value: number, step: number): number {
  if (!(step > 0) || value <= 0) return trim(value);
  return trim(Math.max(step, Math.round(value / step) * step));
}

export function isSuitable(meal: PlanningMeal, restrictions: readonly DietaryRestriction[]): boolean {
  if (restrictions.length === 0) return true;
  const ingredients = meal.recipe?.ingredients ?? [];
  return restrictions.every((restriction) => ingredients.every((ing) => RESTRICTION_CHECKS[restriction](ing.flags)));
}

export function buildWeeklyPlan(
  slots: PlanSlot[],
  meals: PlanningMeal[],
  goalCategoryIds: string[],
  days = PLAN_DAYS,
  restrictions: readonly DietaryRestriction[] = [],
): WeeklyPlan {
  const warnings: string[] = [];
  const goalCategories = new Set(goalCategoryIds);
  const withRecipe = meals.filter((meal) => meal.recipe);
  const usable = withRecipe.filter((meal) => isSuitable(meal, restrictions));

  const candidatesBySlot = slots.map((slot) => {
    const wanted = slot.mealTypeNames.map(normalise);
    const matching = usable.filter((meal) => meal.mealTypeNames.some((n) => wanted.includes(normalise(n))));
    if (matching.length === 0) {
      if (usable.length === 0) {
        warnings.push(
          withRecipe.length > 0
            ? `No meals match your dietary restrictions (${restrictions.join(", ")}), so ${slot.name} was left empty.`
            : `No meals with a recipe exist yet, so ${slot.name} could not be planned.`,
        );
      } else {
        const suitableNote = restrictions.length > 0 ? " that suits your dietary restrictions" : "";
        warnings.push(
          withRecipe.some((meal) => meal.mealTypeNames.some((n) => wanted.includes(normalise(n)))) && restrictions.length > 0
            ? `No "${slot.name}" meals match your dietary restrictions, so another meal was used for it.`
            : `No meals are linked to the "${slot.name}" meal type, so any meal${suitableNote} was used for it.`,
        );
      }
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
      const scale = meal.calories > 0 ? clamp(slot.calories / meal.calories, MIN_SCALE, MAX_SCALE) : 1;
      const scaled = recipe.ingredients.map((ing) => ({
        ...ing,
        minAmount: roundToStep(ing.minAmount * scale, ing.roundAmount),
        baseAmount: roundToStep(ing.baseAmount * scale, ing.roundAmount),
        maxAmount: roundToStep(ing.maxAmount * scale, ing.roundAmount),
      }));

      dayMeals.push({
        type: slot.name,
        time: slot.time,
        is_workout_meal: false,
        scale: trim(scale),
        macros: {
          calories: Math.round(meal.calories * scale),
          protein: Math.round(meal.protein * scale),
          fat: Math.round(meal.fat * scale),
          carbs: Math.round(meal.carbs * scale),
        },
        recipe: {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          prep_time: recipe.prepTime,
          cook_time: recipe.cookTime,
          instructions: recipe.instructions,
          ingredients: scaled.map((ing) => ({
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

      for (const ing of scaled) {
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
            include: {
              ingredient: {
                select: { id: true, name: true, vegan: true, vegetarian: true, glutenFree: true, soyaFree: true, nutFree: true },
              },
              unit: { select: { id: true, name: true, short: true } },
            },
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
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
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
              flags: {
                vegan: ri.ingredient.vegan,
                vegetarian: ri.ingredient.vegetarian,
                glutenFree: ri.ingredient.glutenFree,
                soyaFree: ri.ingredient.soyaFree,
                nutFree: ri.ingredient.nutFree,
              },
            })),
          }
        : null,
    };
  });
}
