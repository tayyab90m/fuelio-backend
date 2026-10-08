import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// HTTP-level test for recipes, focused on the nested recipeIngredients ->
// substitutes round-trip and each substitute's own amount/unit fields
// (added after the fact - the original schema had no per-substitute
// amounts at all, forcing the frontend to approximate with the parent
// recipeIngredient's amounts; this test guards the fix).

describe("recipes with nested ingredients and substitutes", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let gramUnitId: string;
  let chickenId: string;
  let turkeyId: string;
  let recipeId: string;

  const auth = () => ({ authorization: `Bearer ${accessToken}` });

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const email = `smoke-recipes-${Date.now()}@fitnessdashboard.dev`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "Password123!", name: "Recipes Smoke Test" },
    });
    accessToken = register.json().accessToken;

    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth(),
      payload: { name: "Gram (smoke)", short: "g", unitType: "weight", system: "metric" },
    });
    gramUnitId = unit.json().data.id;

    const chicken = await app.inject({
      method: "POST",
      url: "/api/v1/ingredients",
      headers: auth(),
      payload: {
        name: "Chicken Breast (smoke)",
        description: "test ingredient",
        calories: 165,
        protein: 31,
        fat: 3.6,
        carbs: 0,
        servingSizeAmount: 100,
        servingSizeUnit: "g",
      },
    });
    chickenId = chicken.json().data.id;

    const turkey = await app.inject({
      method: "POST",
      url: "/api/v1/ingredients",
      headers: auth(),
      payload: {
        name: "Turkey Breast (smoke)",
        description: "test ingredient",
        calories: 135,
        protein: 30,
        fat: 1,
        carbs: 0,
        servingSizeAmount: 100,
        servingSizeUnit: "g",
      },
    });
    turkeyId = turkey.json().data.id;
  });

  after(async () => {
    await app.close();
  });

  it("creates a recipe with a recipeIngredient and a substitute carrying its own amounts", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/recipes",
      headers: auth(),
      payload: {
        name: "Smoke Test Bowl",
        description: "test recipe",
        prepTime: 5,
        cookTime: 10,
        difficulty: "easy",
        servings: 1,
        calories: 300,
        protein: 30,
        carbs: 10,
        fat: 10,
        instructions: ["Cook it."],
        recipeIngredients: [
          {
            ingredientId: chickenId,
            unitId: gramUnitId,
            minAmount: 100,
            baseAmount: 150,
            maxAmount: 200,
            roundAmount: 10,
            substitutes: [
              {
                substituteIngredientId: turkeyId,
                unitId: gramUnitId,
                minAmount: 110,
                baseAmount: 160,
                maxAmount: 210,
                roundAmount: 10,
              },
            ],
          },
        ],
      },
    });

    assert.equal(response.statusCode, 201);
    recipeId = response.json().data.id;
  });

  it("round-trips the substitute's own amount/unit on GET (not the parent's)", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/recipes/${recipeId}`,
      headers: auth(),
    });

    assert.equal(response.statusCode, 200);
    const [recipeIngredient] = response.json().data.recipeIngredients;
    assert.equal(recipeIngredient.baseAmount, 150);

    const [substitute] = recipeIngredient.substitutes;
    assert.equal(substitute.substituteIngredient.id, turkeyId);
    assert.equal(substitute.unit.id, gramUnitId);
    // The substitute's amounts are deliberately different from the parent's
    // (160 vs 150) to prove they're stored independently, not approximated.
    assert.equal(substitute.baseAmount, 160);
    assert.equal(substitute.minAmount, 110);
    assert.equal(substitute.maxAmount, 210);
    assert.equal(substitute.roundAmount, 10);
  });

  it("rejects a substitute missing required amount fields with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/recipes",
      headers: auth(),
      payload: {
        name: "Invalid Smoke Test Recipe",
        description: "test recipe",
        prepTime: 5,
        cookTime: 10,
        difficulty: "easy",
        servings: 1,
        calories: 300,
        protein: 30,
        carbs: 10,
        fat: 10,
        instructions: ["Cook it."],
        recipeIngredients: [
          {
            ingredientId: chickenId,
            unitId: gramUnitId,
            minAmount: 100,
            baseAmount: 150,
            maxAmount: 200,
            roundAmount: 10,
            substitutes: [{ substituteIngredientId: turkeyId, unitId: gramUnitId }],
          },
        ],
      },
    });

    assert.equal(response.statusCode, 400);
  });

  it("replaces substitutes on update (replace-all semantics)", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/recipes/${recipeId}`,
      headers: auth(),
      payload: {
        recipeIngredients: [
          {
            ingredientId: chickenId,
            unitId: gramUnitId,
            minAmount: 100,
            baseAmount: 150,
            maxAmount: 200,
            roundAmount: 10,
            // No substitutes this time - replace-all should remove the old one.
          },
        ],
      },
    });

    assert.equal(response.statusCode, 200);
    const [recipeIngredient] = response.json().data.recipeIngredients;
    assert.equal(recipeIngredient.substitutes.length, 0);
  });
});
