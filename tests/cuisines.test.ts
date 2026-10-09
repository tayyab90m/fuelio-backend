import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { withRole } from "./helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("cuisines CRUD and toggle-state", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let cuisineId: string;
  const suffix = Date.now();

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-cuisines-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Cuisines Test" },
    });
    auth = { authorization: `Bearer ${await withRole(app, register.json(), "coach")}` };
  });

  after(async () => {
    await app.close();
  });

  it("creates a cuisine that defaults to the active state", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/cuisines",
      headers: auth,
      payload: { name: `Test Cuisine ${suffix}` },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.ok(body.id);
    assert.equal(body.name, `Test Cuisine ${suffix}`);
    assert.equal(body.state, "active");
    cuisineId = body.id;
  });

  it("creates a cuisine with an explicit inactive state", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/cuisines",
      headers: auth,
      payload: { name: `Inactive Cuisine ${suffix}`, state: "inactive" },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.state, "inactive");
  });

  it("lists cuisines with pagination meta", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/cuisines?page=1&limit=100", headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 100);
    assert.equal(typeof body.meta.total, "number");
    assert.equal(typeof body.meta.totalPages, "number");
    assert.ok(body.data.some((c: { id: string }) => c.id === cuisineId) || body.meta.total > 100);
  });

  it("gets a cuisine by id", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/cuisines/${cuisineId}`, headers: auth });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, cuisineId);
  });

  it("updates a cuisine with a partial body", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/cuisines/${cuisineId}`,
      headers: auth,
      payload: { name: `Renamed Cuisine ${suffix}` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.name, `Renamed Cuisine ${suffix}`);
    assert.equal(response.json().data.state, "active");
  });

  it("toggles state active -> inactive -> active", async () => {
    const first = await app.inject({ method: "PATCH", url: `/api/v1/cuisines/${cuisineId}/toggle-state`, headers: auth });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().data.state, "inactive");

    const second = await app.inject({ method: "PATCH", url: `/api/v1/cuisines/${cuisineId}/toggle-state`, headers: auth });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().data.state, "active");

    const get = await app.inject({ method: "GET", url: `/api/v1/cuisines/${cuisineId}`, headers: auth });
    assert.equal(get.json().data.state, "active");
  });

  it("returns 404 when toggling an unknown cuisine", async () => {
    const response = await app.inject({ method: "PATCH", url: `/api/v1/cuisines/${UNKNOWN_ID}/toggle-state`, headers: auth });
    assert.equal(response.statusCode, 404);
  });

  it("returns 401 when toggling without a token", async () => {
    const response = await app.inject({ method: "PATCH", url: `/api/v1/cuisines/${cuisineId}/toggle-state` });
    assert.equal(response.statusCode, 401);
  });

  it("rejects an empty name with 400", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/cuisines", headers: auth, payload: { name: "" } });
    assert.equal(response.statusCode, 400);
  });

  it("rejects an invalid state with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/cuisines",
      headers: auth,
      payload: { name: "Bad State", state: "archived" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/cuisines" });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/cuisines",
      headers: { authorization: "Bearer not.a.real-token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 404 for an unknown id on get, update and delete", async () => {
    const get = await app.inject({ method: "GET", url: `/api/v1/cuisines/${UNKNOWN_ID}`, headers: auth });
    assert.equal(get.statusCode, 404);

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/cuisines/${UNKNOWN_ID}`,
      headers: auth,
      payload: { name: "Nope" },
    });
    assert.equal(put.statusCode, 404);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/cuisines/${UNKNOWN_ID}`, headers: auth });
    assert.equal(del.statusCode, 404);
  });

  it("deletes the cuisine and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/cuisines/${cuisineId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/cuisines/${cuisineId}`, headers: auth });
    assert.equal(get.statusCode, 404);
  });
});
