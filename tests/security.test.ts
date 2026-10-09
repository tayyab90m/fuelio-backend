import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { envSchema } from "../src/config/env";

const suffix = Date.now();

describe("rate limiting", () => {
  it("limits login attempts per IP with a 429 in the standard error shape", async () => {
    const app = buildApp({ logger: false }, { authRateLimitMax: 3 });
    await app.ready();
    try {
      const attempt = () =>
        app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "nobody@fitnessdashboard.dev", password: "wrong-password" } });

      for (let i = 0; i < 3; i++) assert.equal((await attempt()).statusCode, 401);

      const blocked = await attempt();
      assert.equal(blocked.statusCode, 429);
      assert.equal(blocked.json().error.statusCode, 429);
      assert.match(blocked.json().error.message, /too many requests/i);
      assert.ok(blocked.headers["retry-after"]);
    } finally {
      await app.close();
    }
  });

  it("does not throttle ordinary content endpoints at the auth limit", async () => {
    const app = buildApp({ logger: false }, { authRateLimitMax: 2 });
    await app.ready();
    try {
      for (let i = 0; i < 5; i++) {
        assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200);
      }
    } finally {
      await app.close();
    }
  });
});

describe("registration switch", () => {
  it("returns 403 from /auth/register when registration is disabled, but login still works", async () => {
    const open = buildApp({ logger: false });
    await open.ready();
    const email = `security-${suffix}@fitnessdashboard.dev`;
    await open.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email, password: "Password123!", name: "Existing" } });
    await open.close();

    const closed = buildApp({ logger: false }, { registrationEnabled: false });
    await closed.ready();
    try {
      const register = await closed.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email: `security-new-${suffix}@fitnessdashboard.dev`, password: "Password123!", name: "New" },
      });
      assert.equal(register.statusCode, 403);
      assert.match(register.json().error.message, /disabled/i);

      const login = await closed.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: "Password123!" } });
      assert.equal(login.statusCode, 200);
    } finally {
      await closed.close();
    }
  });
});

describe("security headers", () => {
  it("sends helmet's default headers", async () => {
    const app = buildApp({ logger: false });
    await app.ready();
    try {
      const response = await app.inject({ method: "GET", url: "/health" });
      assert.equal(response.headers["x-content-type-options"], "nosniff");
      assert.ok(response.headers["strict-transport-security"]);
      assert.equal(response.headers["x-powered-by"], undefined);
    } finally {
      await app.close();
    }
  });
});

describe("production environment validation", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_SECRET: "a".repeat(40),
    JWT_REFRESH_SECRET: "b".repeat(40),
    NODE_ENV: "production",
    CORS_ORIGIN: "https://app.example.com",
  };
  const issues = (overrides: Record<string, string>) => {
    const result = envSchema.safeParse({ ...base, ...overrides });
    return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
  };

  it("accepts a sound production config", () => {
    assert.deepEqual(issues({}), []);
  });

  it("rejects a wildcard CORS origin", () => {
    assert.deepEqual(issues({ CORS_ORIGIN: "*" }), ["CORS_ORIGIN"]);
  });

  it("rejects short or identical JWT secrets", () => {
    assert.deepEqual(issues({ JWT_SECRET: "short" }), ["JWT_SECRET"]);
    assert.deepEqual(issues({ JWT_REFRESH_SECRET: base.JWT_SECRET }), ["JWT_REFRESH_SECRET"]);
  });

  it("is lenient outside production", () => {
    assert.deepEqual(issues({ NODE_ENV: "development", CORS_ORIGIN: "*", JWT_SECRET: "x", JWT_REFRESH_SECRET: "y" }), []);
  });
});
