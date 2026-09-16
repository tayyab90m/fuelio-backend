import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// Basic HTTP-level CRUD smoke test for the activityLevels module (Day 2).
// This module previously had no HTTP-level test coverage (only auth.test.ts
// existed) — added here alongside the Day 4 questions work rather than
// duplicating what auth.test.ts already covers.

describe("activity levels CRUD", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let activityLevelId: string;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const email = `smoke-activitylevels-${Date.now()}@fitnessdashboard.dev`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "Password123!", name: "Activity Levels Smoke Test" },
    });
    accessToken = register.json().accessToken;
  });

  after(async () => {
    await app.close();
  });

  it("creates an activity level", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/activity-levels",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Smoke Test Level",
        multiplier: 1.4,
        description: "Created by a smoke test",
        stepRangeMin: 1000,
        stepRangeMax: 2000,
        workoutRangeMin: 1,
        workoutRangeMax: 2,
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.ok(body.data.id);
    assert.equal(body.data.state, "active");
    activityLevelId = body.data.id;
  });

  it("lists activity levels including the new one", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/activity-levels",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const ids = response.json().data.map((item: { id: string }) => item.id);
    assert.ok(ids.includes(activityLevelId));
  });

  it("gets the activity level by id", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activity-levels/${activityLevelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.id, activityLevelId);
  });

  it("updates the activity level", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/activity-levels/${activityLevelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { multiplier: 1.5 },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.multiplier, 1.5);
  });

  it("rejects an invalid create payload with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/activity-levels",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Missing required fields" },
    });

    assert.equal(response.statusCode, 400);
  });

  it("deletes the activity level", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/activity-levels/${activityLevelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 204);
  });

  it("returns 404 for the deleted activity level", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activity-levels/${activityLevelId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 404);
  });
});
