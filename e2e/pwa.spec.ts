import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// FLAG FOR THE LEAD, please double-check during integration:
//
// The two service-worker-dependent tests below (registration, and the
// offline-fallback test -- the most important test in this whole slice)
// depend on two things this slice deliberately does NOT do itself:
//
//   1. <ServiceWorkerRegistration /> being mounted somewhere it renders on
//      every page -- app/layout.tsx per the task's own instructions. It
//      isn't mounted anywhere yet; only this slice's component exists.
//   2. NODE_ENV being "production" when the app under test runs.
//      components/pwa/ServiceWorkerRegistration.tsx skips calling
//      navigator.serviceWorker.register() entirely whenever
//      NODE_ENV === "development" (deliberate -- see that file's comment on
//      why), and this repo's playwright.config.ts webServer command is
//      `npm run dev -- -p 3100`, i.e. NODE_ENV=development. Under today's
//      config, unmodified, `getRegistration()` will resolve to undefined
//      and an offline reload will show the browser's own default offline
//      error page, not this app's /offline route -- not because the
//      caching logic is wrong, but because no service worker is running to
//      intercept anything.
//
// I did not change playwright.config.ts myself: it isn't a file this slice
// owns, and swapping the shared webServer command to a full production
// build (`next build && next start`, needing
// PREAUTH_MODE_ACKNOWLEDGED=true -- see server/env.ts) would slow down
// every other spec's dev loop, not just this one. Wiring a second
// Playwright project (or an env-gated webServer override) that runs a
// production build for just this file -- or mounting
// <ServiceWorkerRegistration /> in app/layout.tsx and running the whole
// suite against a production server -- is an integration-level decision,
// not a per-slice one. These tests are written against the *intended*
// real-world behavior so they're correct once that's wired up; please
// confirm the harness change before trusting a red/green result from them
// as-is.
test.describe("PWA manifest", () => {
  test.beforeEach(() => {
    resetE2EData();
  });

  test("is linked from the document head and fetches successfully with the required fields", async ({ page }) => {
    await page.goto("/dashboard");

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBe("/manifest.webmanifest");

    const response = await page.request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe("Finance Dashboard");
    expect(manifest.short_name).toBe("Finance");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
    }
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  });
});

test.describe("Service worker registration", () => {
  // See the file-level comment above -- this requires a production build
  // (NODE_ENV=production) and <ServiceWorkerRegistration /> mounted in
  // app/layout.tsx to actually resolve to a registration.
  test("registers successfully after page load", async ({ page }) => {
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
  // The single most important test in this slice: a finance app must never
  // show a stale or wrong balance while offline. Confirms that when the
  // network genuinely fails on a navigation, the user sees the dedicated
  // offline page (with zero financial figures on it), never a stale cached
  // copy of a real data page.
  test("shows the offline fallback page with no financial figures when the network fails on reload", async ({
    page,
    context,
  }) => {
    resetE2EData([
      { type: "INCOME", amountCents: 500000, date: "2026-01-05", description: "Paycheck", categoryName: "Salary" },
    ]);

    // Visit online first so the service worker has a chance to install and
    // precache /offline (see public/sw.js's install handler) before the
    // network is cut.
    await page.goto("/dashboard");
    await expect(page.getByText("Total income")).toBeVisible();

    await context.setOffline(true);
    try {
      await page.reload();

      // The offline page, not the dashboard.
      await expect(page.getByText("You're offline", { exact: false })).toBeVisible();

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
