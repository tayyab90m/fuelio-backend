import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngredientFlags, PlanningIngredient, PlanningMeal, PlanSlot, buildWeeklyPlan } from "../src/modules/questions/mealPlan.service";

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

const allFlags: IngredientFlags = { vegan: true, vegetarian: true, glutenFree: true, soyaFree: true, nutFree: true };

const rice = (baseAmount: number, roundAmount = 1): PlanningIngredient => ({
  ingredientId: "rice",
  name: "Rice",
  unitId: "g",
  unit: "g",
  minAmount: baseAmount - 10,
  baseAmount,
  maxAmount: baseAmount + 10,
  roundAmount,
  flags: allFlags,
});

const meal = (id: string, calories: number, mealTypeNames: string[], extra: Partial<PlanningMeal> = {}): PlanningMeal => ({
  id,
  name: `Meal ${id}`,
  calories,
  protein: calories / 10,
  carbs: calories / 10,
  fat: calories / 20,
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
    assert.deepEqual(plan.data[0].meals[0].recipe.ingredients[0], {
      id: "rice",
      name: "Rice",
      min_amount: 90,
      base_amount: 100,
      max_amount: 110,
      round_amount: 1,
      unit: "g",
    });
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

  it("totals ingredient amounts across the week, each portion rounded to its round amount", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("a", 600, ["Lunch"], { recipe: recipe("a", [rice(120, 50)]) })],
      [],
      3,
    );
    const entry = Object.values(plan.shopping_list)[0];
    assert.equal(entry.name, "Rice");
    // 120g per day rounds to 100g (nearest 50g), x3 days
    assert.equal(plan.data[0].meals[0].recipe.ingredients[0].base_amount, 100);
    assert.equal(entry.base_amount, 300);
    // min 110 -> 100, max 130 -> 150
    assert.equal(entry.min_amount, 300);
    assert.equal(entry.max_amount, 450);
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

describe("portion scaling", () => {
  it("scales a meal toward the slot's calorie target and rounds amounts to the round step", () => {
    // 400 kcal meal into a 600 kcal slot -> x1.5
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [meal("a", 400, ["Lunch"], { recipe: recipe("a", [rice(100, 25)]) })],
      [],
      1,
    );
    const planned = plan.data[0].meals[0];
    assert.equal(planned.scale, 1.5);
    assert.equal(planned.macros.calories, 600);
    // 100 * 1.5 = 150 -> multiple of 25
    assert.equal(planned.recipe.ingredients[0].base_amount, 150);
    assert.equal(Object.values(plan.shopping_list)[0].base_amount, 150);
  });

  it("clamps the scale to 0.5-2 so a mismatched meal isn't distorted wildly", () => {
    const tooSmall = buildWeeklyPlan([slot("Lunch", 2000)], [meal("a", 200, ["Lunch"])], [], 1);
    assert.equal(tooSmall.data[0].meals[0].scale, 2);
    const tooBig = buildWeeklyPlan([slot("Lunch", 100)], [meal("a", 1000, ["Lunch"])], [], 1);
    assert.equal(tooBig.data[0].meals[0].scale, 0.5);
  });

  it("never rounds a used ingredient down to zero", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 300)],
      [meal("a", 600, ["Lunch"], { recipe: recipe("a", [rice(2, 5)]) })],
      [],
      1,
    );
    assert.equal(plan.data[0].meals[0].recipe.ingredients[0].base_amount, 5);
  });
});

describe("dietary restrictions", () => {
  const withFlags = (id: string, name: string, flags: Partial<IngredientFlags>, mealTypes = ["Lunch"]) =>
    meal(id, 600, mealTypes, {
      name,
      recipe: recipe(id, [{ ...rice(100), flags: { ...allFlags, ...flags } }]),
    });

  it("only uses meals whose every ingredient satisfies the restriction", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [withFlags("meat", "Meat", { vegetarian: false, vegan: false }), withFlags("veg", "Veg", {})],
      [],
      4,
      ["vegetarian"],
    );
    for (const day of plan.data) assert.equal(day.meals[0].recipe.id, "veg");
  });

  it("treats a vegan ingredient as vegetarian", () => {
    const plan = buildWeeklyPlan([slot("Lunch", 600)], [withFlags("v", "V", { vegetarian: false, vegan: true })], [], 1, ["vegetarian"]);
    assert.equal(plan.data[0].meals.length, 1);
  });

  it("requires ALL restrictions to hold", () => {
    const plan = buildWeeklyPlan(
      [slot("Lunch", 600)],
      [withFlags("gluten", "Gluten", { glutenFree: false }), withFlags("nuts", "Nuts", { nutFree: false })],
      [],
      1,
      ["gluten_free", "nut_free"],
    );
    assert.deepEqual(plan.data[0].meals, []);
    assert.match(plan.warnings[0], /dietary restrictions/);
  });

  it("never falls back to an unsuitable meal when the slot's type has none", () => {
    const plan = buildWeeklyPlan(
      [slot("Dinner", 600)],
      [withFlags("meat-dinner", "Meat", { vegetarian: false, vegan: false }, ["Dinner"]), withFlags("veg-lunch", "Veg", {}, ["Lunch"])],
      [],
      1,
      ["vegetarian"],
    );
    // Falls back to the suitable (lunch-typed) meal with a warning, not to the meat dinner.
    assert.equal(plan.data[0].meals[0].recipe.id, "veg-lunch");
    assert.match(plan.warnings[0], /dietary restrictions/);
  });

  it("leaves the slot empty when nothing suits the restrictions", () => {
    const plan = buildWeeklyPlan([slot("Lunch", 600)], [withFlags("meat", "Meat", { vegetarian: false, vegan: false })], [], 2, ["vegan"]);
    assert.deepEqual(plan.data.map((d) => d.meals.length), [0, 0]);
    assert.match(plan.warnings[0], /left empty/);
  });
});
