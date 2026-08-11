import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Loaded here (not just relied on from the shell) so both the Playwright
// CLI process and the `webServer` process it spawns inherit these vars --
// the same pattern vitest.config.mts already uses for .env.test.
loadEnv({ path: path.resolve(process.cwd(), ".env.e2e"), quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// e2e/pwa-production.spec.ts's two service-worker tests need a real
// production build -- components/pwa/ServiceWorkerRegistration.tsx
// deliberately skips registering at all under NODE_ENV=development, which
// `next dev` (the default webServer below) always is. Two constraints rule
// out just always running a production server alongside the dev one:
//   1. Cost -- a production build takes real time; paying it on every
//      `npm run test:e2e` run for the sake of 2 tests out of 30+ would slow
//      every other spec's dev loop too, not just this one.
//   2. Safety -- `next dev` and `next build` both read/write the same
//      `.next` output directory by default; running them concurrently
//      risks one corrupting the other's in-progress state.
// `npm run test:e2e:pwa` (E2E_MODE=production) swaps this whole config over
// to a single dedicated production webServer + project that runs ONLY
// e2e/pwa-production.spec.ts, on the same port -- the two modes are never
// invoked in the same process, so they never run concurrently.
const isProductionMode = process.env.E2E_MODE === "production";
const PWA_PRODUCTION_SPEC = "pwa-production.spec.ts";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  testMatch: isProductionMode ? PWA_PRODUCTION_SPEC : undefined,
  testIgnore: isProductionMode ? undefined : PWA_PRODUCTION_SPEC,
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
    command: isProductionMode ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: isProductionMode ? 180_000 : 60_000,
    env: {
      ...(process.env as Record<string, string>),
      // See server/env.ts's boot-time guard (v1.4): `next build`/`next
      // start` refuse to run under NODE_ENV=production without this. This
      // e2e run is exactly the kind of controlled, non-public environment
      // the escape hatch exists for.
      ...(isProductionMode ? { PREAUTH_MODE_ACKNOWLEDGED: "true" } : {}),
    },
  },
});
