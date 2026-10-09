import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { withRole } from "./helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

// Foreign-key violations are the client's fault (deleting something still in
// use, or pointing at something that doesn't exist), so they must not
// surface as 500 "Internal server error".
describe("foreign-key violations", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  const suffix = Date.now();
  let unitId: string;
  let ingredientId: string;
  let recipeId: string;

  const ingredientPayload = (extra: Record<string, unknown> = {}) => ({
    name: `FK Ingredient ${suffix}`,
    description: "foreign key test",
    calories: 100,
    protein: 10,
    fat: 1,
    carbs: 5,
    servingSizeAmount: 100,
    servingSizeUnit: "g",
    ...extra,
  });

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-fk-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "FK Test" },
    });
    auth = { authorization: `Bearer ${await withRole(app, register.json(), "coach")}` };

    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth,
      payload: { name: `FK Unit ${suffix}` },
    });
    unitId = unit.json().data.id;

    const ingredient = await app.inject({
      method: "POST",
      url: "/api/v1/ingredients",
      headers: auth,
      payload: ingredientPayload({ unitId }),
    });
    ingredientId = ingredient.json().data.id;

    // A recipe line is a REQUIRED reference to both the ingredient and the
    // unit (unlike Ingredient.unitId, which is optional and just nulls out).
    const recipe = await app.inject({
      method: "POST",
      url: "/api/v1/recipes",
      headers: auth,
      payload: {
        name: `FK Recipe ${suffix}`,
        description: "foreign key test",
        prepTime: 1,
        cookTime: 1,
        difficulty: "easy",
        servings: 1,
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
        instructions: ["x"],
        recipeIngredients: [
          { ingredientId, unitId, minAmount: 1, baseAmount: 1, maxAmount: 1, roundAmount: 1 },
        ],
      },
    });
    recipeId = recipe.json().data.id;
  });

  after(async () => {
    await app.close();
  });

  it("returns 409 (not 500) when deleting a unit a recipe still uses", async () => {
    const response = await app.inject({ method: "DELETE", url: `/api/v1/units/${unitId}`, headers: auth });

    assert.equal(response.statusCode, 409);
    assert.match(response.json().error.message, /depend/i);
  });

  it("returns 409 (not 500) when deleting an ingredient a recipe still uses", async () => {
    const response = await app.inject({ method: "DELETE", url: `/api/v1/ingredients/${ingredientId}`, headers: auth });

    assert.equal(response.statusCode, 409);
  });

  it("returns 400 (not 500) when creating an ingredient with a unit that does not exist", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ingredients",
      headers: auth,
      payload: ingredientPayload({ name: `FK Bad Unit ${suffix}`, unitId: UNKNOWN_ID }),
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error.message, /does not exist/i);
  });

  it("returns 400 (not 500) when updating an ingredient to a category that does not exist", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/ingredients/${ingredientId}`,
      headers: auth,
      payload: { categoryId: UNKNOWN_ID },
    });

    assert.equal(response.statusCode, 400);
  });

  it("allows deleting them once the recipe is gone", async () => {
    const recipe = await app.inject({ method: "DELETE", url: `/api/v1/recipes/${recipeId}`, headers: auth });
    assert.equal(recipe.statusCode, 204);

    const ingredient = await app.inject({ method: "DELETE", url: `/api/v1/ingredients/${ingredientId}`, headers: auth });
    assert.equal(ingredient.statusCode, 204);

    const unit = await app.inject({ method: "DELETE", url: `/api/v1/units/${unitId}`, headers: auth });
    assert.equal(unit.statusCode, 204);
  });
});
