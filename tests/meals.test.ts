import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const mealPayload = (name: string) => ({
  name,
  description: "Created by a test",
  calories: 550,
  protein: 40,
  carbs: 50,
  fat: 15,
});

const categoryPayload = (name: string) => ({
  name,
  description: "Created by a test",
  sortingPriority: 99,
  proteinMin: 20,
  proteinMax: 30,
  fatMin: 20,
  fatMax: 30,
  carbsMin: 40,
  carbsMax: 50,
  minimalDailyCaloriesMen: 1800,
  minimalDailyCaloriesWomen: 1400,
  mealSwapEnabled: true,
  toleranceOfTotalCalories: 5,
  unit: "kcal",
});

const mealTypePayload = (name: string) => ({
  name,
  description: "Created by a test",
  proteinPercentage: 30,
  carbsPercentage: 40,
  fatsPercentage: 30,
  minimumProtein: 20,
  startTime: "12:00",
  endTime: "14:00",
});

const recipePayload = (name: string) => ({
  name,
  description: "Created by a test",
  prepTime: 10,
  cookTime: 20,
  difficulty: "easy",
  servings: 2,
  calories: 500,
  protein: 35,
  carbs: 45,
  fat: 15,
  instructions: ["Mix everything", "Cook it"],
});

type IdHolder = { id: string };
const ids = (items: IdHolder[]) => items.map((i) => i.id).sort();

describe("meals CRUD and many-to-many links", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let mealId: string;
  const suffix = Date.now();
  const categoryIds: string[] = [];
  const generalMealTypeIds: string[] = [];
  const recipeIds: string[] = [];

  async function createVia(url: string, payload: object): Promise<string> {
    const response = await app.inject({ method: "POST", url, headers: auth, payload });
    assert.equal(response.statusCode, 201, `setup POST ${url} failed: ${response.body}`);
    return response.json().data.id;
  }

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-meals-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Meals Test" },
    });
    auth = { authorization: `Bearer ${register.json().accessToken}` };

    for (const label of ["A", "B"]) {
      categoryIds.push(await createVia("/api/v1/categories", categoryPayload(`Meals Test Category ${label} ${suffix}`)));
      generalMealTypeIds.push(await createVia("/api/v1/general-meal-types", mealTypePayload(`Meals Test Type ${label} ${suffix}`)));
      recipeIds.push(await createVia("/api/v1/recipes", recipePayload(`Meals Test Recipe ${label} ${suffix}`)));
    }
  });

  after(async () => {
    await app.close();
  });

  it("creates a meal with no links", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/meals",
      headers: auth,
      payload: mealPayload(`Plain Meal ${suffix}`),
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.ok(body.id);
    assert.equal(body.name, `Plain Meal ${suffix}`);
    assert.equal(body.calories, 550);
    assert.deepEqual(body.categories, []);
    assert.deepEqual(body.generalMealTypes, []);
    assert.deepEqual(body.recipes, []);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/meals/${body.id}`, headers: auth });
    assert.equal(del.statusCode, 204);
  });

  it("creates a meal linked to categories, general meal types and recipes", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/meals",
      headers: auth,
      payload: {
        ...mealPayload(`Linked Meal ${suffix}`),
        categoryIds: [categoryIds[0]],
        generalMealTypeIds: [generalMealTypeIds[0]],
        recipeIds: [recipeIds[0]],
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    mealId = body.id;
    assert.deepEqual(ids(body.categories), [categoryIds[0]]);
    assert.deepEqual(ids(body.generalMealTypes), [generalMealTypeIds[0]]);
    assert.deepEqual(ids(body.recipes), [recipeIds[0]]);
  });

  it("expands the linked records on GET /:id", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/meals/${mealId}`, headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.id, mealId);
    assert.equal(body.categories.length, 1);
    assert.equal(body.categories[0].name, `Meals Test Category A ${suffix}`);
    assert.equal(body.generalMealTypes.length, 1);
    assert.equal(body.generalMealTypes[0].name, `Meals Test Type A ${suffix}`);
    assert.equal(body.recipes.length, 1);
    assert.equal(body.recipes[0].name, `Meals Test Recipe A ${suffix}`);
  });

  it("lists meals with pagination meta and expanded links", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/meals?page=1&limit=100", headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 100);
    assert.equal(typeof body.meta.total, "number");
    assert.equal(typeof body.meta.totalPages, "number");

    const found = body.data.find((m: IdHolder) => m.id === mealId);
    if (found) {
      assert.equal(found.categories.length, 1);
      assert.equal(found.recipes.length, 1);
    } else {
      assert.ok(body.meta.total > 100, "meal should be on the first page unless more than 100 rows exist");
    }
  });

  it("updates scalar fields with a partial body and leaves the links untouched", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/meals/${mealId}`,
      headers: auth,
      payload: { calories: 600, description: "Edited" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.calories, 600);
    assert.equal(body.description, "Edited");
    assert.equal(body.name, `Linked Meal ${suffix}`);
    assert.deepEqual(ids(body.categories), [categoryIds[0]]);
    assert.deepEqual(ids(body.generalMealTypes), [generalMealTypeIds[0]]);
    assert.deepEqual(ids(body.recipes), [recipeIds[0]]);
  });

  it("replaces (not appends) the links when new id arrays are provided", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/meals/${mealId}`,
      headers: auth,
      payload: {
        categoryIds: [categoryIds[1]],
        generalMealTypeIds: [generalMealTypeIds[1]],
        recipeIds: [recipeIds[1]],
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.deepEqual(ids(body.categories), [categoryIds[1]]);
    assert.deepEqual(ids(body.generalMealTypes), [generalMealTypeIds[1]]);
    assert.deepEqual(ids(body.recipes), [recipeIds[1]]);

    const get = await app.inject({ method: "GET", url: `/api/v1/meals/${mealId}`, headers: auth });
    assert.deepEqual(ids(get.json().data.categories), [categoryIds[1]]);
    assert.deepEqual(ids(get.json().data.recipes), [recipeIds[1]]);
  });

  it("supports multiple ids per relation", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/meals/${mealId}`,
      headers: auth,
      payload: { categoryIds, generalMealTypeIds, recipeIds },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.deepEqual(ids(body.categories), [...categoryIds].sort());
    assert.deepEqual(ids(body.generalMealTypes), [...generalMealTypeIds].sort());
    assert.deepEqual(ids(body.recipes), [...recipeIds].sort());
  });

  it("clears only the relation whose array is empty", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/meals/${mealId}`,
      headers: auth,
      payload: { recipeIds: [] },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.recipes.length, 0);
    assert.equal(body.categories.length, 2);
    assert.equal(body.generalMealTypes.length, 2);
  });

  it("rejects a missing required field with 400", async () => {
    const { calories: _calories, ...rest } = mealPayload("No Calories");
    const response = await app.inject({ method: "POST", url: "/api/v1/meals", headers: auth, payload: rest });
    assert.equal(response.statusCode, 400);
  });

  it("rejects negative macros with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/meals",
      headers: auth,
      payload: { ...mealPayload("Negative"), protein: -1 },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects non-uuid ids in the link arrays with 400", async () => {
    for (const field of ["categoryIds", "generalMealTypeIds", "recipeIds"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/meals",
        headers: auth,
        payload: { ...mealPayload("Bad Link"), [field]: ["not-a-uuid"] },
      });
      assert.equal(response.statusCode, 400, `${field} should be validated`);
    }
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/meals" });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/meals",
      headers: { authorization: "Bearer not.a.real-token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 404 for an unknown id on get, update and delete", async () => {
    const get = await app.inject({ method: "GET", url: `/api/v1/meals/${UNKNOWN_ID}`, headers: auth });
    assert.equal(get.statusCode, 404);

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/meals/${UNKNOWN_ID}`,
      headers: auth,
      payload: { name: "Nope" },
    });
    assert.equal(put.statusCode, 404);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/meals/${UNKNOWN_ID}`, headers: auth });
    assert.equal(del.statusCode, 404);
  });

  it("deletes the meal and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/meals/${mealId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/meals/${mealId}`, headers: auth });
    assert.equal(get.statusCode, 404);

    // The linked records themselves must survive the meal's deletion.
    const category = await app.inject({ method: "GET", url: `/api/v1/categories/${categoryIds[0]}`, headers: auth });
    assert.equal(category.statusCode, 200);
    const recipe = await app.inject({ method: "GET", url: `/api/v1/recipes/${recipeIds[0]}`, headers: auth });
    assert.equal(recipe.statusCode, 200);
  });
});
