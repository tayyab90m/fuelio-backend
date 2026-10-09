import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const goalPayload = (name: string) => ({
  name,
  description: "Created by a test",
  calorieAdjustment: { type: "decrease", percentage: 15 },
  macroRatios: { fats: 30, carbs: 40, protein: 30 },
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

describe("goals CRUD, category links and toggle-state", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let goalId: string;
  let categoryIds: string[] = [];
  const suffix = Date.now();

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-goals-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Goals Test" },
    });
    auth = { authorization: `Bearer ${register.json().accessToken}` };

    for (const label of ["A", "B"]) {
      const category = await app.inject({
        method: "POST",
        url: "/api/v1/categories",
        headers: auth,
        payload: categoryPayload(`Goals Test Category ${label} ${suffix}`),
      });
      assert.equal(category.statusCode, 201);
      categoryIds.push(category.json().data.id);
    }
  });

  after(async () => {
    await app.close();
  });

  it("creates a goal that defaults to the active state", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: auth,
      payload: goalPayload(`Test Goal ${suffix}`),
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.ok(body.id);
    assert.equal(body.name, `Test Goal ${suffix}`);
    assert.equal(body.state, "active");
    assert.deepEqual(body.calorieAdjustment, { type: "decrease", percentage: 15 });
    assert.deepEqual(body.macroRatios, { fats: 30, carbs: 40, protein: 30 });
    assert.deepEqual(body.categories, []);
    goalId = body.id;
  });

  it("creates a goal linked to categories and returns them", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: auth,
      payload: { ...goalPayload(`Linked Goal ${suffix}`), categoryIds: [categoryIds[0]] },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.deepEqual(body.categories.map((c: { id: string }) => c.id), [categoryIds[0]]);
    assert.ok(body.categories[0].name);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/goals/${body.id}`, headers: auth });
    assert.equal(del.statusCode, 204);
  });

  it("lists goals with pagination meta", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/goals?page=1&limit=100", headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 100);
    assert.equal(typeof body.meta.total, "number");
    assert.equal(typeof body.meta.totalPages, "number");
    assert.ok(body.data.some((g: { id: string }) => g.id === goalId) || body.meta.total > 100);
  });

  it("gets a goal by id", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/goals/${goalId}`, headers: auth });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, goalId);
  });

  it("updates a goal with a partial body", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${goalId}`,
      headers: auth,
      payload: { description: "Edited" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.description, "Edited");
    assert.equal(body.name, `Test Goal ${suffix}`);
  });

  it("replaces linked categories when categoryIds is provided on update", async () => {
    const first = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${goalId}`,
      headers: auth,
      payload: { categoryIds: [categoryIds[0]] },
    });
    assert.deepEqual(first.json().data.categories.map((c: { id: string }) => c.id), [categoryIds[0]]);

    const second = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${goalId}`,
      headers: auth,
      payload: { categoryIds: [categoryIds[1]] },
    });
    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json().data.categories.map((c: { id: string }) => c.id), [categoryIds[1]]);
  });

  it("leaves categories untouched when categoryIds is omitted", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${goalId}`,
      headers: auth,
      payload: { name: `Renamed Goal ${suffix}` },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.categories.map((c: { id: string }) => c.id), [categoryIds[1]]);
  });

  it("clears categories when categoryIds is an empty array", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${goalId}`,
      headers: auth,
      payload: { categoryIds: [] },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.categories.length, 0);
  });

  it("toggles state active -> inactive -> active", async () => {
    const first = await app.inject({ method: "PATCH", url: `/api/v1/goals/${goalId}/toggle-state`, headers: auth });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().data.state, "inactive");

    const second = await app.inject({ method: "PATCH", url: `/api/v1/goals/${goalId}/toggle-state`, headers: auth });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().data.state, "active");

    const get = await app.inject({ method: "GET", url: `/api/v1/goals/${goalId}`, headers: auth });
    assert.equal(get.json().data.state, "active");
  });

  it("returns 404 when toggling an unknown goal", async () => {
    const response = await app.inject({ method: "PATCH", url: `/api/v1/goals/${UNKNOWN_ID}/toggle-state`, headers: auth });
    assert.equal(response.statusCode, 404);
  });

  it("returns 401 when toggling without a token", async () => {
    const response = await app.inject({ method: "PATCH", url: `/api/v1/goals/${goalId}/toggle-state` });
    assert.equal(response.statusCode, 401);
  });

  it("rejects a missing required field with 400", async () => {
    const { macroRatios: _macroRatios, ...rest } = goalPayload("No Macros");
    const response = await app.inject({ method: "POST", url: "/api/v1/goals", headers: auth, payload: rest });
    assert.equal(response.statusCode, 400);
  });

  it("rejects an invalid calorie adjustment type with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: auth,
      payload: { ...goalPayload("Bad Adjustment"), calorieAdjustment: { type: "sideways", percentage: 10 } },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a macro ratio above 100 with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: auth,
      payload: { ...goalPayload("Bad Macros"), macroRatios: { fats: 30, carbs: 40, protein: 101 } },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a non-uuid category id with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/goals",
      headers: auth,
      payload: { ...goalPayload("Bad Link"), categoryIds: ["not-a-uuid"] },
    });
    assert.equal(response.statusCode, 400);
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/goals" });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/goals",
      headers: { authorization: "Bearer not.a.real-token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 404 for an unknown id on get, update and delete", async () => {
    const get = await app.inject({ method: "GET", url: `/api/v1/goals/${UNKNOWN_ID}`, headers: auth });
    assert.equal(get.statusCode, 404);

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/goals/${UNKNOWN_ID}`,
      headers: auth,
      payload: { name: "Nope" },
    });
    assert.equal(put.statusCode, 404);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/goals/${UNKNOWN_ID}`, headers: auth });
    assert.equal(del.statusCode, 404);
  });

  it("deletes the goal and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/goals/${goalId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/goals/${goalId}`, headers: auth });
    assert.equal(get.statusCode, 404);
  });
});
