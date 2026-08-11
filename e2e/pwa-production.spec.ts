import { test, expect } from "@playwright/test";
import { resetE2EData, seedE2ESession } from "./fixtures";

// These two tests need a real production build, not `next dev` --
// components/pwa/ServiceWorkerRegistration.tsx deliberately skips calling
// navigator.serviceWorker.register() whenever NODE_ENV === "development"
// (see that file's comment). Running them requires:
//
//   npm run test:e2e:pwa
//
// which sets E2E_MODE=production, swapping playwright.config.ts over to a
// single, dedicated production webServer (`next build && next start`) and
// a project that runs ONLY this file. The default `npm run test:e2e` never
// touches this file or pays a production-build cost for it -- see
// playwright.config.ts's comment for why the two modes are never run
// concurrently (both would fight over the same .next output directory).
test.describe("Service worker registration", () => {
  test("registers successfully after page load", async ({ page, context }) => {
    // /dashboard is a protected route (proxy.ts + requireUserId()) -- the
    // dev bypass is unavailable under NODE_ENV=production by design, so
    // this needs a real database-strategy session, same as production
    // traffic would have. See fixtures.ts's seedE2ESession().
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);
    await page.goto("/dashboard");
    const registration = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      // Give the SW registration (kicked off from a useEffect on mount) a
      // moment to resolve rather than racing it.
      await navigator.serviceWorker.ready;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? { scope: reg.scope, active: !!reg.active } : null;
    });

    expect(registration).not.toBeNull();
    expect(registration?.active).toBe(true);
  });
});

test.describe("Offline fallback -- core safety requirement", () => {
  // The single most important test in this entire v1.4 version: a finance
  // app must never show a stale or wrong balance while offline. Confirms
  // that when the network genuinely fails on a navigation, the user sees
  // the dedicated offline page (with zero financial figures on it), never a
  // stale cached copy of a real data page.
  test("shows the offline fallback page with no financial figures when the network fails on reload", async ({
    page,
    context,
  }) => {
    resetE2EData([
      { type: "INCOME", amountCents: 500000, date: "2026-01-05", description: "Paycheck", categoryName: "Salary" },
    ]);
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);

    // Visit online first so the service worker has a chance to install and
    // precache /offline (see public/sw.js's install handler) before the
    // network is cut.
    await page.goto("/dashboard");
    await expect(page.getByText("Total income")).toBeVisible();

    await context.setOffline(true);
    try {
      await page.reload();

      // The offline page, not the dashboard. Role + regex, not an exact
      // getByText string -- app/offline/page.tsx renders a curly apostrophe
      // (&rsquo;, U+2019) in "You're offline", not the straight ASCII one a
      // literal string here would need to match exactly.
      await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();

      // The core safety assertion: no dollar figure anywhere on the page.
      // This regex is deliberately broad (any "$<digits>" pattern) rather
      // than checking for the one specific seeded amount above -- it must
      // catch ANY financial figure leaking through, not just this test's
      // own fixture data.
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toMatch(/\$\s?\d/);
      expect(bodyText).not.toContain("Total income");
      expect(bodyText).not.toContain("Paycheck");
    } finally {
      // Always restore network, even on failure, so later tests/hooks
      // (which need the network) aren't left broken by this one.
      await context.setOffline(false);
    }
  });
});
