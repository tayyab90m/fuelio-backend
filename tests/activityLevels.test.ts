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

  describe("pagination", () => {
    const createdIds: string[] = [];

    before(async () => {
      // Baseline total before adding the records this block paginates over -
      // the table may already hold seed rows plus whatever earlier tests in
      // this file left behind, so pagination math is checked against a
      // measured before/after total rather than a hardcoded count.
      for (let i = 0; i < 5; i += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/activity-levels",
          headers: { authorization: `Bearer ${accessToken}` },
          payload: {
            name: `Pagination Smoke Level ${i}`,
            multiplier: 1.2,
            description: "Created for pagination smoke test",
            stepRangeMin: 1000,
            stepRangeMax: 2000,
            workoutRangeMin: 1,
            workoutRangeMax: 2,
          },
        });
        assert.equal(response.statusCode, 201);
        createdIds.push(response.json().data.id);
      }
    });

    after(async () => {
      for (const id of createdIds) {
        await app.inject({
          method: "DELETE",
          url: `/api/v1/activity-levels/${id}`,
          headers: { authorization: `Bearer ${accessToken}` },
        });
      }
    });

    it("reports meta.total matching the real row count and paginates without overlap", async () => {
      // A large limit acts as a single-page baseline to read off the real total.
      const baseline = await app.inject({
        method: "GET",
        url: "/api/v1/activity-levels?page=1&limit=100",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(baseline.statusCode, 200);
      const baselineBody = baseline.json();
      const total = baselineBody.meta.total;
      assert.equal(baselineBody.data.length, total);
      assert.ok(total >= 5);

      const page1 = await app.inject({
        method: "GET",
        url: "/api/v1/activity-levels?page=1&limit=2",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(page1.statusCode, 200);
      const page1Body = page1.json();
      assert.equal(page1Body.data.length, 2);
      assert.deepEqual(page1Body.meta, {
        page: 1,
        limit: 2,
        total,
        totalPages: Math.ceil(total / 2),
      });

      const page2 = await app.inject({
        method: "GET",
        url: "/api/v1/activity-levels?page=2&limit=2",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(page2.statusCode, 200);
      const page2Body = page2.json();
      assert.equal(page2Body.data.length, 2);
      assert.equal(page2Body.meta.page, 2);
      assert.equal(page2Body.meta.total, total);

      const page1Ids = page1Body.data.map((item: { id: string }) => item.id);
      const page2Ids = page2Body.data.map((item: { id: string }) => item.id);
      assert.equal(page1Ids.filter((id: string) => page2Ids.includes(id)).length, 0);
    });

    it("defaults to page 1 / limit 20 when no query params are given", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/activity-levels",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.meta.page, 1);
      assert.equal(body.meta.limit, 20);
    });
  });
});
