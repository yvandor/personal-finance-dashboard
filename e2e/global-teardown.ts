import { execSync } from "node:child_process";

// Runs once after the whole suite finishes (success or failure) --
// verifiably leaves the E2E database empty afterward, not merely
// deterministic-per-test. Delegates to e2e/wipe-data.ts as a separate
// child process for the same reason global-setup.ts and fixtures.ts do
// (Prisma's generated client is ESM-only; see reset-data.ts's comment).
export default function globalTeardown(): void {
  execSync("npx tsx e2e/wipe-data.ts", { stdio: "inherit", env: process.env });
}
