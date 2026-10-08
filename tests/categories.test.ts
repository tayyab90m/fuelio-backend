import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

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

describe("categories CRUD and goal links", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let goalIds: string[];
  let categoryId: string;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-categories-${Date.now()}@fitnessdashboard.dev`, password: "Password123!", name: "Categories Test" },
    });
    auth = { authorization: `Bearer ${register.json().accessToken}` };

    const goals = await app.inject({ method: "GET", url: "/api/v1/goals", headers: auth });
    goalIds = goals.json().data.slice(0, 2).map((g: { id: string }) => g.id);
    assert.equal(goalIds.length, 2, "seed data should provide at least two goals");
  });

  after(async () => {
    await app.close();
  });

  it("creates a category linked to a goal and returns that goal", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: auth,
      payload: { ...categoryPayload("Linked Category"), goalIds: [goalIds[0]] },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    categoryId = body.id;
    assert.deepEqual(body.goals.map((g: { id: string }) => g.id), [goalIds[0]]);
    assert.ok(body.goals[0].name);
  });

  it("returns the linked goals on the list and single-item endpoints", async () => {
    const one = await app.inject({ method: "GET", url: `/api/v1/categories/${categoryId}`, headers: auth });
    assert.equal(one.json().data.goals.length, 1);

    const list = await app.inject({ method: "GET", url: "/api/v1/categories?limit=100", headers: auth });
    const found = list.json().data.find((c: { id: string }) => c.id === categoryId);
    assert.equal(found.goals.length, 1);
  });

  it("replaces the goals when goalIds is provided on update", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/categories/${categoryId}`,
      headers: auth,
      payload: { goalIds: [goalIds[1]] },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.goals.map((g: { id: string }) => g.id), [goalIds[1]]);
  });

  it("leaves the goals untouched when goalIds is omitted on update", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/categories/${categoryId}`,
      headers: auth,
      payload: { description: "Edited" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.description, "Edited");
    assert.deepEqual(response.json().data.goals.map((g: { id: string }) => g.id), [goalIds[1]]);
  });

  it("clears the goals when goalIds is an empty array", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/categories/${categoryId}`,
      headers: auth,
      payload: { goalIds: [] },
    });

    assert.equal(response.json().data.goals.length, 0);
  });

  it("rejects a non-uuid goal id with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: auth,
      payload: { ...categoryPayload("Bad Link"), goalIds: ["not-a-uuid"] },
    });

    assert.equal(response.statusCode, 400);
  });

  it("deletes the category and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/categories/${categoryId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/categories/${categoryId}`, headers: auth });
    assert.equal(get.statusCode, 404);
  });
});
