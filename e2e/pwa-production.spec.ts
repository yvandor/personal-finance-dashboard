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

test.describe("Generated icons under a production build", () => {
  // e2e/pwa.spec.ts already follows every manifest icon src against the dev
  // server. This covers the two things only a real build can show:
  //
  // 1. app/icon.tsx's generateImageMetadata ids are emitted as routes by
  //    `next build`, not merely resolved on demand by `next dev`. A bad or
  //    renamed id is a 404 that dev mode can hide.
  // 2. The icons still resolve once the service worker is active. Icon paths
  //    are the one place lib/sw-strategy.ts hands back "static" (cache-first)
  //    instead of the network-only default, so these requests go down a code
  //    path in public/sw.js that no other test exercises with real bytes.
  //
  // Deliberately fetched from inside the page rather than via
  // page.request.get(): an APIRequestContext request never passes through
  // the service worker, which would skip the only part of this that is
  // production-specific. Decoding each response as an Image is also a
  // stronger check than a Content-Type header -- a cache-first path that
  // returned a truncated or wrong-typed body would still claim image/png.
  test("every manifest icon decodes at its declared size when served through the active service worker", async ({
    page,
    context,
  }) => {
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);
    await page.goto("/dashboard");
    await page.evaluate(() => navigator.serviceWorker.ready);

    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    const declared = (manifest.icons as { src: string; sizes: string }[]).map(({ src, sizes }) => ({ src, sizes }));
    expect(declared.length).toBeGreaterThan(0);

    const decoded = await page.evaluate(async (icons) => {
      return Promise.all(
        icons.map(async ({ src, sizes }) => {
          const response = await fetch(src);
          if (!response.ok) return { src, sizes, actual: `HTTP ${response.status}` };
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          try {
            const image = new Image();
            const size = await new Promise<string>((resolve) => {
              image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
              image.onerror = () => resolve("decode failed");
              image.src = url;
            });
            return { src, sizes, actual: size };
          } finally {
            URL.revokeObjectURL(url);
          }
        }),
      );
    }, declared);

    for (const icon of decoded) {
      expect(icon.actual, `${icon.src} should decode as a ${icon.sizes} image`).toBe(icon.sizes);
    }
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
