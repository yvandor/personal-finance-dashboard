import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { generateImageMetadata } from "@/app/icon";
import { size as maskableSize } from "@/app/icon-maskable/route";

// app/manifest.ts is a plain function returning a MetadataRoute.Manifest
// object -- no request/route context involved -- so it's unit-testable
// directly, the same way tests/unit exercises lib/*'s other pure functions.
describe("manifest", () => {
  it("declares the required installability fields", () => {
    const result = manifest();
    expect(result.name).toBe("Finance Dashboard");
    expect(result.short_name).toBe("Finance");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });

  it("uses the light-mode --accent token (#4f46e5) for background/theme color", () => {
    const result = manifest();
    expect(result.background_color).toBe("#4f46e5");
    expect(result.theme_color).toBe("#4f46e5");
  });

  it("includes 192x192 and 512x512 icons", () => {
    const result = manifest();
    const sizes = (result.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("marks at least one icon as maskable for Android's adaptive-icon masking", () => {
    const result = manifest();
    const maskable = (result.icons ?? []).some((icon) => icon.purpose === "maskable");
    expect(maskable).toBe(true);
  });

  it("every icon entry has a src, sizes, and type", () => {
    const result = manifest();
    for (const icon of result.icons ?? []) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  // The manifest's icon srcs are hand-written strings that have to line up
  // with app/icon.tsx's generateImageMetadata ids; nothing in the build
  // checks that, so a renamed or dropped id leaves a manifest that parses
  // perfectly and installs an app with a missing icon. Cross-checking the
  // two here catches it in the unit suite, with no server or browser --
  // e2e/pwa.spec.ts then confirms the routes actually serve the right bytes.
  //
  // Scoped to `purpose !== "maskable"` on purpose: that entry is served by
  // app/icon-maskable/route.tsx, a deliberately separate route rather than a
  // third generateImageMetadata id (see that route's header for the real,
  // CI-reproduced Next.js concurrency bug that moved it out) -- checked by
  // its own dedicated test below instead.
  it("points every unmasked icon src at an id app/icon.tsx actually generates", () => {
    const generated = generateImageMetadata();
    const routes = generated.map((image) => `/icon/${image.id}`);

    for (const icon of manifest().icons ?? []) {
      if (icon.purpose === "maskable") continue;
      expect(routes, `${icon.src} should be a generated icon route`).toContain(icon.src);
    }
  });

  it("declares the size app/icon.tsx renders for each unmasked icon src", () => {
    const byRoute = new Map(generateImageMetadata().map((image) => [`/icon/${image.id}`, image.size]));

    for (const icon of manifest().icons ?? []) {
      if (icon.purpose === "maskable") continue;
      const size = byRoute.get(icon.src);
      expect(size, `${icon.src} should be generated`).toBeDefined();
      expect(icon.sizes).toBe(`${size!.width}x${size!.height}`);
    }
  });

  // The maskable entry's own version of the two checks above, against
  // app/icon-maskable/route.tsx instead of app/icon.tsx's generated ids.
  it("points the maskable icon at its own independent route with the right declared size", () => {
    const maskable = (manifest().icons ?? []).find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable!.src).toBe("/icon-maskable");
    expect(maskable!.sizes).toBe(`${maskableSize.width}x${maskableSize.height}`);
  });

  // Regression guard for the v1.6 icon work: a maskable icon must be full
  // bleed with its mark inside Android's 80% safe zone, and an unmasked
  // `purpose: "any"` icon wants its own corner rounding and a larger mark.
  // One image cannot satisfy both, so these two purposes must never be
  // collapsed back onto a single src (they were, before this release --
  // /icon/512 served both). See lib/icon-mark.tsx's VARIANTS.
  it("serves the maskable purpose from its own icon route, not the unmasked 512", () => {
    const icons = manifest().icons ?? [];
    const maskable = icons.find((icon) => icon.purpose === "maskable");
    const unmasked = icons.filter((icon) => icon.purpose !== "maskable").map((icon) => icon.src);

    expect(maskable).toBeDefined();
    expect(unmasked).not.toContain(maskable!.src);
  });
});
