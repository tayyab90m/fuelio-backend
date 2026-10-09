import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { withRole } from "./helpers";

const suffix = Date.now();

describe("roles and access control", () => {
  let app: FastifyInstance;
  let client: { authorization: string };
  let coach: { authorization: string };
  let admin: { authorization: string };
  let adminId: string;
  let clientId: string;
  let goalId: string;
  let activityLevelId: string;

  const register = async (label: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: `roles-${label}-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: `Roles ${label}` },
    });
    assert.equal(response.statusCode, 201);
    return response.json();
  };

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const clientReg = await register("client");
    clientId = clientReg.user.id;
    client = { authorization: `Bearer ${clientReg.accessToken}` };

    const coachReg = await register("coach");
    coach = { authorization: `Bearer ${await withRole(app, coachReg, "coach")}` };

    const adminReg = await register("admin");
    adminId = adminReg.user.id;
    admin = { authorization: `Bearer ${await withRole(app, adminReg, "admin")}` };

    goalId = (await app.inject({ method: "GET", url: "/api/v1/goals", headers: client })).json().data[0].id;
    activityLevelId = (await app.inject({ method: "GET", url: "/api/v1/activity-levels", headers: client })).json().data[0].id;
  });

  after(async () => {
    await app.close();
  });

  describe("registration", () => {
    it("always creates a client, even if a role is requested", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email: `roles-sneaky-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Sneaky", role: "admin" },
      });
      assert.equal(response.statusCode, 201);
      assert.equal(response.json().user.role, "client");
    });

    it("puts the role in the access token and the /me response", async () => {
      const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: client });
      assert.equal(me.json().user.role, "client");
    });
  });

  describe("content endpoints", () => {
    it("lets a client read content", async () => {
      for (const url of ["/api/v1/units", "/api/v1/meals", "/api/v1/recipes", "/api/v1/goals"]) {
        const response = await app.inject({ method: "GET", url, headers: client });
        assert.equal(response.statusCode, 200, url);
      }
    });

    it("blocks a client from creating, updating and deleting content (403)", async () => {
      const create = await app.inject({ method: "POST", url: "/api/v1/units", headers: client, payload: { name: "Nope" } });
      assert.equal(create.statusCode, 403);
      assert.equal(create.json().error.statusCode, 403);

      const update = await app.inject({ method: "PUT", url: `/api/v1/goals/${goalId}`, headers: client, payload: { name: "Hacked" } });
      assert.equal(update.statusCode, 403);

      const del = await app.inject({ method: "DELETE", url: `/api/v1/goals/${goalId}`, headers: client });
      assert.equal(del.statusCode, 403);

      const toggle = await app.inject({ method: "PATCH", url: `/api/v1/goals/${goalId}/toggle-state`, headers: client });
      assert.equal(toggle.statusCode, 403);
    });

    it("lets a client generate a diet plan (POST allowed on submit-answer)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/questions/submit-answer",
        headers: client,
        payload: { age: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevelId, goalId },
      });
      assert.equal(response.statusCode, 200);
    });

    it("lets a coach and an admin change content", async () => {
      for (const [label, headers] of [["coach", coach], ["admin", admin]] as const) {
        const create = await app.inject({ method: "POST", url: "/api/v1/units", headers, payload: { name: `Unit by ${label} ${suffix}` } });
        assert.equal(create.statusCode, 201, label);
        const del = await app.inject({ method: "DELETE", url: `/api/v1/units/${create.json().data.id}`, headers });
        assert.equal(del.statusCode, 204, label);
      }
    });

    it("still rejects unauthenticated requests with 401", async () => {
      const response = await app.inject({ method: "GET", url: "/api/v1/units" });
      assert.equal(response.statusCode, 401);
    });
  });

  describe("user management (admin only)", () => {
    it("rejects clients and coaches with 403", async () => {
      for (const headers of [client, coach]) {
        assert.equal((await app.inject({ method: "GET", url: "/api/v1/users", headers })).statusCode, 403);
        assert.equal(
          (await app.inject({ method: "PATCH", url: `/api/v1/users/${clientId}`, headers, payload: { role: "admin" } })).statusCode,
          403,
        );
      }
    });

    it("lists users with pagination, search and role filter, never exposing secrets", async () => {
      const list = await app.inject({ method: "GET", url: `/api/v1/users?search=roles-client-${suffix}`, headers: admin });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().data.length, 1);
      assert.equal(list.json().data[0].role, "client");
      assert.equal(list.json().data[0].passwordHash, undefined);
      assert.equal(list.json().data[0].refreshTokenHash, undefined);
      assert.equal(list.json().meta.total, 1);

      const coaches = await app.inject({ method: "GET", url: "/api/v1/users?role=coach&limit=100", headers: admin });
      assert.ok(coaches.json().data.every((u: { role: string }) => u.role === "coach"));
    });

    it("creates a user with a chosen role who can sign in", async () => {
      const email = `roles-created-${suffix}@fitnessdashboard.dev`;
      const create = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: admin,
        payload: { email, password: "Password123!", name: "Created Coach", role: "coach" },
      });
      assert.equal(create.statusCode, 201);
      assert.equal(create.json().data.role, "coach");

      const duplicate = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: admin,
        payload: { email, password: "Password123!", name: "Dup" },
      });
      assert.equal(duplicate.statusCode, 409);

      const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: "Password123!" } });
      assert.equal(login.json().user.role, "coach");
    });

    it("changes a role, and the old refresh token stops working", async () => {
      const email = `roles-promote-${suffix}@fitnessdashboard.dev`;
      const reg = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", name: "Promote Me" } });
      const { user, refreshToken } = reg.json();

      const promote = await app.inject({ method: "PATCH", url: `/api/v1/users/${user.id}`, headers: admin, payload: { role: "coach" } });
      assert.equal(promote.statusCode, 200);
      assert.equal(promote.json().data.role, "coach");

      const refresh = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken } });
      assert.equal(refresh.statusCode, 401);

      const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: "Password123!" } });
      assert.equal(login.json().user.role, "coach");
    });

    it("rejects an invalid role with 400 and an unknown user with 404", async () => {
      const bad = await app.inject({ method: "PATCH", url: `/api/v1/users/${clientId}`, headers: admin, payload: { role: "superuser" } });
      assert.equal(bad.statusCode, 400);
      const missing = await app.inject({
        method: "GET",
        url: "/api/v1/users/00000000-0000-4000-8000-000000000000",
        headers: admin,
      });
      assert.equal(missing.statusCode, 404);
    });

    it("refuses to delete your own account", async () => {
      const response = await app.inject({ method: "DELETE", url: `/api/v1/users/${adminId}`, headers: admin });
      assert.equal(response.statusCode, 400);
    });

    it("deletes another user", async () => {
      const del = await app.inject({ method: "DELETE", url: `/api/v1/users/${clientId}`, headers: admin });
      assert.equal(del.statusCode, 204);
      const get = await app.inject({ method: "GET", url: `/api/v1/users/${clientId}`, headers: admin });
      assert.equal(get.statusCode, 404);
    });

    it("never demotes or deletes the last admin", async () => {
      // Park every other admin as a coach for the duration of this test.
      const others = await app.prisma.user.findMany({ where: { role: "admin", id: { not: adminId } }, select: { id: true } });
      await app.prisma.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { role: "coach" } });
      try {
        const demote = await app.inject({ method: "PATCH", url: `/api/v1/users/${adminId}`, headers: admin, payload: { role: "client" } });
        assert.equal(demote.statusCode, 400);
        assert.match(demote.json().error.message, /at least one admin/);

        // Deleting is blocked by the self-delete rule, so check the guard via a second admin deleting the first.
        const second = await app.inject({
          method: "POST",
          url: "/api/v1/users",
          headers: admin,
          payload: { email: `roles-second-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "Second", role: "admin" },
        });
        const secondId = second.json().data.id;
        const secondLogin = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: `roles-second-${suffix}@fitnessdashboard.dev`, password: "Password123!" },
        });
        const secondHeaders = { authorization: `Bearer ${secondLogin.json().accessToken}` };
        // Two admins now: deleting the first is allowed...
        const ok = await app.inject({ method: "DELETE", url: `/api/v1/users/${adminId}`, headers: secondHeaders });
        assert.equal(ok.statusCode, 204);
        // ...leaving `second` as the last admin, who cannot be demoted.
        const blocked = await app.inject({ method: "PATCH", url: `/api/v1/users/${secondId}`, headers: secondHeaders, payload: { role: "coach" } });
        assert.equal(blocked.statusCode, 400);
      } finally {
        await app.prisma.user.updateMany({ where: { id: { in: others.map((u) => u.id) } }, data: { role: "admin" } });
      }
    });
  });
});
