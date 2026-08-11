import { test, expect } from "@playwright/test";
import { resetE2EData } from "./fixtures";

// A PNG's dimensions live in its IHDR chunk at a fixed offset -- signature
// (8 bytes) + chunk length (4) + "IHDR" (4), then width and height as
// big-endian uint32s. Reading them straight out of the response body means
// these tests check the bytes actually served, not just the Content-Type
// header a route claims, and needs no image library. Returns null when the
// body is not a PNG at all, so a caller gets a useful failure instead of
// asserting on garbage read out of, say, an HTML error page.
function readPngSize(body: Buffer): { width: number; height: number } | null {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (body.length < 24 || !body.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (body.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

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

  // The manifest declares each icon's src, type and pixel dimensions, and
  // nothing in the build checks that any of those claims are true -- the
  // srcs are hand-written strings pointing at app/icon.tsx's
  // generateImageMetadata ids. A typo'd or removed id would leave a
  // manifest that parses fine and installs an app with a broken icon, which
  // is exactly the kind of failure nobody notices until it is on someone's
  // home screen. So: follow every src and check the real bytes.
  test("every declared icon src serves a PNG of exactly its declared size", async ({ page }) => {
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();

    for (const icon of manifest.icons as { src: string; sizes: string; type: string }[]) {
      const response = await page.request.get(icon.src);
      expect(response.ok(), `${icon.src} should be fetchable`).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
      expect(icon.type).toBe("image/png");

      const dimensions = readPngSize(await response.body());
      expect(dimensions, `${icon.src} should serve PNG bytes`).not.toBeNull();
      expect(`${dimensions!.width}x${dimensions!.height}`).toBe(icon.sizes);
    }
  });

  // Regression guard for the fix that gave the maskable purpose its own
  // artwork. A maskable icon must be full bleed with its mark inside
  // Android's 80% safe zone; an unmasked `purpose: "any"` icon wants its own
  // corner rounding and a larger mark. One image cannot be both, so if these
  // two entries ever point at the same route -- or at two routes that render
  // identical bytes -- the maskable declaration is a lie again and Android
  // will clip or letterbox the installed icon. Compares bytes, not just
  // srcs, because two different srcs rendering the same drawing is the same
  // bug wearing a disguise.
  test("the maskable icon is genuinely different artwork from the unmasked icon of the same size", async ({ page }) => {
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];

    const maskable = icons.find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
    const unmasked = icons.find((icon) => icon.purpose !== "maskable" && icon.sizes === maskable!.sizes);
    expect(unmasked, "expected an `any` icon at the same size to compare against").toBeDefined();

    expect(maskable!.src).not.toBe(unmasked!.src);
    const maskableBytes = await (await page.request.get(maskable!.src)).body();
    const unmaskedBytes = await (await page.request.get(unmasked!.src)).body();
    expect(maskableBytes.equals(unmaskedBytes)).toBe(false);
  });

  // app/apple-icon.tsx is the one icon route the manifest never mentions --
  // iOS ignores the manifest's icons entirely and reads
  // <link rel="apple-touch-icon"> instead, so nothing above would catch it
  // going missing. Resolved through the head link rather than a hardcoded
  // path because Next owns the emitted URL for that file convention.
  test("the iOS apple-touch-icon is linked from the head and serves a 180x180 PNG", async ({ page }) => {
    await page.goto("/dashboard");

    const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
    expect(href).toBeTruthy();

    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(readPngSize(await response.body())).toEqual({ width: 180, height: 180 });
  });
});
