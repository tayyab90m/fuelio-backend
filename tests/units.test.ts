import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { withRole } from "./helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("units CRUD", () => {
  let app: FastifyInstance;
  let auth: { authorization: string };
  let unitId: string;
  const suffix = Date.now();

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `smoke-units-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Units Test" },
    });
    auth = { authorization: `Bearer ${await withRole(app, register.json(), "coach")}` };
  });

  after(async () => {
    await app.close();
  });

  it("creates a unit", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth,
      payload: { name: `Test Unit ${suffix}`, short: "tu", equivalentTo: 2.5, unitType: "weight", system: "metric" },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json().data;
    assert.ok(body.id);
    assert.equal(body.name, `Test Unit ${suffix}`);
    assert.equal(body.short, "tu");
    assert.equal(body.equivalentTo, 2.5);
    unitId = body.id;
  });

  it("creates a unit with only a name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth,
      payload: { name: `Bare Unit ${suffix}` },
    });

    assert.equal(response.statusCode, 201);
    assert.ok(response.json().data.id);
  });

  it("lists units with pagination meta", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/units?page=1&limit=100", headers: auth });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 100);
    assert.equal(typeof body.meta.total, "number");
    assert.equal(typeof body.meta.totalPages, "number");
    assert.ok(body.meta.total >= 2);
  });

  it("respects the limit query param", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/units?page=1&limit=1", headers: auth });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 1);
    assert.equal(response.json().meta.limit, 1);
  });

  it("gets a unit by id", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/units/${unitId}`, headers: auth });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, unitId);
  });

  it("updates a unit with a partial body", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/units/${unitId}`,
      headers: auth,
      payload: { short: "tux" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json().data;
    assert.equal(body.short, "tux");
    assert.equal(body.name, `Test Unit ${suffix}`);
  });

  it("rejects an empty name with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth,
      payload: { name: "" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a missing name with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: auth,
      payload: { short: "x" },
    });
    assert.equal(response.statusCode, 400);
  });

  it("rejects a non-uuid id with 400", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/units/not-a-uuid", headers: auth });
    assert.equal(response.statusCode, 400);
  });

  it("returns 401 without a token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/units" });
    assert.equal(response.statusCode, 401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/units",
      headers: { authorization: "Bearer not.a.real-token" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("returns 404 for an unknown id on get, update and delete", async () => {
    const get = await app.inject({ method: "GET", url: `/api/v1/units/${UNKNOWN_ID}`, headers: auth });
    assert.equal(get.statusCode, 404);

    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/units/${UNKNOWN_ID}`,
      headers: auth,
      payload: { name: "Nope" },
    });
    assert.equal(put.statusCode, 404);

    const del = await app.inject({ method: "DELETE", url: `/api/v1/units/${UNKNOWN_ID}`, headers: auth });
    assert.equal(del.statusCode, 404);
  });

  it("deletes the unit and returns 404 afterwards", async () => {
    const del = await app.inject({ method: "DELETE", url: `/api/v1/units/${unitId}`, headers: auth });
    assert.equal(del.statusCode, 204);

    const get = await app.inject({ method: "GET", url: `/api/v1/units/${unitId}`, headers: auth });
    assert.equal(get.statusCode, 404);
  });
});
