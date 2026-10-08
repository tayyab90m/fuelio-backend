import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// HTTP-level pagination smoke test for the ingredients module - the only
// list endpoint with pre-existing query-param filtering (categoryId/search)
// that pagination had to be merged into rather than added standalone.

describe("ingredients pagination", () => {
  let app: FastifyInstance;
  let accessToken: string;
  const createdIds: string[] = [];

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const email = `smoke-ingredients-${Date.now()}@fitnessdashboard.dev`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "Password123!", name: "Ingredients Pagination Smoke Test" },
    });
    accessToken = register.json().accessToken;

    for (let i = 0; i < 5; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ingredients",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: `Pagination Smoke Ingredient ${i}`,
          description: "Created for pagination smoke test",
          calories: 100 + i,
          protein: 10,
          fat: 5,
          carbs: 20,
          servingSizeAmount: 100,
          servingSizeUnit: "g",
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
        url: `/api/v1/ingredients/${id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
    }
    await app.close();
  });

  it("reports meta.total matching the real row count and paginates without overlap", async () => {
    const baseline = await app.inject({
      method: "GET",
      url: "/api/v1/ingredients?page=1&limit=100",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(baseline.statusCode, 200);
    const baselineBody = baseline.json();
    const total = baselineBody.meta.total;
    assert.equal(baselineBody.data.length, total);
    assert.ok(total >= 5);

    const page1 = await app.inject({
      method: "GET",
      url: "/api/v1/ingredients?page=1&limit=2",
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
      url: "/api/v1/ingredients?page=2&limit=2",
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

  it("combines pagination with the existing search filter", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/ingredients?search=${encodeURIComponent("Pagination Smoke Ingredient")}&page=1&limit=3`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 3);
    assert.equal(body.meta.total, 5);
    assert.equal(body.meta.totalPages, 2);
    for (const item of body.data) {
      assert.ok(item.name.includes("Pagination Smoke Ingredient"));
    }
  });

  it("rejects an out-of-range limit with 400", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/ingredients?limit=101",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 400);
  });
});
