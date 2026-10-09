import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlanningIngredient, PlanningMeal, PlanSlot, buildWeeklyPlan } from "../src/modules/questions/mealPlan.service";

// Pure planner tests - no database involved.

const recipe = (id: string, ingredients: PlanningIngredient[] = []) => ({
  id,
  name: `Recipe ${id}`,
  description: "d",
  prepTime: 5,
  cookTime: 10,
  instructions: ["step"],
  ingredients,
});

const rice = (baseAmount: number, roundAmount = 1) => ({
  ingredientId: "rice",
  name: "Rice",
  unitId: "g",
  unit: "g",
  minAmount: baseAmount - 10,
  baseAmount,
  maxAmount: baseAmount + 10,
  roundAmount,
});

const meal = (id: string, calories: number, mealTypeNames: string[], extra: Partial<PlanningMeal> = {}): PlanningMeal => ({
  id,
  name: `Meal ${id}`,
  calories,
  categoryIds: [],
  mealTypeNames,
  recipe: recipe(id, [rice(100)]),
  ...extra,
});

const slot = (name: string, calories: number): PlanSlot => ({
  name,
  mealTypeNames: [name.toLowerCase()],
  time: "12:00-13:00",
  calories,
});

describe("buildWeeklyPlan", () => {
  it("plans every day and slot from meals linked to the matching meal type", () => {
    const plan = buildWeeklyPlan(
      [slot("Breakfast", 500), slot("Dinner", 800)],
      [meal("b", 500, ["Breakfast"]), meal("d", 800, ["Dinner"])],
      [],
    );

    assert.equal(plan.data.length, 7);
    for (const day of plan.data) {
      assert.deepEqual(day.meals.map((m) => m.type), ["Breakfast", "Dinner"]);
      assert.equal(day.meals[0].recipe.id, "b");
      assert.equal(day.meals[1].recipe.id, "d");
    }
    assert.deepEqual(plan.warnings, []);
  });

  it("matches meal types regardless of case, spaces and underscores", () => {
    const plan = buildWeeklyPlan(
      [{ name: "Snack", mealTypeNames: ["morning snack"], time: "10:00", calories: 200 }],
      [meal("s", 200, ["morning_snack"])],
      [],
    );
    assert.equal(plan.data[0].meals[0].recipe.id, "s");
  });

  it("prefers meals sharing a category with the goal over closer calories", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("close", 600, ["Lunch"]), meal("goal", 900, ["Lunch"], { categoryIds: ["cat-1"] })],
      ["cat-1"],
      1,
    );
    assert.equal(plan.data[0].meals[0].recipe.id, "goal");
  });

  it("picks the closest calories when categories don't decide", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("far", 900, ["Lunch"]), meal("near", 620, ["Lunch"])],
      [],
      1,
    );
    assert.equal(plan.data[0].meals[0].recipe.id, "near");
  });

  it("rotates meals so the same one is not served on consecutive days", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("a", 600, ["Lunch"]), meal("b", 610, ["Lunch"]), meal("c", 620, ["Lunch"])],
      [],
      6,
    );
    const ids = plan.data.map((d) => d.meals[0].recipe.id);
    for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1]);
  });

  it("falls back to any meal with a warning when no meal is linked to the slot", () => {
    const plan = buildWeeklyPlan([slot("Lunch", 600)], [meal("x", 600, ["Dinner"])], [], 2);
    assert.equal(plan.data[0].meals.length, 1);
    assert.equal(plan.warnings.length, 1);
    assert.match(plan.warnings[0], /Lunch/);
  });

  it("leaves slots empty (with a warning) when no meal has a recipe", () => {
    const plan = buildWeeklyPlan([slot("Lunch", 600)], [meal("x", 600, ["Lunch"], { recipe: null })], [], 2);
    assert.deepEqual(plan.data.map((d) => d.meals.length), [0, 0]);
    assert.match(plan.warnings[0], /No meals with a recipe/);
    assert.deepEqual(plan.shopping_list, {});
  });

  it("totals ingredient amounts across the week and rounds up to the round amount", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("a", 600, ["Lunch"], { recipe: recipe("a", [rice(33, 50)]) })],
      [],
      3,
    );
    const entry = Object.values(plan.shopping_list)[0];
    assert.equal(entry.name, "Rice");
    // 3 x 33g = 99g -> rounded up to the next 50g multiple
    assert.equal(entry.base_amount, 100);
    assert.equal(entry.min_amount, 3 * 23);
    assert.equal(entry.max_amount, 3 * 43);
  });

  it("keeps the same ingredient in different units on separate shopping lines", () => {
    const cup = { ...rice(1), unitId: "cup", unit: "cup" };
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("a", 600, ["Lunch"], { recipe: recipe("a", [rice(100), cup]) })],
      [],
      1,
    );
    assert.equal(Object.keys(plan.shopping_list).length, 2);
  });
});
