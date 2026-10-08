import { spawnSync } from "node:child_process";
import { useTestDatabase } from "../tests/testEnv";

// Recreate the test database from migrations + seed so every test run starts
// from the same known state (tests read seeded activity levels and goals).
useTestDatabase();

const result = spawnSync("npx", ["prisma", "migrate", "reset", "--force"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
