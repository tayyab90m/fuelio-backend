import "dotenv/config";

// Point everything at TEST_DATABASE_URL before the app (or Prisma) reads
// DATABASE_URL. The test database is reset on every run, so refuse to
// proceed if it's missing or is the same database as development.
export function useTestDatabase(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL must be set to run tests (see .env.example).");
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL: the test database is wiped on every run.");
  }
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  // Many tests register/login from the same (loopback) IP; keep the rate
  // limits out of their way. tests/security.test.ts sets its own low limit.
  process.env.RATE_LIMIT_MAX ??= "100000";
  process.env.RATE_LIMIT_AUTH_MAX ??= "100000";
  return testUrl;
}
