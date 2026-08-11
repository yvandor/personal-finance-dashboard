import { test, expect } from "@playwright/test";
import { resetE2EData, seedE2ESession } from "./fixtures";

// Needs a real production build, not `next dev` -- these are exactly the
// Cache-Control headers Next only emits once static-optimization/ISR
// actually run, which dev mode doesn't do the same way. Run via
// `npm run test:e2e:pwa` (E2E_MODE=production), same as
// e2e/pwa-production.spec.ts -- see playwright.config.ts's comment.
//
// SECURITY-RELEVANT: found via a real production-server header check (not
// assumed) that /categories, /bills, and /goals were statically prerendered
// (no dynamic API used in their route) and served with
// `Cache-Control: s-maxage=31536000` -- a one-year shared-cache lifetime --
// despite reading live per-user data. Fixed with `export const
// dynamic = "force-dynamic"` on all three (see their page.tsx comments).
// This test is the regression guard: every data-bearing dashboard route
// must send a private, no-store Cache-Control, so a CDN/edge cache (Vercel,
// in production) can never serve one user's stale snapshot to anyone else.
test.describe("Cache-Control on data-bearing pages", () => {
  // Every path below is protected (proxy.ts + requireUserId()); the dev
  // bypass is unavailable under NODE_ENV=production by design, so an
  // unauthenticated goto() would follow proxy.ts's redirect to /sign-in and
  // this test would end up checking /sign-in's headers instead of the
  // intended route's. A real session (see fixtures.ts's seedE2ESession())
  // is what lets goto() land on the actual page being tested.
  test.beforeEach(async ({ context }) => {
    resetE2EData();
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);
  });

  for (const path of ["/transactions", "/budgets", "/categories", "/bills", "/income", "/goals", "/history", "/dashboard"]) {
    test(`${path} is never shared-cacheable`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response).not.toBeNull();
      const cacheControl = response!.headers()["cache-control"] ?? "";
      expect(cacheControl).toContain("no-store");
      expect(cacheControl).not.toMatch(/s-maxage=(?!0)/);
    });
  }
});
