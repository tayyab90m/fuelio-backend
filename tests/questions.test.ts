import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// Smoke tests for the Day 4 Question CRUD module and the
// POST /api/v1/questions/submit-answer placeholder diet-plan calculation.
// Runs against a real (local) Postgres database, same as tests/auth.test.ts.

describe("questions module", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let activityLevelId: string;
  let goalId: string;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const email = `smoke-questions-${Date.now()}@fitnessdashboard.dev`;
    const register = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password: "Password123!", name: "Questions Smoke Test" },
    });
    accessToken = register.json().accessToken;

    // Pull real seeded reference rows rather than hardcoding ids.
    const activityLevels = await app.inject({
      method: "GET",
      url: "/api/v1/activity-levels",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    activityLevelId = activityLevels.json().data[0].id;

    const goals = await app.inject({
      method: "GET",
      url: "/api/v1/goals",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    goalId = goals.json().data[0].id;
  });

  after(async () => {
    await app.close();
  });

  describe("CRUD", () => {
    let questionId: string;

    it("creates a question", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          text: "What is your primary fitness goal?",
          questionType: "single_choice",
          options: [
            { label: "Lose weight", value: "lose_weight" },
            { label: "Gain muscle", value: "gain_muscle" },
          ],
        },
      });

      assert.equal(response.statusCode, 201);
      const body = response.json();
      assert.ok(body.data.id);
      assert.equal(body.data.text, "What is your primary fitness goal?");
      assert.equal(body.data.state, "active");
      questionId = body.data.id;
    });

    it("gets the question by id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/questions/${questionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.id, questionId);
    });

    it("lists questions", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/questions",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      assert.equal(response.statusCode, 200);
      const ids = response.json().data.map((item: { id: string }) => item.id);
      assert.ok(ids.includes(questionId));
    });

    it("updates the question", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/questions/${questionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { text: "Updated question text" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.text, "Updated question text");
    });

    it("rejects an invalid create payload with 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { text: "Missing questionType and options" },
      });

      assert.equal(response.statusCode, 400);
    });

    it("deletes the question", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/questions/${questionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      assert.equal(response.statusCode, 204);

      const getAfterDelete = await app.inject({
        method: "GET",
        url: `/api/v1/questions/${questionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(getAfterDelete.statusCode, 404);
    });

    it("rejects requests without a token with 401", async () => {
      const response = await app.inject({ method: "GET", url: "/api/v1/questions" });
      assert.equal(response.statusCode, 401);
    });
  });

  describe("submit-answer (placeholder diet-plan calculation)", () => {
    it("returns sane macro numbers for valid input", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          age: 30,
          sex: "male",
          heightCm: 180,
          weightKg: 80,
          activityLevelId,
          goalId,
        },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();

      assert.equal(body.userAnswers.activityLevelId, activityLevelId);
      assert.equal(body.userAnswers.goalId, goalId);
      assert.deepEqual(body.errors, []);

      // Plausible human range per the task spec.
      assert.ok(body.macros.calories > 1000 && body.macros.calories < 6000);
      assert.ok(body.macros.protein > 0);
      assert.ok(body.macros.fat > 0);
      assert.ok(body.macros.carbs > 0);

      assert.ok(Array.isArray(body.macrosDistribution));
      assert.ok(body.macrosDistribution.length >= 3);
      for (const meal of body.macrosDistribution) {
        assert.equal(typeof meal.name, "string");
        assert.equal(typeof meal.timing, "string");
        assert.equal(typeof meal.description, "string");
        assert.ok(meal.macros.calories >= 0);
      }

      assert.equal(typeof body.mealFramework, "string");
      assert.ok(body.mealFramework.length > 0);
    });

    it("echoes extra answer fields submitted alongside the required ones", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          age: 25,
          sex: "female",
          heightCm: 165,
          weightKg: 60,
          activityLevelId,
          goalId,
          favoriteFood: "pasta",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().userAnswers.favoriteFood, "pasta");
    });

    it("returns 404 for a well-formed but unknown activityLevelId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          age: 30,
          sex: "male",
          heightCm: 180,
          weightKg: 80,
          activityLevelId: "00000000-0000-0000-0000-000000000000",
          goalId,
        },
      });

      assert.equal(response.statusCode, 404);
    });

    it("returns 404 for a well-formed but unknown goalId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          age: 30,
          sex: "male",
          heightCm: 180,
          weightKg: 80,
          activityLevelId,
          goalId: "00000000-0000-0000-0000-000000000000",
        },
      });

      assert.equal(response.statusCode, 404);
    });

    it("returns 400 for a malformed body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          age: 30,
          sex: "not-a-sex",
          heightCm: 180,
          weightKg: 80,
          activityLevelId: "not-a-uuid",
          goalId,
        },
      });

      assert.equal(response.statusCode, 400);
    });

    it("rejects submit-answer without a token with 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        payload: { age: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevelId, goalId },
      });

      assert.equal(response.statusCode, 401);
    });
  });
});
