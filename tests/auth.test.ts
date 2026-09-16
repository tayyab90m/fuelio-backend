import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// This is a smoke test: it exercises the full register -> login -> refresh
// -> /me flow against a real (local) Postgres database as configured by
// DATABASE_URL. It uses a randomised email per run so it is safe to re-run
// against a persistent database.

describe("auth flow", () => {
  let app: FastifyInstance;
  const email = `smoke-${Date.now()}@fitnessdashboard.dev`;
  const password = "Password123!";

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("registers a new user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, name: "Smoke Test" },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.user.email, email);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
  });

  it("rejects duplicate registration with 409", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, name: "Smoke Test" },
    });

    assert.equal(response.statusCode, 409);
  });

  it("logs in with correct credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.user.email, email);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
  });

  it("rejects login with wrong password with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "wrong-password" },
    });

    assert.equal(response.statusCode, 401);
  });

  it("returns the current user from /me with a valid access token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    const { accessToken, refreshToken } = login.json();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.email, email);

    // and refresh should mint a new working access token
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken },
    });

    assert.equal(refreshed.statusCode, 200);
    assert.ok(refreshed.json().accessToken);
  });

  it("rejects /me without a token with 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    assert.equal(response.statusCode, 401);
  });
});
