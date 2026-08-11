import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// The manifest itself needs no service worker and no production build --
// it's just a fetchable route, so this test runs in the normal
// `npm run test:e2e` suite against the dev server like everything else. The
// two SW-dependent tests (registration, and the offline-fallback safety
// test) live in e2e/pwa-production.spec.ts instead -- see that file's
// header comment for why they need a separate run.
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
