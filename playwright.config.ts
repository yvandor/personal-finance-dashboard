import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Loaded here (not just relied on from the shell) so both the Playwright
// CLI process and the `webServer` process it spawns inherit these vars --
// the same pattern vitest.config.mts already uses for .env.test.
loadEnv({ path: path.resolve(process.cwd(), ".env.e2e"), quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // This app has exactly one identity (DEV_USER_ID, no real auth -- see
  // server/context.ts) and every test shares that single user's data.
  // Running fully serial is an honest reflection of that architectural
  // constraint, not a testing shortcut: order-independence comes from every
  // test resetting to a known state first (see e2e/fixtures.ts), not from
  // parallel tenant isolation the app doesn't have yet.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // A dedicated port, separate from the normal `npm run dev` workflow's
    // 3000 -- and reuseExistingServer is deliberately always false. Reusing
    // "whatever's already running" is exactly how an E2E run could end up
    // silently pointed at a real `npm run dev` session against finance_dev
    // instead of the isolated E2E database; the different port makes that
    // structurally impossible rather than a config convention to trust.
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: process.env as Record<string, string>,
  },
});
