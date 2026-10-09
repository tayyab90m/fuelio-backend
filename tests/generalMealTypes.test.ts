import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { withRole } from "./helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

const mealTypePayload = (name: string) => ({
  name,
  description: "Created by a test",
  proteinPercentage: 30,
  carbsPercentage: 40,
  fatsPercentage: 30,
  minimumProtein: 20,
  startTime: "07:00",
  endTime: "09:30",
});

describe("general meal types CRUD", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let mealTypeId: string;
  const suffix = Date.now();

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-gmt-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Meal Types Test" },
    });
    auth = { authorization: `Bearer ${await withRole(app, register.json(), "coach")}` };
  });

  after(async () => {
    await app.close();
  });

  it("creates a general meal type that defaults to active", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: mealTypePayload(`Breakfast ${suffix}`),
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.ok(body.id);
    assert.equal(body.name, `Breakfast ${suffix}`);
    assert.equal(body.state, "active");
    assert.equal(body.startTime, "07:00");
    assert.equal(body.endTime, "09:30");
    assert.equal(body.minimumProtein, 20);
    mealTypeId = body.id;
  });

  it("lists general meal types with pagination meta", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/general-meal-types?page=1&limit=100", headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 100);
    assert.equal(typeof body.meta.total, "number");
    assert.equal(typeof body.meta.totalPages, "number");
    assert.ok(body.data.some((m: { id: string }) => m.id === mealTypeId) || body.meta.total > 100);
  });

  it("gets a general meal type by id", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/general-meal-types/${mealTypeId}`, headers: auth });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, mealTypeId);
  });

  it("updates a general meal type with a partial body", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/general-meal-types/${mealTypeId}`,
      headers: auth,
      payload: { endTime: "10:15", state: "inactive" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.endTime, "10:15");
    assert.equal(body.state, "inactive");
    assert.equal(body.startTime, "07:00");
    assert.equal(body.name, `Breakfast ${suffix}`);
  });

  it("accepts the boundary times 00:00 and 23:59", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: { ...mealTypePayload(`Boundary ${suffix}`), startTime: "00:00", endTime: "23:59" },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.startTime, "00:00");
    assert.equal(response.json().data.endTime, "23:59");
  });

  it("rejects an out-of-range hour (25:00) with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: { ...mealTypePayload("Bad Hour"), startTime: "25:00" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects an out-of-range minute (12:60) with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: { ...mealTypePayload("Bad Minute"), endTime: "12:60" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a time without zero padding (7:00) with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: { ...mealTypePayload("Unpadded"), startTime: "7:00" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a bad time on update with 400", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/general-meal-types/${mealTypeId}`,
      headers: auth,
      payload: { startTime: "25:00" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a percentage above 100 with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/general-meal-types",
      headers: auth,
      payload: { ...mealTypePayload("Bad Percent"), proteinPercentage: 101 },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a missing required field with 400", async () => {
    const { description: _description, ...rest } = mealTypePayload("No Description");
    const response = await app.inject({ method: "POST", url: "/api/v1/general-meal-types", headers: auth, payload: rest });
    assert.equal(response.statusCode, 400);
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/general-meal-types" });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/general-meal-types",
      headers: { authorization: "Bearer not.a.real-token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 404 for an unknown id on get, update and delete", async () => {
    const get = await app.inject({ method: "GET", url: `/api/v1/general-meal-types/${UNKNOWN_ID}`, headers: auth });
    assert.equal(get.statusCode, 404);

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/general-meal-types/${UNKNOWN_ID}`,
      headers: auth,
      payload: { name: "Nope" },
    });
    assert.equal(put.statusCode, 404);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/general-meal-types/${UNKNOWN_ID}`, headers: auth });
    assert.equal(del.statusCode, 404);
  });

  it("deletes the general meal type and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/general-meal-types/${mealTypeId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/general-meal-types/${mealTypeId}`, headers: auth });
    assert.equal(get.statusCode, 404);
  });
});
