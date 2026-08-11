import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";

// Loaded here (not just relied on from the shell) so both the Playwright
// CLI process and the `webServer` process it spawns inherit these vars --
// the same pattern vitest.config.mts already uses for .env.test.
loadEnv({ path: path.resolve(process.cwd(), ".env.e2e"), quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Two spec files need a real production build, not `next dev`:
//   - e2e/pwa-production.spec.ts's service-worker tests --
//     components/pwa/ServiceWorkerRegistration.tsx deliberately skips
//     registering at all under NODE_ENV=development.
//   - e2e/cache-headers.spec.ts -- the Cache-Control headers it asserts on
//     only reflect Next's real static-optimization/ISR behavior in a
//     production build; dev mode doesn't apply the same caching.
// Two constraints rule out just always running a production server
// alongside the dev one:
//   1. Cost -- a production build takes real time; paying it on every
//      `npm run test:e2e` run for the sake of a handful of tests out of 30+
//      would slow every other spec's dev loop too, not just these.
//   2. Safety -- `next dev` and `next build` both read/write the same
//      `.next` output directory by default; running them concurrently
//      risks one corrupting the other's in-progress state.
// `npm run test:e2e:pwa` (E2E_MODE=production) swaps this whole config over
// to a single dedicated production webServer + project that runs ONLY
// these two files, on the same port -- the two modes are never invoked in
// the same process, so they never run concurrently.
const isProductionMode = process.env.E2E_MODE === "production";
const PRODUCTION_ONLY_SPECS = /(pwa-production|cache-headers)\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  testMatch: isProductionMode ? PRODUCTION_ONLY_SPECS : undefined,
  testIgnore: isProductionMode ? undefined : PRODUCTION_ONLY_SPECS,
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
    // v1.5: `/` is now a protected route (proxy.ts + requireUserId()) that
    // 307s to /sign-in for an unauthenticated request -- readiness-probing
    // it directly means this fetch follows that redirect and, until
    // Phase 1 adds an actual /sign-in page, lands on a 404, which this
    // webServer check reads as "not ready yet" forever. /api/health is
    // deliberately public (see proxy.ts's PUBLIC_PATHS) for exactly this
    // kind of unauthenticated liveness probe.
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: isProductionMode ? 180_000 : 60_000,
    env: {
      ...(process.env as Record<string, string>),
      // v1.5: every existing spec (all resource CRUD, mobile/PWA, cache
      // headers) predates real auth and exercises the app as the fixed e2e
      // dev user, not a real signed-in session -- this keeps them all
      // passing unchanged via server/context.ts's dev bypass. Auth-specific
      // behavior (real sign-in, protected-route redirect, sign-out,
      // cross-user with two real identities) needs the bypass OFF to be
      // observable at all -- see e2e/auth*.spec.ts's own webServer mode.
      ALLOW_DEV_AUTH_BYPASS: "true",
      // next-auth requires this unconditionally at request time (not just
      // when a real session is found) -- proxy.ts's auth() call fails
      // every single request without it, regardless of the dev bypass
      // above, since that failure happens in Auth.js itself before
      // server/context.ts's fallback logic ever runs. Throwaway,
      // e2e-local-only value -- same "container-local, never used outside
      // this job" spirit as this file's own DATABASE_URL/DEV_USER_ID.
      AUTH_SECRET: "e2e-test-only-secret-never-used-for-anything-real",
      // Auth.js v5 enforces strict Host-header trust under NODE_ENV=production
      // (dev mode trusts localhost implicitly, which is why only the
      // production-mode run needs this) -- without an explicit AUTH_URL it
      // rejects every request against http://localhost:3100 as an untrusted
      // host. Setting AUTH_URL to this run's exact, fixed baseURL is the
      // narrow fix: it tells Auth.js the one specific origin to trust rather
      // than disabling the check via trustHost: true, which would trust
      // whatever Host header any request claims.
      //
      // server/env.ts's assertProductionAuthConfigured() now hard-requires
      // AUTH_GITHUB_ID/AUTH_GITHUB_SECRET/ALLOWED_SIGNIN_EMAILS too (there's
      // no PREAUTH_MODE_ACKNOWLEDGED override anymore) -- throwaway values,
      // same spirit as AUTH_SECRET above. Every production-mode spec
      // authenticates via a real seeded database session (fixtures.ts's
      // seedE2ESession()), never real GitHub OAuth, so these values are
      // never actually exercised -- they only need to exist so the
      // production build's boot-time guard passes.
      ...(isProductionMode
        ? {
            AUTH_URL: baseURL,
            AUTH_GITHUB_ID: "e2e-test-only-github-id-never-used-for-anything-real",
            AUTH_GITHUB_SECRET: "e2e-test-only-github-secret-never-used-for-anything-real",
            ALLOWED_SIGNIN_EMAILS: "e2e-unused@example.invalid",
          }
        : {}),
    },
  },
});
