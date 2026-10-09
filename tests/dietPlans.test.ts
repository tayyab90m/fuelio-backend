import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { MAX_PLANS_PER_USER } from "../src/modules/dietPlans/dietPlans.service";

const suffix = Date.now();

describe("saved diet plans", () => {
  let app: FastifyInstance;
  let alice: { authorization: string };
  let bob: { authorization: string };
  let aliceId: string;
  let answers: Record<string, unknown>;
  let planId: string;

  const register = async (label: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `plans-${label}-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: `Plans ${label}` },
    });
    return response.json();
  };

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const a = await register("alice");
    alice = { authorization: `Bearer ${a.accessToken}` };
    aliceId = a.user.id;
    bob = { authorization: `Bearer ${(await register("bob")).accessToken}` };

    const goalId = (await app.inject({ method: "GET", url: "/api/v1/goals", headers: alice })).json().data[0].id;
    const activityLevelId = (await app.inject({ method: "GET", url: "/api/v1/activity-levels", headers: alice })).json().data[0].id;
    answers = { age: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevelId, goalId };
  });

  after(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    assert.equal((await app.inject({ method: "GET", url: "/api/v1/diet-plans" })).statusCode, 401);
  });

  it("saves a plan for a client: recalculated server-side, with the given name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/diet-plans",
      headers: alice,
      payload: { ...answers, name: "My cut" },
    });
    assert.equal(response.statusCode, 201);
    const plan = response.json().data;
    planId = plan.id;
    assert.equal(plan.name, "My cut");
    assert.equal(plan.input.name, undefined);
    assert.equal(plan.input.age, 30);
    assert.ok(plan.result.macros.calories > 1000);
    assert.equal(plan.result.mealFramework.data.length, 7);
    assert.ok(Object.keys(plan.result.mealFramework.shopping_list).length > 0);
  });

  it("defaults the name when none is given", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/diet-plans", headers: alice, payload: answers });
    assert.equal(response.statusCode, 201);
    assert.match(response.json().data.name, /^Diet plan \d{4}-\d{2}-\d{2}$/);
  });

  it("rejects invalid answers with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/diet-plans",
      headers: alice,
      payload: { ...answers, age: -3 },
    });
    assert.equal(response.statusCode, 400);
  });

  it("lists only my plans, newest first, as summaries", async () => {
    const list = await app.inject({ method: "GET", url: "/api/v1/diet-plans", headers: alice });
    assert.equal(list.statusCode, 200);
    const body = list.json();
    assert.equal(body.data.length, 2);
    assert.equal(body.meta.total, 2);
    assert.ok(new Date(body.data[0].createdAt) >= new Date(body.data[1].createdAt));
    assert.ok(body.data[0].macros.calories > 0);
    assert.equal(body.data[0].result, undefined);

    const other = await app.inject({ method: "GET", url: "/api/v1/diet-plans", headers: bob });
    assert.equal(other.json().meta.total, 0);
  });

  it("returns the full plan to its owner", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/diet-plans/${planId}`, headers: alice });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.result.mealFramework.data.length, 7);
  });

  it("hides other users' plans (404 on read, rename and delete)", async () => {
    assert.equal((await app.inject({ method: "GET", url: `/api/v1/diet-plans/${planId}`, headers: bob })).statusCode, 404);
    assert.equal(
      (await app.inject({ method: "PATCH", url: `/api/v1/diet-plans/${planId}`, headers: bob, payload: { name: "mine now" } })).statusCode,
      404,
    );
    assert.equal((await app.inject({ method: "DELETE", url: `/api/v1/diet-plans/${planId}`, headers: bob })).statusCode, 404);
  });

  it("keeps the saved snapshot when content changes later", async () => {
    const before = (await app.inject({ method: "GET", url: `/api/v1/diet-plans/${planId}`, headers: alice })).json().data.result;
    await app.prisma.meal.updateMany({ data: { name: "Renamed after saving" } });
    const after = (await app.inject({ method: "GET", url: `/api/v1/diet-plans/${planId}`, headers: alice })).json().data.result;
    assert.deepEqual(after, before);
  });

  it("renames a plan", async () => {
    const response = await app.inject({ method: "PATCH", url: `/api/v1/diet-plans/${planId}`, headers: alice, payload: { name: "Renamed" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.name, "Renamed");

    const blank = await app.inject({ method: "PATCH", url: `/api/v1/diet-plans/${planId}`, headers: alice, payload: { name: "  " } });
    assert.equal(blank.statusCode, 400);
  });

  it("deletes a plan", async () => {
    assert.equal((await app.inject({ method: "DELETE", url: `/api/v1/diet-plans/${planId}`, headers: alice })).statusCode, 204);
    assert.equal((await app.inject({ method: "GET", url: `/api/v1/diet-plans/${planId}`, headers: alice })).statusCode, 404);
  });

  it(`caps saved plans at ${MAX_PLANS_PER_USER} per user (409)`, async () => {
    const existing = await app.prisma.dietPlan.count({ where: { userId: aliceId } });
    await app.prisma.dietPlan.createMany({
      data: Array.from({ length: MAX_PLANS_PER_USER - existing }, (_, i) => ({
        userId: aliceId,
        name: `filler ${i}`,
        input: {},
        result: {},
      })),
    });
    const response = await app.inject({ method: "POST", url: "/api/v1/diet-plans", headers: alice, payload: answers });
    assert.equal(response.statusCode, 409);
  });

  it("deletes a user's plans along with the user", async () => {
    const admin = await app.prisma.user.create({
      data: { email: `plans-admin-${suffix}@fitnessdashboard.dev`, name: "Plans admin", passwordHash: "x", role: "admin" },
    });
    const token = app.jwt.sign({ sub: admin.id, email: admin.email, role: "admin" });
    const del = await app.inject({ method: "DELETE", url: `/api/v1/users/${aliceId}`, headers: { authorization: `Bearer ${token}` } });
    assert.equal(del.statusCode, 204);
    assert.equal(await app.prisma.dietPlan.count({ where: { userId: aliceId } }), 0);
  });
});
