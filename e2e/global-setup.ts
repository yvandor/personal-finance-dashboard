import { execSync } from "node:child_process";

// Runs once before the whole suite. By the time this runs, playwright.config.ts
// has already loaded .env.e2e into process.env, so this applies migrations to
// the dedicated E2E database -- never finance_dev, never the Vitest suite's
// database. Per-test data reset/reseed happens separately, in
// e2e/fixtures.ts's resetE2EData(), called from each spec's beforeEach.
export default function globalSetup(): void {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
